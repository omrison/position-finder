# Position Finder

Upload your CV and discover the Israeli tech jobs most likely to accept you — scored by AI.

## What it does

1. **Sign in** with your Google account
2. **Upload your CV** (PDF or DOCX)
3. **Select regions** across Israel (Tel Aviv, Jerusalem, Haifa, and 8 more) + Remote
4. **Choose a timeframe** — last 24 hours, 48 hours, or week
5. Hit **Find Jobs** — the app:
   - Parses your CV with OpenAI to extract skills, experience, seniority, and suitable role types
   - Searches Indeed Israel for matching positions in your selected regions
   - Scores each job 1–10 for likelihood of acceptance (not just keyword fit) using GPT-4o
   - Returns only jobs scoring 7 or higher, sorted by most recent then highest score

Results are shown in a table with Role, Company, Posted date, Source, Match Score, and a direct Apply link. A stats bar shows how many positions were found, how many were filtered and why (duplicates, outside timeframe, below score threshold). Your total search count is shown in the header.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| Auth | NextAuth v5 + Google OAuth |
| Database | PostgreSQL via Prisma 7 |
| CV parsing & scoring | OpenAI GPT-4o |
| Job scraping | Apify — `misceres/indeed-scraper` |
| CV text extraction | pdf-parse + mammoth |
| Testing | Playwright (30 E2E tests) |
| Language | TypeScript |

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/position_finder
OPENAI_API_KEY=sk-...
APIFY_API_TOKEN=apify_api_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AUTH_SECRET=...          # run: npx auth secret
```

- **OpenAI key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Apify token**: [console.apify.com/account/integrations](https://console.apify.com/account/integrations)
- **Google credentials**: [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application). Add `http://localhost:3000/api/auth/callback/google` as an Authorized redirect URI.

> **Apify cost**: the Indeed scraper charges ~$0.006 per result. A typical search across 2–3 regions at 50 results each costs ~$0.60–$1.00.

### 3. Run database migrations

```bash
npx prisma migrate dev
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Render)

### Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Internal connection string from your Render PostgreSQL instance |
| `OPENAI_API_KEY` | From platform.openai.com |
| `APIFY_API_TOKEN` | From console.apify.com |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `AUTH_SECRET` | Generate with `npx auth secret` |
| `AUTH_URL` | `https://your-app.onrender.com` |
| `AUTH_TRUST_HOST` | `true` |

### Google OAuth redirect URI

In Google Cloud Console → Credentials → your OAuth client, add:

```
https://your-app.onrender.com/api/auth/callback/google
```

### Pre-deploy command

Set the following as a Pre-Deploy Command in Render to run migrations on each deploy:

```bash
npm run db:migrate
```

## E2E tests

```bash
npm run test:e2e
```

Tests run against a local dev server on port 3000. Set `AUTH_SECRET=test-auth-secret-for-e2e-only` in `.env.local` so the test session cookie is accepted by the server.

## Project structure

```
app/
  api/
    analyze-cv/route.ts        # POST: parse CV via OpenAI
    search-jobs/route.ts       # POST: scrape + score + record operation
    auth/[...nextauth]/route.ts # Google OAuth handlers
  login/page.tsx               # Sign-in page
  page.tsx                     # Main UI
  layout.tsx                   # Header with user email + search count
components/
  CvUpload.tsx                 # File upload (PDF/DOCX)
  SearchFilters.tsx            # Region checkboxes + timeframe radio
  ResultsTable.tsx             # Results table with loading skeleton
lib/
  db.ts                        # Prisma client singleton
  dal.ts                       # Data access layer (recordOperation, getUserOperationCount)
  apify.ts                     # Apify scraper integration
  scoreJobs.ts                 # OpenAI batch scoring logic
  extractCvText.ts             # PDF/DOCX text extraction
  openai.ts                    # OpenAI client factory
  ratelimit.ts                 # In-memory rate limiter
  constants.ts                 # Regions and timeframe options
prisma/
  schema.prisma                # User, Account, Operation models
e2e/
  auth.spec.ts                 # Auth flow tests (redirect, login page, header)
  page.spec.ts                 # Home page structure and form validation
  job-search.spec.ts           # Happy path search flow
  error-states.spec.ts         # API error handling
types/
  index.ts                     # Shared TypeScript types
```

## Scoring rules

- Only jobs with a match score of **7 or higher** are shown
- Maximum **100 results** per search
- Scoring is intentionally strict — 9–10 is a near-perfect match, 7–8 is a strong match
- Results are sorted: **most recent first**, then **highest score**
