import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import type { ScanSummary } from '@/types';

export async function GET(): Promise<NextResponse> {
  const { userId: clerkUserId } = await auth();

  // Unauthenticated — return empty list (not an error)
  if (!clerkUserId) {
    return NextResponse.json([] satisfies ScanSummary[], { status: 200 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json([] satisfies ScanSummary[], { status: 200 });
    }

    const scans = await prisma.scan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        status: true,
        overallScore: true,
        createdAt: true,
      },
    });

    const response: ScanSummary[] = scans.map((s) => ({
      id: s.id,
      url: s.url,
      status: s.status as ScanSummary['status'],
      totalScore: s.overallScore,
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch scans' }, { status: 500 });
  }
}
