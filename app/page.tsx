"use client";

import { useState } from "react";
import CvUpload from "@/components/CvUpload";
import SearchFilters from "@/components/SearchFilters";
import ResultsTable from "@/components/ResultsTable";
import type { CandidateProfile, JobResult, SearchStats } from "@/types";

type Step = "idle" | "analyzing" | "searching" | "done" | "error";

function Stat({
  label,
  value,
  color,
  filtered,
}: {
  label: string;
  value: number;
  color: "gray" | "orange" | "blue";
  filtered?: boolean;
}) {
  const valueClass =
    color === "blue"
      ? "text-blue-700 font-bold"
      : color === "orange"
        ? "text-orange-600 font-semibold"
        : "text-gray-700 font-semibold";
  return (
    <div className="flex flex-col items-center min-w-[80px]">
      <span className={`text-lg ${valueClass}`}>
        {filtered && value > 0 ? `−${value}` : value}
      </span>
      <span className="text-xs text-gray-400 text-center leading-tight mt-0.5">
        {label}
      </span>
    </div>
  );
}

function Arrow() {
  return <span className="text-gray-300 self-center text-lg">→</span>;
}

export default function Home() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("24h");
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLoading = step === "analyzing" || step === "searching";

  const canSubmit =
    cvFile !== null &&
    selectedRegions.length > 0 &&
    !!selectedTimeframe &&
    !isLoading;

  const handleSubmit = async () => {
    if (!cvFile) return;
    setErrorMessage(null);
    setJobs([]);
    setStats(null);

    try {
      // Step 1: Analyze CV
      setStep("analyzing");
      const formData = new FormData();
      formData.append("cv", cvFile);

      const profileRes = await fetch("/api/analyze-cv", {
        method: "POST",
        body: formData,
      });

      if (!profileRes.ok) {
        const err = (await profileRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to analyze CV");
      }

      const profile = (await profileRes.json()) as CandidateProfile;

      // Step 2: Search and score jobs
      setStep("searching");
      const timeframe = selectedTimeframe;

      const jobsRes = await fetch("/api/search-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, regions: selectedRegions, timeframe }),
      });

      if (!jobsRes.ok) {
        const err = (await jobsRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to search jobs");
      }

      const { jobs: found, stats: foundStats } = (await jobsRes.json()) as {
        jobs: JobResult[];
        stats: SearchStats;
      };
      setJobs(found);
      setStats(foundStats);
      setStep("done");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setStep("error");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Position Finder</h1>
          <p className="text-gray-500 mt-1">
            Upload your CV and find your best-matched open positions in Israel.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-6">
          <CvUpload onChange={setCvFile} />
          <hr className="border-gray-100" />
          <SearchFilters
            selectedRegions={selectedRegions}
            selectedTimeframe={selectedTimeframe}
            onRegionsChange={setSelectedRegions}
            onTimeframeChange={setSelectedTimeframe}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Searching…" : "Find Jobs"}
            </button>
          </div>
        </div>

        {/* Progress indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>
              {step === "analyzing"
                ? "Analyzing your CV…"
                : "Searching and scoring jobs — this may take a minute…"}
            </span>
          </div>
        )}

        {/* Error */}
        {step === "error" && errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Results */}
        {(step === "done" || step === "searching") && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-800">Results</h2>

            {/* Stats bar */}
            {step === "done" && stats && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4 text-sm">
                <Stat label="Scraped" value={stats.scraped} color="gray" />
                <Arrow />
                <Stat
                  label="Duplicates removed"
                  value={stats.duplicatesRemoved}
                  color="orange"
                  filtered
                />
                <Arrow />
                <Stat
                  label="Outside regions"
                  value={stats.outsideRegions}
                  color="orange"
                  filtered
                />
                <Arrow />
                <Stat label="Scored" value={stats.scored} color="gray" />
                <Arrow />
                <Stat
                  label="Score below 7"
                  value={stats.belowThreshold}
                  color="orange"
                  filtered
                />
                {stats.capped > 0 && (
                  <>
                    <Arrow />
                    <Stat
                      label="Capped at 100"
                      value={stats.capped}
                      color="orange"
                      filtered
                    />
                  </>
                )}
                <Arrow />
                <Stat label="Shown" value={stats.shown} color="blue" />
              </div>
            )}

            <ResultsTable jobs={jobs} loading={step === "searching"} />
          </div>
        )}
      </div>
    </main>
  );
}
