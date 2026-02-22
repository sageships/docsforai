'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { API_ROUTES, SCAN_STATUS, SCORE_COLORS } from '@/lib/constants';
import type { ScanSummary } from '@/types';

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-500';
  return SCORE_COLORS.textClass(score);
}

function getStatusBadge(status: ScanSummary['status']) {
  const map: Record<ScanSummary['status'], { label: string; class: string }> = {
    [SCAN_STATUS.PENDING]: { label: 'Pending', class: 'bg-gray-700 text-gray-300' },
    [SCAN_STATUS.CRAWLING]: { label: 'Crawling', class: 'bg-blue-500/20 text-blue-400' },
    [SCAN_STATUS.SCORING]: { label: 'Scoring', class: 'bg-indigo-500/20 text-indigo-400' },
    [SCAN_STATUS.COMPLETED]: { label: 'Completed', class: 'bg-green-500/20 text-green-400' },
    [SCAN_STATUS.FAILED]: { label: 'Failed', class: 'bg-red-500/20 text-red-400' },
  };
  const cfg = map[status];
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.class}`}>{cfg.label}</span>
  );
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy');
}

export default function DashboardPage() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch(API_ROUTES.SCANS)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load scans');
        return r.json() as Promise<ScanSummary[]>;
      })
      .then((data) => {
        setScans(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load scans');
        setLoading(false);
      });
  }, []);

  const handleNewScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setScanning(true);
    try {
      const res = await fetch(API_ROUTES.SCAN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      if (!res.ok) throw new Error('Failed to start scan');
      const data = (await res.json()) as { scanId: string; redirectUrl: string };
      router.push(`/results/${data.scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setScanning(false);
    }
  };

  // Stats — use totalScore (matches API field name)
  const completedScans = scans.filter(
    (s) => s.status === SCAN_STATUS.COMPLETED && s.totalScore !== null,
  );
  const totalScans = scans.length;
  const avgScore = completedScans.length
    ? Math.round(
        completedScans.reduce((sum, s) => sum + (s.totalScore ?? 0), 0) / completedScans.length,
      )
    : null;
  const bestScore = completedScans.length
    ? Math.max(...completedScans.map((s) => s.totalScore ?? 0))
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Dashboard</h1>
            <p className="text-gray-400 mt-1">
              Monitor your documentation&apos;s AI-readiness over time.
            </p>
          </div>

          {/* New scan form */}
          <form onSubmit={(e) => void handleNewScan(e)} className="flex gap-2">
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://docs.yoursite.com"
              required
              className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-w-[220px]"
            />
            <button
              type="submit"
              disabled={scanning}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex-shrink-0"
            >
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </span>
              ) : (
                '+ New Scan'
              )}
            </button>
          </form>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Scans', value: totalScans, suffix: '' },
            {
              label: 'Average Score',
              value: avgScore !== null ? avgScore : '—',
              suffix: avgScore !== null ? '/100' : '',
            },
            {
              label: 'Best Score',
              value: bestScore !== null ? bestScore : '—',
              suffix: bestScore !== null ? '/100' : '',
            },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs text-gray-500 uppercase font-medium tracking-wider mb-1">
                {label}
              </p>
              <p className="text-3xl font-bold text-gray-100">
                {value}
                {suffix && (
                  <span className="text-base text-gray-500 font-normal ml-1">{suffix}</span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Score trend placeholder */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-10">
          <h2 className="text-base font-semibold text-gray-300 mb-4">Score Trend</h2>
          <div className="h-40 flex items-center justify-center border border-dashed border-gray-700 rounded-lg">
            <div className="text-center">
              <p className="text-4xl mb-2">📈</p>
              <p className="text-sm text-gray-500">Score history chart coming soon</p>
              <p className="text-xs text-gray-600 mt-1">Run more scans to see your trend</p>
            </div>
          </div>
        </div>

        {/* Scans table */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-base font-semibold text-gray-300">Scan History</h2>
            <span className="text-sm text-gray-500">
              {totalScans} scan{totalScans !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Retry
              </button>
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-gray-400 font-medium">No scans yet</p>
              <p className="text-sm text-gray-600 mt-1">
                Enter a URL above to run your first scan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-4 max-w-xs">
                        <a
                          href={scan.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 truncate block transition-colors"
                          title={scan.url}
                        >
                          {scan.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${getScoreColor(scan.totalScore)}`}>
                          {scan.totalScore !== null ? `${scan.totalScore}/100` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(scan.status)}</td>
                      <td className="px-6 py-4 text-gray-400">{formatDate(scan.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/results/${scan.id}`}
                          className="text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-100 transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
