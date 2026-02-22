import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DocsForAI — Score Your Documentation AI-Readiness',
  description:
    'Find out if AI agents can understand and use your documentation. Get a score, actionable recommendations, and an auto-generated llms.txt file.',
  keywords: ['AI documentation', 'llms.txt', 'developer docs', 'AI agent', 'documentation score'],
  openGraph: {
    title: 'DocsForAI — Score Your Documentation AI-Readiness',
    description:
      'Find out if AI agents can understand and use your documentation. Free analysis in seconds.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-gray-950 text-white antialiased`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
