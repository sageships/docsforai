'use client';

import { useState } from 'react';

import type { ScoreBreakdown } from '@/types';

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdown[];
}

const categoryIcons: Record<string, string> = {
  Structure: '🏗️',
  'Code Quality': '💻',
  'Query-ability': '🔍',
  'AI-SEO': '🤖',
  Freshness: '⚡',
};

function getBarColor(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct < 40) return 'bg-red-500';
  if (pct <= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getTextColor(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct < 40) return 'text-red-400';
  if (pct <= 70) return 'text-yellow-400';
  return 'text-green-400';
}

interface CategoryRowProps {
  item: ScoreBreakdown;
}

function CategoryRow({ item }: CategoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round((item.score / item.maxScore) * 100);
  const icon = categoryIcons[item.category] ?? '📊';

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="text-2xl flex-shrink-0">{icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-200">{item.category}</span>
            <span
              className={`text-sm font-bold ml-2 flex-shrink-0 ${getTextColor(item.score, item.maxScore)}`}
            >
              {item.score}/{item.maxScore}
            </span>
          </div>

          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ease-out ${getBarColor(item.score, item.maxScore)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <span
          className={`text-gray-400 text-sm flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {expanded && item.reasons.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wider mt-3 mb-2">
            Detailed Feedback
          </p>
          <ul className="space-y-2">
            {item.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-gray-500 mt-0.5 flex-shrink-0">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  return (
    <div className="w-full">
      <h2 className="text-xl font-bold text-gray-100 mb-4">Score Breakdown</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {breakdown.map((item) => (
          <CategoryRow key={item.category} item={item} />
        ))}
      </div>
    </div>
  );
}
