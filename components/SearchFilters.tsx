"use client";

import { REGIONS, TIMEFRAMES } from "@/lib/constants";

interface SearchFiltersProps {
  selectedRegions: string[];
  selectedTimeframe: string;
  onRegionsChange: (regions: string[]) => void;
  onTimeframeChange: (timeframe: string) => void;
}

export default function SearchFilters({
  selectedRegions,
  selectedTimeframe,
  onRegionsChange,
  onTimeframeChange,
}: SearchFiltersProps) {
  const toggleRegion = (region: string) => {
    onRegionsChange(
      selectedRegions.includes(region)
        ? selectedRegions.filter((r) => r !== region)
        : [...selectedRegions, region]
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-semibold text-sm text-gray-700 mb-3">Regions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {REGIONS.map((region) => (
            <label
              key={region}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selectedRegions.includes(region)}
                onChange={() => toggleRegion(region)}
                className="w-4 h-4 accent-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">{region}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="font-semibold text-sm text-gray-700 mb-3">Timeframe</p>
        <div className="flex flex-wrap gap-4">
          {TIMEFRAMES.map((tf) => (
            <label
              key={tf.value}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="radio"
                name="timeframe"
                value={tf.value}
                checked={selectedTimeframe === tf.value}
                onChange={() => onTimeframeChange(tf.value)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700">{tf.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
