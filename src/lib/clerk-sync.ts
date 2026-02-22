import { clerkClient } from '@clerk/nextjs/server';
import type { User } from '@prisma/client';

import prisma from '@/lib/prisma';

/**
 * Syncs a Clerk user to the database on-demand.
 * Creates the user if they don't exist, or updates their email/name if they do.
 * Use this as a fallback when the webhook may have been missed.
 */
export async function syncClerkUser(clerkUserId: string): Promise<User> {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  );
  const email = primaryEmail?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? '';

  const nameParts = [clerkUser.firstName, clerkUser.lastName].filter(Boolean);
  const name = nameParts.length > 0 ? nameParts.join(' ') : null;

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUserId },
    create: {
      clerkId: clerkUserId,
      email,
      name,
    },
    update: {
      email,
      name,
    },
  });

  return user;
}
