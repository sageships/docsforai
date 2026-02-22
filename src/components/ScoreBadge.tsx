'use client';

import { useState } from 'react';

interface ScoreBadgeProps {
  score: number;
  scanId: string;
  docsUrl?: string;
}

function getScoreColor(score: number): string {
  if (score < 40) return 'critical';
  if (score <= 70) return 'yellow';
  return 'brightgreen';
}

function getScoreLabel(score: number): string {
  if (score < 40) return 'needs work';
  if (score <= 70) return 'moderate';
  return 'AI-ready';
}

export default function ScoreBadge({ score, scanId }: ScoreBadgeProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const resultsUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/results/${scanId}`
      : `/results/${scanId}`;

  const badgeUrl = `https://img.shields.io/badge/AI--Readiness-${score}%2F100%20${encodeURIComponent(label)}-${color}?style=flat&logo=openai`;

  const markdownCode = `[![AI-Readiness Score](${badgeUrl})](${resultsUrl})`;
  const htmlCode = `<a href="${resultsUrl}"><img src="${badgeUrl}" alt="AI-Readiness Score: ${score}/100" /></a>`;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-bold text-gray-100 mb-2">Add to Your README</h2>
      <p className="text-sm text-gray-400 mb-6">
        Show visitors your documentation&apos;s AI-readiness score with an embeddable badge.
      </p>

      {/* Badge preview */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 mb-6">
        <p className="text-xs text-gray-500 uppercase font-medium tracking-wider mb-4">Preview</p>

        {/* Simulated README look */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded bg-gray-200" />
            <div>
              <div className="h-4 bg-gray-300 rounded w-32 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-48" />
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badgeUrl}
            alt={`AI-Readiness Score: ${score}/100`}
            className="h-5"
            onError={(e) => {
              // fallback if shields.io is unreachable
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="mt-2 space-y-1">
            <div className="h-2.5 bg-gray-200 rounded w-full" />
            <div className="h-2.5 bg-gray-200 rounded w-5/6" />
            <div className="h-2.5 bg-gray-200 rounded w-4/6" />
          </div>
        </div>
      </div>

      {/* Embed codes */}
      <div className="space-y-4">
        {[
          { key: 'markdown', label: 'Markdown', code: markdownCode },
          { key: 'html', label: 'HTML', code: htmlCode },
        ].map(({ key, label, code }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">{label}</span>
              <button
                onClick={() => copyToClipboard(code, key)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-100 transition-colors"
              >
                {copiedKey === key ? (
                  <span className="text-green-400">✓ Copied!</span>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-gray-950 border border-gray-700 rounded-lg p-3 overflow-x-auto">
              <code className="text-xs font-mono text-gray-300 whitespace-pre">{code}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
