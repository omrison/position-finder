# Position Finder

Upload your CV and discover the Israeli tech jobs most likely to accept you — scored by AI.

## What it does

1. **Upload your CV** (PDF or DOCX)
2. **Select regions** across Israel (Tel Aviv, Jerusalem, Haifa, and 8 more) + Remote
3. **Choose a timeframe** — last 24 hours, 48 hours, or week
4. Hit **Find Jobs** — the app:
   - Parses your CV with OpenAI to extract skills, experience, seniority, and suitable role types
   - Searches Indeed Israel for matching positions in your selected regions
   - Scores each job 1–10 for likelihood of acceptance (not just fit) using OpenAI GPT-4o
   - Returns only jobs scoring 7 or higher, sorted by most recent then highest score

Results are shown in a table with Role, Company, Posted date, Source, Match Score, and a direct Apply link. A stats bar shows how many positions were found, how many were filtered and why (duplicates, outside timeframe, below score threshold).

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| CV parsing & scoring | OpenAI GPT-4o |
| Job scraping | Apify — `misceres/indeed-scraper` |
| CV text extraction | pdf-parse + mammoth |
| Language | TypeScript |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API keys

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
OPENAI_API_KEY=sk-...
APIFY_API_TOKEN=apify_api_...
```

- **OpenAI key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Apify token**: [console.apify.com/account/integrations](https://console.apify.com/account/integrations)

> **Apify cost**: the Indeed scraper charges ~$0.006 per result. A typical search across 2–3 regions at 50 results each costs ~$0.60–$1.00.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  api/
    analyze-cv/route.ts   # POST: parse CV via OpenAI
    search-jobs/route.ts  # POST: scrape + score jobs
  page.tsx                # Main UI
components/
  CvUpload.tsx            # File upload (PDF/DOCX)
  SearchFilters.tsx       # Region checkboxes + timeframe radio
  ResultsTable.tsx        # Results table with loading skeleton
lib/
  apify.ts                # Apify scraper integration
  scoreJobs.ts            # OpenAI batch scoring logic
  extractCvText.ts        # PDF/DOCX text extraction
  openai.ts               # OpenAI client factory
  constants.ts            # Regions and timeframe options
types/
  index.ts                # Shared TypeScript types
```

## Scoring rules

- Only jobs with a match score of **7 or higher** are shown
- Maximum **100 results** per search
- Scoring is intentionally strict — 9–10 is a near-perfect match, 7–8 is a strong match
- Results are sorted: **most recent first**, then **highest score**
