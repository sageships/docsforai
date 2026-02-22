import { create } from 'zustand';

import { POLL_INTERVAL_MS, MAX_POLL_ATTEMPTS } from '@/lib/constants';
import type { Scan } from '@/types';

interface ScanState {
  currentScan: Scan | null;
  isScanning: boolean;
  error: string | null;
  startScan: (url: string) => Promise<void>;
  fetchScan: (id: string) => Promise<void>;
  reset: () => void;
}

async function pollUntilComplete(id: string, onUpdate: (scan: Scan) => void): Promise<Scan> {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const res = await fetch(`/api/scan/${id}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `Failed to fetch scan: ${res.status}`);
    }

    const scan = (await res.json()) as Scan;
    onUpdate(scan);

    if (scan.status === 'completed' || scan.status === 'failed') {
      return scan;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    attempts++;
  }

  throw new Error('Scan timed out. Please try again.');
}

export const useScanStore = create<ScanState>((set) => ({
  currentScan: null,
  isScanning: false,
  error: null,

  startScan: async (url: string) => {
    set({ isScanning: true, error: null, currentScan: null });

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Failed to start scan: ${res.status}`,
        );
      }

      // API returns { scanId, redirectUrl } — NOT a full Scan object
      const { scanId } = (await res.json()) as { scanId: string; redirectUrl: string };

      const completed = await pollUntilComplete(scanId, (updated) => {
        set({ currentScan: updated });
      });

      set({ currentScan: completed, isScanning: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isScanning: false });
    }
  },

  fetchScan: async (id: string) => {
    set({ isScanning: true, error: null });

    try {
      const res = await fetch(`/api/scan/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Failed to fetch scan: ${res.status}`,
        );
      }

      const scan = (await res.json()) as Scan;
      set({ currentScan: scan, isScanning: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isScanning: false });
    }
  },

  reset: () => {
    set({ currentScan: null, isScanning: false, error: null });
  },
}));
