"use client";

import { useRef, useState } from "react";

interface CvUploadProps {
  onChange: (file: File | null) => void;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function CvUpload({ onChange }: CvUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);

    if (!file) {
      setFileName(null);
      onChange(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PDF and DOCX files are supported.");
      setFileName(null);
      onChange(null);
      e.target.value = "";
      return;
    }

    setFileName(file.name);
    onChange(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="font-semibold text-sm text-gray-700">
        Upload CV (PDF or DOCX)
      </label>
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={handleChange}
        />
        {fileName ? (
          <p className="text-green-600 font-medium">✓ {fileName}</p>
        ) : (
          <div className="text-gray-400">
            <p className="text-2xl mb-1">📄</p>
            <p>Click to upload your CV</p>
            <p className="text-xs mt-1">PDF or DOCX</p>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
