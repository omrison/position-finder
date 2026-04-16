import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getOpenAI } from "@/lib/openai";
import { extractCvText } from "@/lib/extractCvText";
import type { CandidateProfile } from "@/types";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("cv") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No CV file provided" }, { status: 400 });
  }

  const allowed = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF and DOCX files are supported" },
      { status: 400 }
    );
  }

  const text = await extractCvText(file);

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a CV analyzer. Extract structured information from CVs and return only valid JSON.",
      },
      {
        role: "user",
        content: `Analyze this CV and return JSON with exactly these fields:
{
  "skills": ["list of technical and professional skills"],
  "experience": "brief summary of total experience (2-3 sentences)",
  "seniority": "junior" | "mid" | "senior" | "lead",
  "roleTypes": ["list of suitable role types, e.g. Software Engineer, Product Manager"]
}

CV text:
${text}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const profile = JSON.parse(
    completion.choices[0].message.content ?? "{}"
  ) as CandidateProfile;

  return NextResponse.json(profile);
}
