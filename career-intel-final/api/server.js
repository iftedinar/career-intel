career-intel-final/api/server.js                                                                    0000644 0000000 0000000 00000042601 15200535541 015635  0                                                                                                    ustar   root                            root                                                                                                                                                                                                                   /**
 * Career Intel — server.js v5
 *
 * ONLY uses OpenAI. Anthropic removed completely.
 * This eliminates the "credit balance too low" Anthropic error.
 *
 * REQUIRED in Railway → Variables:
 *   OPENAI_API_KEY   → get at platform.openai.com → API Keys
 *
 * OPTIONAL in Railway → Variables:
 *   JSEARCH_KEY      → rapidapi.com (search JSearch, free plan, 200 req/mo)
 *   ADZUNA_APP_ID    → developer.adzuna.com (free, no quota)
 *   ADZUNA_APP_KEY   → developer.adzuna.com (free, no quota)
 */

import express from "express";
import multer from "multer";
import cors from "cors";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: "uploads/", limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Serve built React frontend
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) app.use(express.static(distPath));

// ---------------------------------------------------------------------------
// Validate OpenAI key at startup — fail fast with a clear message
// ---------------------------------------------------------------------------
const OPENAI_KEY  = (process.env.OPENAI_API_KEY  || "").trim();
const JSEARCH_KEY = (process.env.JSEARCH_KEY      || "").trim();
const ADZUNA_ID   = (process.env.ADZUNA_APP_ID    || "").trim();
const ADZUNA_KEY  = (process.env.ADZUNA_APP_KEY   || "").trim();

