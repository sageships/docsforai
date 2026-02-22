'use client';

import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const FEATURES = [
  {
    icon: '🎯',
    title: 'AI Readiness Score',
    description:
      'Get a 0–100 score across 6 dimensions: structure, code quality, searchability, SEO, freshness, and llms.txt presence.',
    gradient: 'from-violet-500/20 to-purple-500/20',
    border: 'border-violet-500/30',
  },
  {
    icon: '⚡',
    title: 'Actionable Recommendations',
    description:
      'Receive prioritized, specific fixes that will have the biggest impact on AI agent discoverability and usability.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/30',
  },
  {
    icon: '🤖',
    title: 'llms.txt Generator',
    description:
      'Auto-generate a ready-to-deploy llms.txt file that tells AI agents exactly what your product does and how to use it.',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/30',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Paste Your Docs URL',
    description:
      'Enter the URL of your documentation site — we support any public docs, from GitBook to custom sites.',
    icon: '🔗',
  },
  {
    number: '02',
    title: 'We Crawl & Analyze',
    description:
      'Our AI-powered crawler reads your docs the same way an AI agent would, scoring each page across key dimensions.',
    icon: '🕷️',
  },
  {
    number: '03',
    title: 'Get Your Score & Fix It',
    description:
      'Receive a detailed report with your score, specific recommendations, and a downloadable llms.txt in under 60 seconds.',
    icon: '📊',
  },
];

const SCORES = [
  { label: 'Structure', score: 92, color: 'bg-violet-500' },
  { label: 'Code Examples', score: 78, color: 'bg-blue-500' },
  { label: 'Searchability', score: 65, color: 'bg-cyan-500' },
  { label: 'SEO', score: 88, color: 'bg-emerald-500' },
  { label: 'Freshness', score: 71, color: 'bg-yellow-500' },
];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a documentation URL');
      return;
    }

    let parsedUrl = url.trim();
    if (!parsedUrl.startsWith('http://') && !parsedUrl.startsWith('https://')) {
      parsedUrl = 'https://' + parsedUrl;
    }

    try {
      new URL(parsedUrl);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsedUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start scan');
      }

      const data = await res.json();
      router.push(`/results/${data.scanId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center text-sm font-bold">
            D
          </div>
          <span className="text-lg font-semibold tracking-tight">DocsForAI</span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="#how-it-works"
            className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block"
          >
            How it works
          </Link>
          <Link
            href="#features"
            className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block"
          >
            Features
          </Link>
          <SignedOut>
            <Link
              href="/sign-in"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm bg-white text-gray-950 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Get started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center pt-24 pb-20 px-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-8">
          <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
          AI agents are choosing tools based on docs quality
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
          Is your{' '}
          <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            documentation
          </span>
          <br />
          AI-ready?
        </h1>

        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          AI agents like Claude, GPT-4, and Gemini pick tools based on how well they can understand
          your docs. Score your documentation and get a roadmap to the top.
        </p>

        {/* URL Input */}
        <form onSubmit={handleScan} className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <span className="text-gray-500">🔗</span>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.yourproduct.com"
                className="w-full bg-gray-900 border border-gray-700/60 rounded-xl pl-10 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all text-lg"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning...
                </span>
              ) : (
                'Scan Now →'
              )}
            </button>
          </div>
          {error && <p className="mt-3 text-red-400 text-sm text-left">{error}</p>}
          <p className="mt-3 text-gray-500 text-sm">
            Free scan · No account required · Results in ~60 seconds
          </p>
        </form>

        {/* Sample score preview */}
        <div className="mt-16 bg-gray-900/60 backdrop-blur-sm border border-gray-700/40 rounded-2xl p-6 max-w-sm mx-auto text-left">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">docs.stripe.com</span>
            <span className="text-2xl font-bold text-emerald-400">87</span>
          </div>
          <div className="space-y-3">
            {SCORES.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{item.label}</span>
                  <span>{item.score}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700/40">
            <span className="text-xs text-gray-500">Sample report preview</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need to win at AI discoverability
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Three powerful tools that turn your documentation from invisible to unstoppable.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`relative bg-gradient-to-br ${feature.gradient} border ${feature.border} rounded-2xl p-8 hover:scale-[1.02] transition-transform duration-200`}
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 py-24 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
          <p className="text-gray-400 text-lg">
            From URL to actionable insights in under a minute.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.number} className="relative text-center">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-gray-700 to-transparent" />
              )}
              <div className="w-16 h-16 bg-gray-900 border border-gray-700/60 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                {step.icon}
              </div>
              <div className="text-xs font-mono text-gray-600 mb-2">{step.number}</div>
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="relative z-10 py-20 px-6 max-w-5xl mx-auto text-center">
        <p className="text-gray-500 text-sm uppercase tracking-widest mb-4 font-medium">
          Built for teams who care about developer experience
        </p>
        <p className="text-gray-600 text-sm">
          Join developers optimizing their docs for the AI-first era.
        </p>
      </section>

      {/* CTA banner */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-violet-600/20 via-blue-600/20 to-cyan-600/20 border border-violet-500/20 rounded-3xl p-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to make your docs AI-readable?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Join hundreds of teams already optimizing their documentation for the AI-first era.
          </p>
          <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.yourproduct.com"
              className="flex-1 bg-gray-950/80 border border-gray-700/60 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/60 transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-white text-gray-950 px-6 py-3.5 rounded-xl font-semibold hover:bg-gray-100 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? 'Scanning...' : 'Free Scan →'}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/60 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center text-xs font-bold">
              D
            </div>
            <span className="font-semibold">DocsForAI</span>
            <span className="text-gray-600 text-sm ml-2">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-gray-500">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
            >
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
