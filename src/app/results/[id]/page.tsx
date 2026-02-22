'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import LlmsTxtPreview from '@/components/LlmsTxtPreview';
import Recommendations from '@/components/Recommendations';
import ScanProgress from '@/components/ScanProgress';
import ScoreBadge from '@/components/ScoreBadge';
import ScoreBreakdown from '@/components/ScoreBreakdown';
import ScoreCard from '@/components/ScoreCard';
import type { Scan } from '@/types';
import { scoreResultToBreakdown } from '@/types';

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;

  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout>;

    const fetchScan = async () => {
      try {
        const res = await fetch(`/api/scan/${id}`);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? 'Failed to load scan results');
        }
        const data = (await res.json()) as Scan;

        if (!active) return;
        setScan(data);
        setLoading(false);

        if (data.status !== 'completed' && data.status !== 'failed') {
          pollTimer = setTimeout(fetchScan, 2000);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    void fetchScan();

    return () => {
      active = false;
      clearTimeout(pollTimer);
    };
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  if (loading && !scan) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-100 mb-2">Something went wrong</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 underline text-sm">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (!scan) return null;

  const isProcessing = scan.status !== 'completed' && scan.status !== 'failed';
  const scanDate = format(new Date(scan.createdAt), 'MMMM d, yyyy, hh:mm a');

  // Convert ScoreResult → ScoreBreakdown[] for the ScoreBreakdown component
  const scoreBreakdown = scan.scores ? scoreResultToBreakdown(scan.scores) : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header: URL + date + share */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-12">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase font-medium tracking-wider mb-1">
              Scanned URL
            </p>
            <a
              href={scan.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-indigo-400 hover:text-indigo-300 break-all transition-colors"
            >
              {scan.url}
            </a>
            <p className="text-sm text-gray-500 mt-1">{scanDate}</p>
          </div>
          <button
            onClick={() => void handleShare()}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-300 hover:text-gray-100 transition-colors"
          >
            {copied ? (
              <>
                <svg
                  className="w-4 h-4 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-green-400">Link copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share
              </>
            )}
          </button>
        </div>

        {/* In-progress state */}
        {isProcessing && (
          <div className="mb-16 flex justify-center">
            <ScanProgress
              status={scan.status}
              pagesCrawled={scan.pagesScanned ?? 0}
              totalPages={null}
              startedAt={scan.createdAt}
            />
          </div>
        )}

        {/* Failed state */}
        {scan.status === 'failed' && (
          <div className="mb-12 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400 font-medium">Scan failed</p>
            {scan.errorMessage && <p className="text-sm text-gray-400 mt-1">{scan.errorMessage}</p>}
          </div>
        )}

        {/* Completed results */}
        {scan.status === 'completed' && scan.totalScore !== null && (
          <>
            {/* Score Card */}
            <div className="flex justify-center mb-16">
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 shadow-2xl">
                <ScoreCard score={scan.totalScore} size="lg" />
              </div>
            </div>

            {/* Score Breakdown */}
            {scoreBreakdown && scoreBreakdown.length > 0 && (
              <section className="mb-16">
                <ScoreBreakdown breakdown={scoreBreakdown} />
              </section>
            )}

            {/* Recommendations */}
            {scan.recommendations && scan.recommendations.length > 0 && (
              <section className="mb-16">
                <Recommendations recommendations={scan.recommendations} />
              </section>
            )}

            {/* llms.txt Preview */}
            {scan.llmsTxt && (
              <section className="mb-16">
                <LlmsTxtPreview llmsTxt={scan.llmsTxt} llmsFullTxt={scan.llmsFullTxt} />
              </section>
            )}

            {/* Badge */}
            <section className="mb-16">
              <ScoreBadge score={scan.totalScore} scanId={scan.id} docsUrl={scan.url} />
            </section>

            {/* CTA */}
            <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-10 text-center">
              <h3 className="text-2xl font-bold text-gray-100 mb-2">Track your score over time</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Sign up to monitor your documentation&apos;s AI-readiness score, get alerts when it
                drops, and unlock detailed analytics.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/sign-up"
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-500/25"
                >
                  Create free account →
                </Link>
                <Link
                  href="/"
                  className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-100 font-medium text-sm transition-colors"
                >
                  Scan another site
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
