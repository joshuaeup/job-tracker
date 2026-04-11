import type { RawJob, NormalizedJob } from "../types/index.js";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-");
}

function isRemote(location: string): boolean {
  return /remote/i.test(location);
}

function parseLocation(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw !== null && typeof raw === "object" && "name" in raw) {
    const name = (raw as Record<string, unknown>)["name"];
    return typeof name === "string" ? name : "";
  }
  return "";
}

function parseSalary(compensation: unknown): { min: number | null; max: number | null } {
  if (!compensation || typeof compensation !== "object") {
    return { min: null, max: null };
  }
  const c = compensation as Record<string, unknown>;
  const rawMin = c["min_value"] ?? c["minValue"];
  const rawMax = c["max_value"] ?? c["maxValue"];
  return {
    min: typeof rawMin === "number" ? rawMin : null,
    max: typeof rawMax === "number" ? rawMax : null,
  };
}

function normalizeGreenhouse(job: RawJob): NormalizedJob {
  const r = job.raw;
  const idRaw = String(r["id"] ?? "");
  const title = String(r["title"] ?? "");
  const location = parseLocation(r["location"]);
  const url = String(r["absolute_url"] ?? "");
  const departments = Array.isArray(r["departments"]) ? r["departments"] : [];
  const firstDept = departments[0];
  const department =
    firstDept !== undefined && typeof firstDept === "object" && firstDept !== null
      ? String((firstDept as Record<string, unknown>)["name"] ?? "")
      : "";
  const postedAt =
    typeof r["updated_at"] === "string"
      ? r["updated_at"]
      : typeof r["first_published"] === "string"
        ? r["first_published"]
        : null;
  const content = r["content"];
  const descriptionHtml =
    typeof r["description"] === "string"
      ? r["description"]
      : content !== null &&
          content !== undefined &&
          typeof content === "object" &&
          typeof (content as Record<string, unknown>)["description"] === "string"
        ? String((content as Record<string, unknown>)["description"])
        : "";
  const { min, max } = parseSalary(r["salary_range"] ?? r["compensation"]);

  return {
    id: `greenhouse:${slugify(job.company)}:${idRaw}`,
    title,
    company: job.company,
    location,
    remote: isRemote(location),
    url,
    department,
    ats: "greenhouse",
    postedAt,
    salaryMin: min,
    salaryMax: max,
    descriptionText: stripHtml(descriptionHtml),
  };
}

function normalizeLever(job: RawJob): NormalizedJob {
  const r = job.raw;
  const idRaw = String(r["id"] ?? "");
  const title = String(r["text"] ?? "");
  const categories = r["categories"];
  const categoriesObj =
    categories !== null && categories !== undefined && typeof categories === "object"
      ? (categories as Record<string, unknown>)
      : null;
  const location = String(
    categoriesObj?.["location"] ?? categoriesObj?.["allLocations"] ?? ""
  );
  const url = String(r["hostedUrl"] ?? "");
  const department = String(
    categoriesObj?.["team"] ?? categoriesObj?.["department"] ?? ""
  );
  const createdAt = r["createdAt"];
  const postedAt = typeof createdAt === "number" ? new Date(createdAt).toISOString() : null;
  const descriptionText = String(r["descriptionPlain"] ?? "");
  const { min, max } = parseSalary(r["salaryRange"] ?? r["compensation"]);

  return {
    id: `lever:${slugify(job.company)}:${idRaw}`,
    title,
    company: job.company,
    location,
    remote: isRemote(location),
    url,
    department,
    ats: "lever",
    postedAt,
    salaryMin: min,
    salaryMax: max,
    descriptionText,
  };
}

function normalizeAshby(job: RawJob): NormalizedJob {
  const r = job.raw;
  const idRaw = String(r["id"] ?? "");
  const title = String(r["title"] ?? "");
  const location = parseLocation(r["location"] ?? r["locationName"]);
  const url = String(r["jobUrl"] ?? r["applyUrl"] ?? "");
  const department = String(r["departmentName"] ?? r["department"] ?? "");
  const postedAt =
    typeof r["publishedAt"] === "string"
      ? r["publishedAt"]
      : typeof r["createdAt"] === "string"
        ? r["createdAt"]
        : null;
  const descriptionHtml = String(r["descriptionHtml"] ?? r["description"] ?? "");
  const { min, max } = parseSalary(r["compensation"] ?? r["salaryRange"]);

  return {
    id: `ashby:${slugify(job.company)}:${idRaw}`,
    title,
    company: job.company,
    location,
    remote: isRemote(location) || r["isRemote"] === true,
    url,
    department,
    ats: "ashby",
    postedAt,
    salaryMin: min,
    salaryMax: max,
    descriptionText: stripHtml(descriptionHtml),
  };
}

const NORMALIZERS = {
  greenhouse: normalizeGreenhouse,
  lever: normalizeLever,
  ashby: normalizeAshby,
} as const;

export function normalize(rawJobs: RawJob[]): NormalizedJob[] {
  const results: NormalizedJob[] = [];

  for (const job of rawJobs) {
    try {
      const normalized = NORMALIZERS[job.source](job);
      if (normalized.url) {
        results.push(normalized);
      }
    } catch (err) {
      console.error(
        `[FILTER] Normalization error for ${job.company} (${job.source}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return results;
}
