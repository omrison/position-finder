# Implementation Plan: Job Finder

**PRD Reference:** prompt.md
**Date:** 2026-04-16
**Affected Repos:** position-finder (single repo)
**Total Tasks:** 8
**Estimated Effort:** ~12–18 hours

---

## Architecture Overview

This is a Next.js 14+ (App Router) full-stack application. The frontend is a
single-page form with CV upload, region checkboxes, and a timeframe selector.
On submit, the UI calls two backend API routes in sequence: first `/api/analyze-cv`
to parse the resume via OpenAI, then `/api/search-jobs` to fetch and score
job listings.

Job listings are sourced through Apify scrapers (LinkedIn Jobs + Israeli job
boards). The raw listings are passed to OpenAI GPT-4o in batches to produce a
match score (1–10) per job against the parsed CV profile. Only jobs scoring 7+
are returned, capped at 100, sorted by posting date then score.

Environment variables gate all external API credentials (OpenAI, Apify). No
authentication is required for this app.

**Data flow:**
1. User uploads CV + selects regions + selects timeframe → Submit
2. `POST /api/analyze-cv` → extract text from PDF/DOCX → OpenAI → structured profile
3. `POST /api/search-jobs` → Apify scrapers (filtered by region/timeframe) → raw jobs
4. OpenAI batch scoring → filter score >= 7 → sort → return top 100
5. Frontend renders results table

---

## Prerequisites

- Node.js 18+
- OpenAI API key (`OPENAI_API_KEY`)
- Apify API token (`APIFY_API_TOKEN`)
- Identify which Apify actors to use for LinkedIn Jobs and Israeli job boards
  (e.g. `bebity/linkedin-jobs-scraper`, `vaclavrut/jobs-il`)

---

## Task Breakdown

### Task 1: Project Initialization

- **Description:** Bootstrap the Next.js project with TypeScript, Tailwind CSS, and all required dependencies.
- **Affected files:**
  - `package.json` — create
  - `tsconfig.json` — create
  - `tailwind.config.ts` — create
  - `.env.local.example` — create
  - `next.config.ts` — create
- **Approach:**
  1. Run `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir`
  2. Install: `openai apify-client pdf-parse mammoth react-hook-form`
  3. Create `.env.local.example` with `OPENAI_API_KEY=` and `APIFY_API_TOKEN=`
- **Validation:**
  - [ ] `npm run dev` starts without errors
  - [ ] App loads at `localhost:3000`
- **Dependencies:** None
- **Effort:** S

---

### Task 2: CV Upload Component

- **Description:** File upload UI that accepts PDF and DOCX files and passes the file to the form state.
- **Affected files:**
  - `components/CvUpload.tsx` — create
- **Approach:**
  1. Create a controlled `<input type="file" accept=".pdf,.docx">` component
  2. Show filename after selection; show error if wrong file type
  3. Expose `onChange(file: File)` prop for parent form
- **Validation:**
  - [ ] Accepts PDF and DOCX
  - [ ] Rejects other file types with a visible error
  - [ ] Displays selected filename
- **Dependencies:** Task 1
- **Effort:** S

---

### Task 3: Search Filters Component

- **Description:** Region checkboxes and timeframe multi-select combobox.
- **Affected files:**
  - `components/SearchFilters.tsx` — create
  - `lib/constants.ts` — create (region list, timeframe options)
- **Approach:**
  1. Define regions in `lib/constants.ts`:
     `Tel Aviv, Jerusalem, Haifa, Beer Sheva, Ramat Gan, Petah Tikva, Rishon LeZion, Herzliya, Netanya, Eilat, Remote`
  2. Render checkboxes for each region (all unchecked by default)
  3. Render a `<select multiple>` or custom combobox for timeframe: `24h`, `48h`, `week`
  4. Expose selected values via props/callback
- **Validation:**
  - [ ] All 11 region checkboxes render
  - [ ] Multiple regions can be selected simultaneously
  - [ ] Timeframe combobox allows multi-select
- **Dependencies:** Task 1
- **Effort:** S

---

### Task 4: CV Parsing API Route

- **Description:** Server-side route that extracts text from an uploaded CV and uses OpenAI to return a structured candidate profile.
- **Affected files:**
  - `app/api/analyze-cv/route.ts` — create
  - `lib/extractCvText.ts` — create
  - `lib/openai.ts` — create (shared OpenAI client)
- **Approach:**
  1. Accept `multipart/form-data` with the CV file
  2. In `extractCvText.ts`: use `pdf-parse` for PDFs, `mammoth` for DOCX
  3. Send extracted text to OpenAI GPT-4o with a structured prompt:
     ```
     Analyze this CV and return JSON with:
     { skills: string[], experience: string, seniority: "junior"|"mid"|"senior"|"lead", roleTypes: string[] }
     ```
  4. Return the parsed JSON profile
- **Validation:**
  - [ ] POST with a PDF returns a valid profile JSON
  - [ ] POST with a DOCX returns a valid profile JSON
  - [ ] Unsupported file type returns 400
- **Dependencies:** Task 1
- **Effort:** M

---

### Task 5: Job Search via Apify

