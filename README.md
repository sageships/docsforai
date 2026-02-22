# 🧠 DocsForAI

**AI-readiness score for your developer docs. PageSpeed Insights for the agent economy.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## What is DocsForAI?

DocsForAI scans your developer documentation and gives it an AI-readiness score from 0–100. It tells you exactly how well your docs are structured for AI agents, LLMs, and tools like ChatGPT, Cursor, and GitHub Copilot to understand and recommend.

AI agents increasingly choose which tools and APIs to use based on the quality of the documentation they can parse. If your docs aren't structured for machine consumption, you're invisible to the agent economy. **Resend's #3 acquisition channel is now ChatGPT referrals** — that's the opportunity.

DocsForAI helps you understand your docs' current state, generates a spec-compliant `llms.txt` file, and gives you a prioritized list of improvements to make.

---

## Features

- 🔍 **AI-Readiness Score (0–100)** — Composite score across 5 weighted categories
- 📝 **llms.txt Generator** — Auto-generates a spec-compliant `llms.txt` file for your docs site
- 💡 **Actionable Recommendations** — Prioritized, specific suggestions to improve your score
- 📊 **Dashboard with Scan History** — Track your docs quality over time (requires sign-in)
- 🔐 **Authentication** — Secure accounts via Clerk with free and pro tiers
- 🏷️ **Embeddable Score Badges** — Show off your AI-readiness score in your own README

---

<!-- TODO: Add screenshots -->

---

## Scoring Categories

Your AI-readiness score is made up of five categories, each worth up to 20 points:

| Category | Points | What It Measures |
|---|---|---|
| **Structure** | 0–20 | Page hierarchy, headings, navigation clarity, and how well the docs are organized for machine parsing |
| **Code Quality** | 0–20 | Presence of code examples, language annotations, copyable snippets, and API reference completeness |
| **Query-ability** | 0–20 | How easily an LLM can answer common developer questions from your docs (semantic richness, search clarity) |
| **AI-SEO** | 0–20 | Metadata quality, `llms.txt` presence, semantic HTML, and other signals that help AI crawlers index your docs |
| **Freshness** | 0–20 | Recency of content, changelog presence, version labeling, and how up-to-date the docs appear |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- A free [Neon](https://neon.tech) PostgreSQL database
- A free [Clerk](https://clerk.com) account (for auth)

### 1. Clone the repo

```bash
git clone https://github.com/sageships/docsforai.git
cd docsforai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Then edit `.env` and fill in:

```env
# Neon PostgreSQL — create a free DB at neon.tech
DATABASE_URL="postgresql://..."

# Clerk — create an app at clerk.com, copy from dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# OpenAI — optional, enables Query-ability scoring
OPENAI_API_KEY="sk-..."
```

### 4. Set up the database

```bash
npx prisma db push
npx prisma generate
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How to Use

1. **Paste any docs URL** on the homepage (e.g. `https://docs.stripe.com`)
2. **Wait for the scan** to complete — usually 30–60 seconds
3. **View your AI-readiness score** with a full category breakdown
4. **Download the generated `llms.txt`** and add it to your docs site
5. **Follow the recommendations** to improve your score
6. **Sign up** to save scans and track your docs quality over time

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) | Full-stack React framework (App Router) |
| [TypeScript](https://www.typescriptlang.org/) | Type safety throughout |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling |
| [Prisma](https://www.prisma.io/) | Type-safe ORM |
| [Neon](https://neon.tech/) | Serverless PostgreSQL |
| [Clerk](https://clerk.com/) | Authentication & user management |
| [Zustand](https://github.com/pmndrs/zustand) | Lightweight client state management |
| [Cheerio](https://cheerio.js.org/) | HTML parsing for the crawler |

---

## Project Structure

```
src/
├── app/                  # Next.js pages & API routes
│   ├── api/              # Backend API handlers
│   ├── dashboard/        # Scan history dashboard
│   ├── results/[id]/     # Scan results page
│   └── sign-in|sign-up/  # Auth pages (Clerk)
├── components/           # React components
│   ├── ScoreCard.tsx     # Main score display
│   ├── ScoreBreakdown.tsx # Per-category breakdown
│   ├── Recommendations.tsx
│   ├── LlmsTxtPreview.tsx
│   └── ScoreBadge.tsx
├── lib/                  # Core logic
│   ├── crawler.ts        # Docs site crawler
│   ├── scorer.ts         # Scoring engine
│   ├── llmstxt-generator.ts
│   └── recommendations.ts
├── store/                # Zustand state management
│   └── scan-store.ts
└── types/                # TypeScript types
    └── index.ts
```

---

## Available Scripts

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Lint with ESLint (zero warnings)
npm run lint:fix     # Auto-fix lint issues
npm run format       # Format with Prettier
npm run typecheck    # TypeScript type checking
npm run validate     # Run typecheck + lint + format check (run before PRs)
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/scan` | Start a new scan for a given URL |
| `GET` | `/api/scan/[id]` | Get scan results by scan ID |
| `POST` | `/api/generate-llmstxt` | Generate an `llms.txt` file for a URL |

### Example: Start a Scan

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com"}'
```

---

## Contributing

Contributions are welcome! Here's the workflow:

1. **Fork** the repository
2. **Create a branch** — `git checkout -b feat/your-feature`
3. **Make your changes** and write clear commit messages
4. **Run validation** before pushing — `npm run validate`
5. **Open a Pull Request** against `main`

Please keep PRs focused and small. One feature or fix per PR.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

## Built for the agent economy 🤖

AI agents are the new search engines. The teams that optimize their docs for machines today will win developer mindshare tomorrow. DocsForAI helps you get there.

---

*Made with ☕ and a healthy obsession with developer tooling.*
