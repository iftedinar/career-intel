/**
 * Career Intel — server.js v3
 *
 * Supports BOTH OpenAI and Anthropic — uses whichever key is set.
 * Integrates JSearch (RapidAPI) and Adzuna for real job listings.
 *
 * Railway env vars to set:
 *   ANTHROPIC_API_KEY  — console.anthropic.com     (optional, keep existing)
 *   OPENAI_API_KEY     — platform.openai.com        (optional, add new)
 *   JSEARCH_KEY        — rapidapi.com/jsearch        (optional, free 200/mo)
 *   ADZUNA_APP_ID      — developer.adzuna.com        (optional, free)
 *   ADZUNA_APP_KEY     — developer.adzuna.com        (optional, free)
 *   PORT               — 3001
 *
 * At least one of ANTHROPIC_API_KEY or OPENAI_API_KEY must be set.
 * If both are set, Anthropic is used (better structured JSON output).
 */

import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: "uploads/", limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) app.use(express.static(distPath));

// --- Which providers are configured? ----------------------------------------
const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY;
const HAS_OPENAI    = !!process.env.OPENAI_API_KEY;
const HAS_JSEARCH   = !!process.env.JSEARCH_KEY;
const HAS_ADZUNA    = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);

console.log(`\n  Career Intel v3
  AI:      ${HAS_ANTHROPIC ? "Anthropic ✓" : ""}${HAS_OPENAI ? " OpenAI ✓" : ""}${(!HAS_ANTHROPIC && !HAS_OPENAI) ? "NONE — add API key to Railway!" : ""}
  JSearch: ${HAS_JSEARCH ? "✓" : "not configured (optional)"}
  Adzuna:  ${HAS_ADZUNA  ? "✓" : "not configured (optional)"}\n`);

// --- Lazy-load AI SDKs -------------------------------------------------------
let _anthropic = null;
let _openai    = null;

async function getProviders() {
  if (HAS_ANTHROPIC && !_anthropic) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  if (HAS_OPENAI && !_openai) {
    const { default: OpenAI } = await import("openai");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
}

// --- Unified AI call (with optional web search for Anthropic) ---------------
async function aiComplete(prompt, maxTokens = 4000, useSearch = true) {
  await getProviders();

  // Prefer Anthropic (web search tool + better JSON)
  if (HAS_ANTHROPIC) {
    const tools = useSearch ? [{ type: "web_search_20250305", name: "web_search" }] : [];
    const resp = await _anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      ...(tools.length ? { tools } : {}),
      messages: [{ role: "user", content: prompt }],
    });
    const tb = resp.content.find((b) => b.type === "text");
    return tb?.text || "";
  }

  // Fall back to OpenAI
  if (HAS_OPENAI) {
    const resp = await _openai.chat.completions.create({
      model: "gpt-4o-mini",          // change to "gpt-4o" for higher quality
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    return resp.choices[0]?.message?.content || "";
  }

  throw new Error("No AI API key set. Add ANTHROPIC_API_KEY or OPENAI_API_KEY in Railway.");
}

// Short version for message drafting (no search needed)
async function aiShort(prompt) {
  return aiComplete(prompt, 500, false);
}

// --- Helpers -----------------------------------------------------------------
function readFile(file) {
  try {
    const raw = fs.readFileSync(file.path).toString("utf-8").replace(/[\x00-\x08\x0B-\x1F]/g, "");
    fs.unlinkSync(file.path);
    return { name: file.originalname, content: raw.slice(0, 10000) };
  } catch {
    try { fs.unlinkSync(file.path); } catch {}
    return { name: file.originalname, content: "" };
  }
}

function parseJSON(text) {
  const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const start = clean.search(/[{[]/);
  if (start === -1) return null;
  try { return JSON.parse(clean.slice(start)); } catch { return null; }
}

// --- Real job listings from JSearch (RapidAPI - free 200/mo) ----------------
async function fetchJSearch(query, location = "USA") {
  if (!HAS_JSEARCH) return [];
  try {
    const params = new URLSearchParams({
      query: `${query} internship ${location}`,
      num_pages: "1",
      date_posted: "month",
    });
    const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
      headers: {
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
        "x-rapidapi-key": process.env.JSEARCH_KEY,
      },
    });
    const data = await res.json();
    return (data.data || []).slice(0, 6).map((j) => ({
      id: j.job_id,
      title: j.job_title,
      company: j.employer_name,
      location: [j.job_city, j.job_state || j.job_country].filter(Boolean).join(", "),
      apply_url: j.job_apply_link,
      deadline: j.job_offer_expiration_datetime_utc?.split("T")[0] || "Rolling",
      remote: j.job_is_remote,
      source: "JSearch",
    }));
  } catch (e) {
    console.error("JSearch:", e.message);
    return [];
  }
}

// --- Real job listings from Adzuna (completely free) -------------------------
async function fetchAdzuna(keywords, country = "us") {
  if (!HAS_ADZUNA) return [];
  try {
    const params = new URLSearchParams({
      app_id: process.env.ADZUNA_APP_ID,
      app_key: process.env.ADZUNA_APP_KEY,
      results_per_page: 6,
      what: keywords,
    });
    const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`);
    const data = await res.json();
    return (data.results || []).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company?.display_name || "Unknown",
      location: j.location?.display_name || country.toUpperCase(),
      apply_url: j.redirect_url,
      salary: j.salary_min
        ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round((j.salary_max || j.salary_min * 1.3) / 1000)}k`
        : null,
      source: "Adzuna",
    }));
  } catch (e) {
    console.error("Adzuna:", e.message);
    return [];
  }
}

