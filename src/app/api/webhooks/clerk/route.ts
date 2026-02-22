import { headers } from 'next/headers';
import type { NextResponse } from 'next/server';
import { Webhook } from 'svix';

import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id: string;
}

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: ClerkUserData;
}

function getPrimaryEmail(data: ClerkUserData): string {
  const primary = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? '';
}

function getFullName(data: ClerkUserData): string | null {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return errorResponse('CLERK_WEBHOOK_SECRET is not configured', 500);
  }

  // ── Verify svix signature ────────────────────────────────────────────────
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return errorResponse('Missing svix headers', 400);
  }

  let payload: ClerkWebhookEvent;
  try {
    const body = await request.text();
    const wh = new Webhook(webhookSecret);
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return errorResponse('Invalid webhook signature', 400);
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  try {
    const { type, data } = payload;

    if (type === 'user.created') {
      const email = getPrimaryEmail(data);
      const name = getFullName(data);

      await prisma.user.create({
        data: {
          clerkId: data.id,
          email,
          name,
        },
      });
    } else if (type === 'user.updated') {
      const email = getPrimaryEmail(data);
      const name = getFullName(data);

      await prisma.user.update({
        where: { clerkId: data.id },
        data: { email, name },
      });
    } else if (type === 'user.deleted') {
      // Cascade delete: scans are deleted first, then user
      await prisma.scan.deleteMany({
        where: { user: { clerkId: data.id } },
      });
      await prisma.user.delete({
        where: { clerkId: data.id },
      });
    }

    return successResponse({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return errorResponse(`Webhook handler failed: ${message}`, 500);
  }
}
