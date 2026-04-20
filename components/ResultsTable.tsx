import type { JobResult } from "@/types";

interface ResultsTableProps {
  jobs: JobResult[];
  loading?: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 9
      ? "text-green-700 bg-green-50"
      : score >= 7
        ? "text-blue-700 bg-blue-50"
        : "text-gray-600 bg-gray-100";
  return (
    <span className={`inline-block px-2 py-0.5 rounded font-bold text-sm ${color}`}>
      {score}/10
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function ResultsTable({ jobs, loading }: ResultsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left border-b border-gray-200">
            <th className="px-4 py-3 font-semibold text-gray-700">Role</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Company</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Posted</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Source</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Match Score</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Apply</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : jobs.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                No matching jobs found. Try adjusting your regions or timeframe.
              </td>
            </tr>
          ) : (
            jobs.map((job, i) => (
              <tr
                key={i}
                className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {job.role}
                </td>
                <td className="px-4 py-3 text-gray-600">{job.company}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(job.postedAt).toLocaleDateString("en-IL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-gray-500">{job.source}</td>
                <td className="px-4 py-3">
                  <ScoreBadge score={job.score} />
                </td>
                <td className="px-4 py-3">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    Apply →
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
