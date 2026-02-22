'use client';

import { useState } from 'react';

import type { Recommendation } from '@/types';

interface RecommendationsProps {
  recommendations: Recommendation[];
}

const priorityConfig = {
  high: {
    label: 'High Priority',
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
    order: 0,
  },
  medium: {
    label: 'Medium Priority',
    badgeClass: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    order: 1,
  },
  low: {
    label: 'Low Priority',
    badgeClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    order: 2,
  },
};

interface RecommendationCardProps {
  rec: Recommendation;
  done: boolean;
  onToggle: () => void;
}

function RecommendationCard({ rec, done, onToggle }: RecommendationCardProps) {
  const [showExample, setShowExample] = useState(false);
  const config = priorityConfig[rec.priority];

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${
        done
          ? 'border-gray-700 bg-gray-900/40 opacity-60'
          : 'border-gray-700 bg-gray-900 hover:border-gray-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 transition-colors flex items-center justify-center ${
            done ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-gray-400'
          }`}
        >
          {done && (
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
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badgeClass}`}>
              {config.label}
            </span>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {rec.category}
            </span>
          </div>

          <h4
            className={`font-semibold mb-1 ${done ? 'line-through text-gray-500' : 'text-gray-100'}`}
          >
            {rec.title}
          </h4>
          <p className="text-sm text-gray-400">{rec.description}</p>

          {rec.example && (
            <div className="mt-3">
              <button
                onClick={() => setShowExample(!showExample)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                {showExample ? 'Hide example ↑' : 'Show example ↓'}
              </button>

              {showExample && (
                <div className="mt-2 rounded-lg bg-gray-950 border border-gray-700 p-3 overflow-x-auto">
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                    {rec.example}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Recommendations({ recommendations }: RecommendationsProps) {
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const sorted = [...recommendations].sort(
    (a, b) => priorityConfig[a.priority].order - priorityConfig[b.priority].order,
  );

  const grouped = {
    high: sorted.filter((r) => r.priority === 'high'),
    medium: sorted.filter((r) => r.priority === 'medium'),
    low: sorted.filter((r) => r.priority === 'low'),
  };

  const globalIndex = (priority: 'high' | 'medium' | 'low', localIdx: number): number => {
    const highLen = grouped.high.length;
    const medLen = grouped.medium.length;
    if (priority === 'high') return localIdx;
    if (priority === 'medium') return highLen + localIdx;
    return highLen + medLen + localIdx;
  };

  const doneCount = doneIds.size;
  const total = recommendations.length;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-100">Recommendations</h2>
        <span className="text-sm text-gray-400">
          {doneCount}/{total} completed
        </span>
      </div>

      {total > 0 && (
        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
          <div
            className="h-1.5 rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
      )}

      <div className="space-y-6">
        {(['high', 'medium', 'low'] as const).map((priority) => {
          const group = grouped[priority];
          if (group.length === 0) return null;
          const config = priorityConfig[priority];

          return (
            <div key={priority}>
              <h3
                className={`text-sm font-semibold uppercase tracking-wider mb-3 ${
                  priority === 'high'
                    ? 'text-red-400'
                    : priority === 'medium'
                      ? 'text-yellow-400'
                      : 'text-blue-400'
                }`}
              >
                {config.label} ({group.length})
              </h3>
              <div className="space-y-3">
                {group.map((rec, i) => {
                  const idx = globalIndex(priority, i);
                  return (
                    <RecommendationCard
                      key={idx}
                      rec={rec}
                      done={doneIds.has(idx)}
                      onToggle={() => toggle(idx)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