// =============================================================================
// ROUTES
// =============================================================================

// 1. Parse uploaded documents into a structured profile ----------------------
app.post("/api/parse", upload.array("files", 10), async (req, res) => {
  try {
    const docs = req.files.map(readFile).filter((d) => d.content.length > 20);
    if (!docs.length) return res.status(400).json({ error: "No readable content found." });

    const text = await aiShort(`Extract a career profile from these documents. Return ONLY valid JSON, no other text.

DOCUMENTS:
${docs.map((d) => `=== ${d.name} ===\n${d.content}`).join("\n\n")}

JSON schema:
{
  "name": "Full Name",
  "email": "email@domain.com",
  "location": "City, State",
  "university": "University Name",
  "graduation": "Month Year",
  "gpa": 3.78,
  "majors": ["Major 1", "Major 2"],
  "visa_status": "international_student",
  "work_auth": "CPT eligible",
  "skills": {
    "technical": ["Python", "SQL"],
    "tools": ["Power BI", "Tableau", "Excel"],
    "platforms": ["Workday", "Oracle", "PeopleSoft"]
  },
  "experience": [
    { "title": "Role", "company": "Company", "start": "Jun 2025", "end": "Aug 2025", "highlights": ["bullet 1"] }
  ],
  "certifications": [{ "name": "Cert Name", "issuer": "LinkedIn Learning", "date": "Nov 2025" }],
  "interests": ["fintech", "data analytics"],
  "strengths": ["Rare ERP experience at undergrad level", "Dual major in Finance + Data Analytics"],
  "summary": "2-sentence professional summary.",
  "portfolio": "https://iftedinar.github.io"
}`);

    const profile = parseJSON(text);
    if (!profile) return res.status(422).json({ error: "Could not parse documents. Try a text-based PDF." });
    res.json({ profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Find opportunities (internships + startups + grad programs) --------------
app.post("/api/opportunities", async (req, res) => {
  try {
    const { profile, filters = {} } = req.body;
    if (!profile) return res.status(400).json({ error: "Profile required." });

    const today = new Date().toISOString().split("T")[0];
    const { visaFriendly = true, location = "both", remote = false } = filters;

    // Fetch real job listings in parallel
    const keywords = `${profile.majors?.[0] || "finance"} ${profile.skills?.technical?.[0] || "data analytics"}`;
    const [jsearchJobs, adzunaJobs] = await Promise.all([
      fetchJSearch(keywords, location === "international" ? "Canada" : "USA"),
      fetchAdzuna(`${profile.interests?.[0] || "finance"} data analyst intern`,
        location === "international" ? "ca" : "us"),
    ]);

    const realJobs = [...jsearchJobs, ...adzunaJobs];
    const realCtx = realJobs.length
      ? `\n\nREAL CURRENT JOB LISTINGS — use these actual companies and apply URLs in your internships list:\n${JSON.stringify(realJobs, null, 1)}`
      : "";

    const text = await aiComplete(`You are a career intelligence AI. Today is ${today}.

CANDIDATE:
- ${profile.name} | ${profile.university} | Graduating ${profile.graduation}
- GPA: ${profile.gpa} | Visa: ${profile.visa_status} — ${profile.work_auth}
- Majors: ${profile.majors?.join(", ")}
- Skills: ${[...profile.skills?.technical||[], ...profile.skills?.tools||[], ...profile.skills?.platforms||[]].join(", ")}
- Certs: ${profile.certifications?.map(c=>c.name).join(", ") || "none"}
- Interests: ${profile.interests?.join(", ")}
- Strengths: ${profile.strengths?.join(", ")}
- Location: ${profile.location}
- Portfolio: ${profile.portfolio || "none"}
${realCtx}

Return ONLY valid JSON. No markdown. No commentary before or after.

{
  "generated_at": "${today}",
  "internships": [
    {
      "id": "unique-slug",
      "title": "Role Title",
      "company": "Company Name",
      "location": "City, ST",
      "country": "US",
      "type": "Summer 2026",
      "deadline": "YYYY-MM-DD or Rolling",
      "remote": false,
      "visa_friendly": true,
      "work_auth": "CPT/OPT",
      "apply_url": "https://actual-url.com/job",
      "salary": "$22-26/hr",
      "probability": 82,
      "prob_reason": "One sentence why this candidate matches.",
      "match_skills": ["Power BI", "Python"],
      "missing_skills": ["Machine Learning"],
      "category": "Fintech",
      "company_size": "large",
      "notes": "Specific reason this fits their background.",
      "source": "AI or JSearch or Adzuna"
    }
  ],
  "startups": [
    {
      "id": "unique-slug",
      "company": "Startup Name",
      "location": "City, ST",
      "country": "US",
      "stage": "Series B",
      "funding": "$40M Series B — Jan 2025",
      "headcount": "50-200",
      "focus": "What they build in one sentence.",
      "why_fit": "Why this candidate specifically fits.",
      "open_roles": ["Data Analyst Intern", "Finance Intern"],
      "outreach_tip": "Who to contact and what angle to use.",
      "outreach_channel": "LinkedIn DM to Head of Data",
      "website": "https://company.com",
      "linkedin_url": "https://linkedin.com/company/name",
      "careers_url": "https://company.com/careers",
      "hiring_signal": "actively hiring",
      "fit_score": 87
    }
  ],
  "grad_programs": [
    {
      "id": "unique-slug",
      "program": "MS Business Analytics",
      "degree": "MS",
      "university": "University Name",
      "location": "City, ST",
      "country": "US",
      "stem": true,
      "opt": "36 months STEM OPT",
      "duration": "12 months",
      "deadline_r1": "YYYY-MM-DD",
      "deadline_r2": "YYYY-MM-DD",
      "gre": false,
      "gmat": false,
      "avg_gpa": 3.5,
      "admit_prob": 82,
      "admit_reason": "Why this candidate is a strong applicant.",
      "tuition": 45000,
      "scholarship": true,
      "salary_after": 95000,
      "placement": 93,
      "top_employers": ["Amazon", "Deloitte", "Goldman Sachs"],
      "apply_url": "https://grad.university.edu/apply",
      "notes": "Why this program fits their specific goals."
    }
  ],
  "summary": {
    "top_action": "Single most important next step.",
    "urgent": ["Deadline alert 1", "Deadline alert 2"],
    "skill_gaps": ["Skill gap to address"],
    "highlight": ["Strength to emphasize in applications"]
  }
}

Requirements:
- 8+ internships, 6+ startups, 6+ grad programs
- Order each section by probability/fit score descending
- ${visaFriendly ? "ONLY include roles open to international students. Skip anything requiring US citizenship, permanent residency, or security clearance." : "Include all roles."}
- ${remote ? "Prioritize remote and hybrid positions." : ""}
- Use real company names and real URLs where you know them
- For internships pulled from real listings above, set source to their source value`, 4500);

    const opportunities = parseJSON(text);
    if (!opportunities) return res.status(422).json({ error: "Could not generate results. Try again." });

    if (opportunities.summary) {
      opportunities.summary.real_jobs_found = realJobs.length;
      opportunities.summary.ai_provider = HAS_ANTHROPIC ? "Anthropic Claude" : "OpenAI GPT-4o-mini";
    }

    res.json({ opportunities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Draft outreach message ---------------------------------------------------
app.post("/api/message", async (req, res) => {
  try {
    const { profile, target, type } = req.body;
    const text = await aiShort(`Write a ${type} for ${profile.name} to send to ${target.company || target.university}.
Role: ${target.title || target.program || "data/analytics position"}

Candidate facts:
- ${profile.university}, ${profile.majors?.join(" + ")}, GPA ${profile.gpa}
- Top skills: ${[...profile.skills?.technical||[], ...profile.skills?.tools||[]].slice(0,5).join(", ")}
- Experience: ${profile.experience?.slice(0,2).map(e=>`${e.title} at ${e.company}`).join(", ")}
- Portfolio: ${profile.portfolio || "https://iftedinar.github.io"}

Why this role fits: ${target.notes || target.why_fit || "strong skills match"}

Rules:
- Under 120 words total
- Reference ONE specific thing about this company or role
- Name exactly 2 skills that match
- End with a clear ask
- No "I hope this finds you well" or any cliché opener
- Sound like a real person, not AI-generated

Return ONLY the message text. Nothing else.`);

    res.json({ message: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Health check ------------------------------------------------------------
app.get("/api/health", (_, res) =>
  res.json({
    status: "ok",
    ai_provider: HAS_ANTHROPIC ? "anthropic" : HAS_OPENAI ? "openai" : "none",
    real_jobs: { jsearch: HAS_JSEARCH, adzuna: HAS_ADZUNA },
    time: new Date().toISOString(),
  })
);

// Serve React SPA for all other routes ---------------------------------------
app.get("*", (req, res) => {
  const index = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.json({ message: "API is running. Build frontend with: npm run build" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Career Intel API → http://localhost:${PORT}`));