const HAS_OPENAI  = OPENAI_KEY.startsWith("sk-");
const HAS_JSEARCH = JSEARCH_KEY.length > 10;
const HAS_ADZUNA  = ADZUNA_ID.length > 0 && ADZUNA_KEY.length > 0;

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Career Intel API  v5
  OpenAI key : ${HAS_OPENAI  ? "✓ found (sk-...)" : "✗ MISSING — add OPENAI_API_KEY to Railway"}
  JSearch    : ${HAS_JSEARCH ? "✓ real job listings" : "not set (optional)"}
  Adzuna     : ${HAS_ADZUNA  ? "✓ real job listings" : "not set (optional)"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Create OpenAI client — only if key looks valid
const openai = HAS_OPENAI
  ? new OpenAI({ apiKey: OPENAI_KEY })
  : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readUploadedFile(file) {
  try {
    const raw = fs
      .readFileSync(file.path)
      .toString("utf-8")
      .replace(/[\x00-\x08\x0B-\x1F]/g, "");
    fs.unlinkSync(file.path);
    return { name: file.originalname, content: raw.slice(0, 10000) };
  } catch {
    try { fs.unlinkSync(file.path); } catch {}
    return { name: file.originalname, content: "" };
  }
}

function extractJSON(text) {
  const clean = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  const start = clean.search(/[{[]/);
  if (start === -1) return null;
  try {
    return JSON.parse(clean.slice(start));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OpenAI wrapper — called by all routes
// ---------------------------------------------------------------------------
async function callAI(systemPrompt, userPrompt, maxTokens = 4000) {
  if (!openai) {
    throw new Error(
      "OPENAI_API_KEY is not set in Railway. " +
      "Go to Railway → your service → Variables → add OPENAI_API_KEY."
    );
  }
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
  });
  return res.choices[0]?.message?.content || "";
}

// ---------------------------------------------------------------------------
// Real job data — JSearch via RapidAPI (free 200 req/mo)
// ---------------------------------------------------------------------------
async function fetchJSearch(query) {
  if (!HAS_JSEARCH) return [];
  try {
    const params = new URLSearchParams({
      query: `${query} intern`,
      num_pages: "1",
      date_posted: "month",
    });
    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?${params}`,
      {
        headers: {
          "x-rapidapi-host": "jsearch.p.rapidapi.com",
          "x-rapidapi-key": JSEARCH_KEY,
        },
      }
    );
    const data = await res.json();
    return (data.data || []).slice(0, 8).map((j) => ({
      title:     j.job_title,
      company:   j.employer_name,
      location:  [j.job_city, j.job_state || j.job_country].filter(Boolean).join(", "),
      apply_url: j.job_apply_link,
      remote:    !!j.job_is_remote,
      deadline:  j.job_offer_expiration_datetime_utc?.split("T")[0] || "Rolling",
      source:    "JSearch",
    }));
  } catch (e) {
    console.error("JSearch error:", e.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Real job data — Adzuna (completely free, no quota)
// ---------------------------------------------------------------------------
async function fetchAdzuna(keywords, country = "us") {
  if (!HAS_ADZUNA) return [];
  try {
    const params = new URLSearchParams({
      app_id:           ADZUNA_ID,
      app_key:          ADZUNA_KEY,
      results_per_page: "8",
      what:             keywords,
      sort_by:          "date",
    });
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`
    );
    const data = await res.json();
    return (data.results || []).map((j) => ({
      title:    j.title,
      company:  j.company?.display_name || "",
      location: j.location?.display_name || country.toUpperCase(),
      apply_url: j.redirect_url,
      salary:   j.salary_min
        ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round((j.salary_max || j.salary_min * 1.3) / 1000)}k`
        : null,
      source: "Adzuna",
    }));
  } catch (e) {
    console.error("Adzuna error:", e.message);
    return [];
  }
}

// ===========================================================================
// ROUTES
// ===========================================================================

// ---------------------------------------------------------------------------
// POST /api/parse — upload PDFs, get structured profile back
// ---------------------------------------------------------------------------
app.post("/api/parse", upload.array("files", 10), async (req, res) => {
  try {
    const docs = req.files
      .map(readUploadedFile)
      .filter((d) => d.content.length > 20);

    if (!docs.length) {
      return res.status(400).json({
        error: "No readable content found. Make sure your PDF has selectable text, not just a scanned image.",
      });
    }

    const raw = await callAI(
      "You are a resume parser. Always return valid JSON only. Never include markdown fences or any text outside the JSON object.",
      `Extract a career profile from these documents and return it as a single JSON object.

DOCUMENTS:
${docs.map((d) => `=== ${d.name} ===\n${d.content}`).join("\n\n")}

Return this exact JSON structure (fill in real values from the documents):
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
    {
      "title": "Job Title",
      "company": "Company Name",
      "start": "Jun 2025",
      "end": "Aug 2025",
      "highlights": ["Key accomplishment"]
    }
  ],
  "certifications": [
    { "name": "Cert Name", "issuer": "LinkedIn Learning", "date": "Nov 2025" }
  ],
  "interests": ["fintech", "data analytics"],
  "strengths": ["Rare ERP experience at undergrad level", "Dual major Finance + Data Analytics"],
  "summary": "Two-sentence professional summary.",
  "portfolio": "https://iftedinar.github.io"
}`,
      2000
    );

    const profile = extractJSON(raw);
    if (!profile) {
      return res.status(422).json({
        error:
          "Could not parse profile from your documents. Make sure the PDF has selectable text (open it in a browser and try selecting text — if you can, it will work).",
      });
    }

    res.json({ profile });
  } catch (err) {
    console.error("/api/parse error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/opportunities — generate ranked opportunities
// ---------------------------------------------------------------------------
app.post("/api/opportunities", async (req, res) => {
  try {
    const { profile, filters = {} } = req.body;
    if (!profile) {
      return res.status(400).json({ error: "Profile is required." });
    }

    const today = new Date().toISOString().split("T")[0];
    const { visaFriendly = true, location = "both", remote = false } = filters;

    // Fetch real jobs in parallel (silent no-ops if keys not set)
    const skillQuery = [
      profile.majors?.[0] || "finance",
      profile.skills?.technical?.[0] || "data analytics",
    ].join(" ");

    const [jsJobs, azJobs] = await Promise.all([
      fetchJSearch(skillQuery),
      fetchAdzuna(
        (profile.interests?.[0] || "finance") + " data analyst intern",
        location === "international" ? "ca" : "us"
      ),
    ]);

    const realJobs = [...jsJobs, ...azJobs];
    const realJobsBlock =
      realJobs.length > 0
        ? `\nREAL LIVE JOB LISTINGS (use their exact title, company, location, apply_url):\n${JSON.stringify(realJobs, null, 2)}\n`
        : "";

    const raw = await callAI(
      "You are a career intelligence AI. Always return valid JSON only. No markdown fences, no text outside the JSON object.",
      `Find opportunities for this candidate. Today is ${today}.

CANDIDATE:
- Name: ${profile.name}
- University: ${profile.university} | Graduating: ${profile.graduation}
- GPA: ${profile.gpa} | Visa: ${profile.visa_status} | Work auth: ${profile.work_auth}
- Majors: ${profile.majors?.join(", ")}
- Technical skills: ${profile.skills?.technical?.join(", ")}
- Tools: ${profile.skills?.tools?.join(", ")}
- Platforms: ${profile.skills?.platforms?.join(", ")}
- Certifications: ${profile.certifications?.map((c) => c.name).join(", ") || "none"}
- Interests: ${profile.interests?.join(", ")}
- Strengths: ${profile.strengths?.join("; ")}
- Location: ${profile.location}
- Portfolio: ${profile.portfolio || "not provided"}

${realJobsBlock}

FILTERS:
- Visa friendly only: ${visaFriendly}
- Location scope: ${location}
- Remote preferred: ${remote}

Return a single JSON object with this exact structure:

{
  "generated_at": "${today}",
  "internships": [
    {
      "id": "company-role-slug",
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, ST",
      "country": "US",
      "type": "Summer 2026",
      "deadline": "2026-05-01",
      "remote": false,
      "visa_friendly": true,
      "work_auth": "CPT/OPT accepted",
      "apply_url": "https://careers.company.com/job/123",
      "salary": "$22-26/hr",
      "probability": 82,
      "prob_reason": "Strong Power BI and ERP experience matches their data team needs.",
      "match_skills": ["Power BI", "Python"],
      "missing_skills": ["Tableau"],
      "category": "Fintech",
      "company_size": "large",
      "notes": "Specific reason this role fits this candidate.",
      "source": "AI"
    }
  ],
  "startups": [
    {
      "id": "startup-slug",
      "company": "Startup Name",
      "location": "City, ST",
      "country": "US",
      "stage": "Series B",
      "funding": "$40M Series B 2024",
      "headcount": "50-200",
      "focus": "One sentence: what they build.",
      "why_fit": "Why this candidate's specific skills help this company.",
      "open_roles": ["Data Analyst Intern", "Finance Intern"],
      "outreach_tip": "DM the Head of Data on LinkedIn mentioning your ERP experience at City Utilities.",
      "outreach_channel": "LinkedIn DM",
      "website": "https://company.com",
      "linkedin_url": "https://linkedin.com/company/name",
      "careers_url": "https://company.com/careers",
      "hiring_signal": "actively hiring",
      "fit_score": 87
    }
  ],
  "grad_programs": [
    {
      "id": "program-slug",
      "program": "MS Business Analytics",
      "degree": "MS",
      "university": "University Name",
      "location": "City, ST",
      "country": "US",
      "stem": true,
      "opt": "36 months STEM OPT",
      "duration": "12 months",
      "deadline_r1": "2026-11-01",
      "deadline_r2": "2027-01-15",
      "gre": false,
      "gmat": false,
      "avg_gpa": 3.5,
      "admit_prob": 82,
      "admit_reason": "GPA 3.78 exceeds average; dual major is rare differentiator.",
      "tuition": 45000,
      "scholarship": true,
      "salary_after": 95000,
      "placement": 93,
      "top_employers": ["Amazon", "Deloitte", "Goldman Sachs"],
      "apply_url": "https://grad.university.edu/apply",
      "notes": "STEM designation gives 3-year OPT extension."
    }
  ],
  "summary": {
    "top_action": "The single most important action to take this week.",
    "urgent": ["Specific deadline 1", "Specific deadline 2"],
    "skill_gaps": ["Specific skill to add"],
    "highlight": ["Top strength to lead with"]
  }
}

REQUIREMENTS:
- Return exactly 8 internships, 6 startups, 6 grad programs
- Order each section by probability / fit_score highest first
${visaFriendly ? "- Only include roles open to F-1/CPT/OPT international students. Skip any requiring US citizenship, green card, or security clearance." : ""}
${remote ? "- Prefer remote and hybrid roles." : ""}
- Use real company names and real URLs
- For jobs from the real listings block above, keep their exact apply_url and set source to their source value`,
      5000
    );

    const opportunities = extractJSON(raw);
    if (!opportunities) {
      return res.status(422).json({
        error: "Could not generate opportunities. Please try again.",
      });
    }

    if (opportunities.summary) {
      opportunities.summary.real_jobs_found = realJobs.length;
      opportunities.summary.sources = [
        HAS_JSEARCH ? "JSearch/Google Jobs" : null,
        HAS_ADZUNA  ? "Adzuna"              : null,
        "AI research",
      ].filter(Boolean);
    }

    res.json({ opportunities });
  } catch (err) {
    console.error("/api/opportunities error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/message — draft outreach message
// ---------------------------------------------------------------------------
app.post("/api/message", async (req, res) => {
  try {
    const { profile, target, type } = req.body;

    const raw = await callAI(
      "You are a career coach writing outreach messages for students. Return only the message text — no subject line, no JSON, no commentary before or after.",
      `Write a ${type} from ${profile.name} to ${target.company || target.university}.
Target role/program: ${target.title || target.program || "data or analytics position"}

Candidate:
- ${profile.university}, ${profile.majors?.join(" + ")}, GPA ${profile.gpa}
- Top skills: ${[...(profile.skills?.technical || []), ...(profile.skills?.tools || [])].slice(0, 5).join(", ")}
- Experience: ${profile.experience?.slice(0, 2).map((e) => `${e.title} at ${e.company}`).join("; ")}
- Portfolio: ${profile.portfolio || "https://iftedinar.github.io"}

Why this role/company fits: ${target.notes || target.why_fit || target.prob_reason || "strong skills match"}

Rules:
1. Under 120 words
2. Mention ONE specific thing about this company or role (not generic)
3. Name exactly 2 skills that match this role
4. End with a single clear ask
5. Do NOT open with "I hope this finds you well" or "My name is"
6. Write as a real student, not as marketing copy`,
      400
    );

    res.json({ message: raw.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/health — confirm server is alive and show config
// ---------------------------------------------------------------------------
app.get("/api/health", (_, res) =>
  res.json({
    status:    "ok",
    version:   "v5",
    openai:    HAS_OPENAI  ? "configured" : "MISSING — add OPENAI_API_KEY to Railway",
    jsearch:   HAS_JSEARCH ? "configured" : "not set",
    adzuna:    HAS_ADZUNA  ? "configured" : "not set",
    time:      new Date().toISOString(),
  })
);

// ---------------------------------------------------------------------------
// Serve React SPA for all other GET routes
// ---------------------------------------------------------------------------
app.get("*", (req, res) => {
  const index = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.json({ message: "Career Intel API is running. No frontend build found." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Career Intel API → http://localhost:${PORT}`)
);
                                                                                                                               career-intel-final/package.json                                                                     0000644 0000000 0000000 00000001071 15175047007 015510  0                                                                                                    ustar   root                            root                                                                                                                                                                                                                   {
  "name": "career-intel",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node api/server.js",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node api/server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "openai": "^4.52.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "lucide-react": "^0.383.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "vite": "^5.4.0"
  }
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                       career-intel-final/src/App.jsx                                                                      0000644 0000000 0000000 00000012244 15175570630 015266  0                                                                                                    ustar   root                            root                                                                                                                                                                                                                   import { useState } from "react";
import { Target, FileText, Bookmark, Zap } from "lucide-react";
import { useStore } from "./lib/store.js";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import OpportunitiesPage from "./pages/OpportunitiesPage.jsx";
import TrackerPage from "./pages/TrackerPage.jsx";

const NAV = [
  { id: "opportunities", label: "Opportunities", icon: Target },
  { id: "documents",     label: "Documents",     icon: FileText },
  { id: "tracker",       label: "Tracker",       icon: Bookmark },
];

export default function App() {
  const [page, setPage] = useState("documents");
  const { profile, setProfile, opps, setOpps, saved, toggleSave, setStatus, reset } = useStore();

  function handleProfile(p) {
    setProfile(p);
    setPage("opportunities");
  }

  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CI";

  const savedCount = Object.keys(saved).length;
  const oppCount =
    (opps?.internships?.length || 0) +
    (opps?.startups?.length || 0) +
    (opps?.grad_programs?.length || 0);

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="side">
        <div className="logo">
          <div className="logo-mark">
            <div className="logo-ico"><Zap size={14} /></div>
            <div>
              <div className="logo-name">Career Intel</div>
              <div className="logo-sub">Personal · v3</div>
            </div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className={`ni ${page === id ? "on" : ""}`}
              onClick={() => setPage(id)}
            >
              <Icon size={15} style={{ opacity: 0.75, flexShrink: 0 }} />
              {label}
              {id === "tracker" && savedCount > 0 && (
                <span className="nb">{savedCount}</span>
              )}
              {id === "opportunities" && oppCount > 0 && (
                <span className="nb">{oppCount}</span>
              )}
            </div>
          ))}
        </nav>

        <div className="side-bot">
          <div className="user-row">
            <div className="ava">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: ".8rem",
                  color: "var(--tx2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profile?.name || "No profile yet"}
              </div>
              {profile?.gpa && (
                <div
                  style={{
                    fontSize: ".68rem",
                    color: "var(--amber)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  GPA {profile.gpa}
                </div>
              )}
            </div>
            {profile && (
              <button
                className="btn ghost xs"
                onClick={reset}
                title="Clear all data"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Profile bar shown on non-document pages */}
        {profile && page !== "documents" && (
          <div style={{ padding: ".55rem 2.5rem 0", maxWidth: 940, margin: "0 auto" }}>
            <div className="pbar-strip">
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--green)",
                  flexShrink: 0,
                }}
              />
              <strong style={{ color: "var(--tx)" }}>{profile.name}</strong>
              <span style={{ color: "var(--b3)" }}>·</span>
              <span>{profile.university}</span>
              <span style={{ color: "var(--b3)" }}>·</span>
              <span style={{ fontFamily: "var(--mono)", color: "var(--amber)" }}>
                GPA {profile.gpa}
              </span>
              <span style={{ color: "var(--b3)" }}>·</span>
              <span style={{ color: "var(--tx3)", fontSize: ".74rem" }}>
                {profile.visa_status}
              </span>
              <button
                className="btn ghost xs"
                style={{ marginLeft: "auto" }}
                onClick={() => setPage("documents")}
              >
                Update docs
              </button>
            </div>
          </div>
        )}

        {page === "documents" && (
          <DocumentsPage profile={profile} onDone={handleProfile} />
        )}
        {page === "opportunities" && (
          <OpportunitiesPage
            profile={profile}
            opps={opps}
            onRefresh={setOpps}
            saved={saved}
            onSave={toggleSave}
          />
        )}
        {page === "tracker" && (
          <TrackerPage
            saved={saved}
            setStatus={setStatus}
            onRemove={(id) => toggleSave(id, saved[id])}
          />
        )}
      </main>
    </div>
  );
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
