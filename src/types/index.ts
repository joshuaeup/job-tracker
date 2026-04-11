export type CompanyConfig = {
  name: string;
  ats: "greenhouse" | "lever" | "ashby";
  slug: string;
  enabled: boolean;
};

export type RawJob = {
  source: "greenhouse" | "lever" | "ashby";
  company: string;
  raw: Record<string, unknown>;
};

export type NormalizedJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  department: string;
  ats: "greenhouse" | "lever" | "ashby";
  postedAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  descriptionText: string;
};

export type EvaluationResult = {
  fitScore: number;
  recommendation: "apply" | "research" | "skip";
  summary: string;
  flags: string[];
};

export type ScoredJob = {
  job: NormalizedJob;
  evaluation: EvaluationResult;
};

export type RunSummary = {
  fetched: number;
  filtered: number;
  deduplicated: number;
  evaluated: number;
  logged: number;
  skipped: number;
};
