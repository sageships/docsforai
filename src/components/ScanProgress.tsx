'use client';

import { formatDuration, intervalToDuration } from 'date-fns';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import type { ScanStatus } from '@/types';

interface ScanProgressProps {
  status: ScanStatus;
  pagesCrawled: number;
  totalPages?: number | null;
  startedAt?: string;
}

interface Step {
  id: ScanStatus;
  label: string;
  description: string;
}

const steps: Step[] = [
  {
    id: 'crawling',
    label: 'Crawling pages',
    description: 'Discovering and fetching documentation pages...',
  },
  {
    id: 'scoring',
    label: 'Analyzing & scoring',
    description: 'Evaluating structure, code quality, and AI-readiness...',
  },
  {
    id: 'completed',
    label: 'Generating recommendations',
    description: 'Creating actionable improvement suggestions...',
  },
];

const statusOrder: Record<ScanStatus, number> = {
  pending: -1,
  crawling: 0,
  scoring: 1,
  completed: 2,
  failed: 3,
};

export default function ScanProgress({
  status,
  pagesCrawled,
  totalPages,
  startedAt,
}: ScanProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const [dots, setDots] = useState('.');

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const currentStepIdx = statusOrder[status] ?? 0;
  const progressPct =
    status === 'completed' ? 100 : status === 'scoring' ? 66 : status === 'crawling' ? 33 : 10;

  const formatElapsed = (s: number): string => {
    if (s < 60) return `${s}s`;
    const duration = intervalToDuration({ start: 0, end: s * 1000 });
    return formatDuration(duration, { format: ['minutes', 'seconds'], zero: false });
  };

  const estimatedTotal = 60;
  const remaining = Math.max(0, estimatedTotal - elapsed);

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Spinner + heading */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-gray-700 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl">🤖</span>
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-100">Analyzing your docs{dots}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {status === 'crawling' &&
              `${pagesCrawled}${totalPages ? `/${totalPages}` : ''} pages crawled`}
            {status === 'scoring' && 'Running AI analysis'}
            {status === 'pending' && 'Initializing scan'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{progressPct}% complete</span>
          {elapsed > 0 && (
            <span>
              {formatElapsed(elapsed)} elapsed · ~{formatElapsed(remaining)} remaining
            </span>
          )}
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const isActive = i === currentStepIdx;
          const isDone = i < currentStepIdx || status === 'completed';

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-all duration-300',
                isActive && 'border-indigo-500/50 bg-indigo-500/10',
                isDone && !isActive && 'border-green-500/30 bg-green-500/5',
                !isActive && !isDone && 'border-gray-800 bg-gray-900/50 opacity-40',
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isDone && !isActive ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-700" />
                )}
              </div>
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    isActive && 'text-indigo-300',
                    isDone && !isActive && 'text-green-300',
                    !isActive && !isDone && 'text-gray-500',
                  )}
                >
                  {step.label}
                </p>
                {isActive && <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {status === 'crawling' && totalPages && totalPages > 0 && (
        <div className="mt-4 text-center text-xs text-gray-500">
          {pagesCrawled} of {totalPages} pages processed
        </div>
      )}
    </div>
  );
}