- **Description:** Server-side utility that queries Apify scrapers for job listings filtered by region and timeframe.
- **Affected files:**
  - `lib/apify.ts` — create
- **Approach:**
  1. Initialize `apify-client` with `APIFY_API_TOKEN`
  2. Run the LinkedIn Jobs actor (`bebity/linkedin-jobs-scraper`) with location and date filters
  3. Run an Israeli job board actor (e.g. `vaclavrut/jobs-il` or equivalent) with the same filters
  4. Merge results; deduplicate by job URL
  5. Post-filter: discard jobs outside the selected timeframe (compare `postedAt` to `Date.now() - timeframeMs`)
  6. Return array of `{ role, company, postedAt, source, url, description }`
- **Validation:**
  - [ ] Returns job listings for "Tel Aviv" + "24h"
  - [ ] No duplicate job URLs in results
  - [ ] Jobs outside the timeframe are excluded
- **Dependencies:** Task 1
- **Effort:** M

---

### Task 6: Match Scoring via OpenAI

- **Description:** Score each job listing against the candidate profile and filter/sort results.
- **Affected files:**
  - `lib/scoreJobs.ts` — create
  - `app/api/search-jobs/route.ts` — create
- **Approach:**
  1. Accept `{ profile, regions, timeframe }` in the request body
  2. Call `apify.ts` to fetch raw jobs
  3. Batch jobs into groups of 10 to avoid token limits
  4. For each batch, call OpenAI with a prompt:
     ```
     Given this candidate profile: {profile}
     Score each job 1-10 for likelihood of acceptance (not just fit).
     Be strict — only give 8+ for near-perfect matches.
     Jobs: [{role, company, description}]
     Return: [{ index, score, reason }]
     ```
  5. Filter scores >= 7, cap at 100, sort by `postedAt` DESC then `score` DESC
- **Validation:**
  - [ ] Returns only jobs with score >= 7
  - [ ] Result count never exceeds 100
  - [ ] Sorted correctly (newest first, then highest score)
  - [ ] Scoring is consistent across runs (same job, same profile → same score ±1)
- **Dependencies:** Tasks 4, 5
- **Effort:** M

---

### Task 7: Results Table Component

- **Description:** Render the scored job results in a sortable table.
- **Affected files:**
  - `components/ResultsTable.tsx` — create
- **Approach:**
  1. Accept `jobs: JobResult[]` prop
  2. Render columns: `Role | Company | Posting Date | Source | Match Score | Application Link`
  3. `Application Link` renders as a clickable "Apply" anchor (`target="_blank"`)
  4. Render a loading skeleton while results are being fetched
  5. Render an empty state message if no jobs match
- **Validation:**
  - [ ] All 6 columns render correctly
  - [ ] Apply links open in a new tab
  - [ ] Loading state shows while API call is in progress
  - [ ] Empty state shows when no results
- **Dependencies:** Task 1
- **Effort:** S

---

### Task 8: Main Page Integration

- **Description:** Wire all components together on the home page with form state management and API call orchestration.
- **Affected files:**
  - `app/page.tsx` — modify
  - `app/layout.tsx` — modify (title, metadata)
  - `types/index.ts` — create (shared TypeScript types)
- **Approach:**
  1. Define shared types in `types/index.ts`: `CandidateProfile`, `JobResult`, `SearchFilters`
  2. On submit: POST CV to `/api/analyze-cv`, then POST profile+filters to `/api/search-jobs`
  3. Show a progress indicator during fetching (step 1: "Analyzing CV…", step 2: "Searching jobs…")
  4. Render `<ResultsTable>` with results or error message on failure
  5. Disable submit button while loading
- **Validation:**
  - [ ] Full happy-path flow works end-to-end with a real CV
  - [ ] Error from either API route surfaces as a user-visible message
  - [ ] Submit is disabled while loading
  - [ ] Results table updates after each new search
- **Dependencies:** Tasks 2, 3, 6, 7
- **Effort:** M

---

## Testing Strategy

### Unit Tests
- `lib/extractCvText.ts` — test PDF and DOCX extraction with fixture files
- `lib/scoreJobs.ts` — test filtering (score < 7 excluded), capping (> 100 excluded), sorting logic

### Integration Tests
- `POST /api/analyze-cv` — test with a real PDF fixture, assert profile shape
- `POST /api/search-jobs` — test with mocked Apify + OpenAI responses

### Manual Verification
- Upload a real CV, select 2–3 regions, select 24h, submit, verify table renders with valid jobs and scores

---

## Rollback Plan

- This is a stateless app with no database. Rolling back means redeploying the previous build.
- No migrations to reverse.
- If Apify or OpenAI keys are invalid, the app fails gracefully with a user-visible error — no data corruption risk.

---

## Checklist Summary

- [ ] Task 1: Project initialization
- [ ] Task 2: CV upload component
- [ ] Task 3: Search filters component
- [ ] Task 4: CV parsing API route
- [ ] Task 5: Job search via Apify
- [ ] Task 6: Match scoring via OpenAI
- [ ] Task 7: Results table component
- [ ] Task 8: Main page integration
- [ ] End-to-end happy path tested with a real CV
- [ ] Environment variables documented in `.env.local.example`
