'use client';

import { useState } from 'react';

interface LlmsTxtPreviewProps {
  llmsTxt: string;
  llmsFullTxt?: string | null;
}

type Tab = 'llms.txt' | 'llms-full.txt';

export default function LlmsTxtPreview({ llmsTxt, llmsFullTxt }: LlmsTxtPreviewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('llms.txt');
  const [copied, setCopied] = useState(false);

  const content = activeTab === 'llms.txt' ? llmsTxt : (llmsFullTxt ?? '');
  const filename = activeTab === 'llms.txt' ? 'llms.txt' : 'llms-full.txt';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = content;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: Tab[] = ['llms.txt', ...(llmsFullTxt ? ['llms-full.txt' as Tab] : [])];

  return (
    <div className="w-full">
      <h2 className="text-xl font-bold text-gray-100 mb-4">Generated llms.txt</h2>
      <p className="text-sm text-gray-400 mb-4">
        Add this file to your documentation root to help AI agents understand your docs structure.
      </p>

      <div className="rounded-xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-gray-900 border-b border-gray-700 px-4 py-2">
          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-md font-mono transition-colors ${
                  activeTab === tab
                    ? 'bg-gray-700 text-gray-100'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-100 transition-colors"
            >
              {copied ? (
                <>
                  <svg
                    className="w-3.5 h-3.5 text-green-400"
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
                  <span className="text-green-400">Copied!</span>
                </>
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
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </button>
          </div>
        </div>

        {/* Code block */}
        <div className="bg-gray-950 overflow-auto max-h-96">
          <pre className="p-4 text-sm font-mono text-gray-300 leading-relaxed whitespace-pre">
            {content || (
              <span className="text-gray-600 italic">No content available for this tab.</span>
            )}
          </pre>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Place <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">{filename}</code> at
        the root of your docs site (e.g.{' '}
        <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">
          https://yourdocs.com/{filename}
        </code>
        ).
      </p>
    </div>
  );
}
