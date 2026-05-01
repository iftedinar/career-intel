import express from "express";
import multer from "multer";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: "uploads/", limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Serve the built frontend in production
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── helpers ────────────────────────────────────────────────────────────────
function readUploadedFile(file) {
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

// ── 1. Parse documents → profile ──────────────────────────────────────────
app.post("/api/parse", upload.array("files", 10), async (req, res) => {
  try {
    const docs = req.files.map(readUploadedFile).filter((d) => d.content.length > 20);
    if (!docs.length) return res.status(400).json({ error: "No readable content found." });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Extract a career profile from these documents. Return ONLY valid JSON.

DOCUMENTS:
${docs.map((d) => `=== ${d.name} ===\n${d.content}`).join("\n\n")}

Return this JSON:
{
  "name": "Full Name",
  "email": "email",
  "location": "City, State",
  "university": "University Name",
  "graduation": "Month Year",
  "gpa": 3.78,
  "majors": ["Major 1", "Major 2"],
  "visa_status": "international_student",
  "work_auth": "CPT eligible",
  "skills": {
    "technical": ["Python", "SQL"],
    "tools": ["Power BI", "Excel"],
    "platforms": ["Workday", "Oracle"]
  },
  "experience": [
    { "title": "Role", "company": "Company", "start": "Jun 2025", "end": "Aug 2025", "highlights": ["bullet"] }
  ],
  "certifications": [{ "name": "Cert Name", "issuer": "LinkedIn Learning", "date": "Nov 2025" }],
  "interests": ["fintech", "data analytics"],
  "strengths": ["Rare ERP experience", "Dual major"],
  "summary": "2-sentence professional summary."
}`
      }]
    });

    const profile = parseJSON(response.content[0].text);
    if (!profile) return res.status(422).json({ error: "Could not parse your documents. Try a text-based PDF." });
    res.json({ profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. Find opportunities ──────────────────────────────────────────────────
app.post("/api/opportunities", async (req, res) => {
  try {
    const { profile, filters = {} } = req.body;
    if (!profile) return res.status(400).json({ error: "Profile required." });

    const today = new Date().toISOString().split("T")[0];
    const {
      visaFriendly = true,
      location = "both",
      minProb = 0,
      remote = false,
    } = filters;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 5000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `You are a career intelligence AI. Today is ${today}.

CANDIDATE:
- Name: ${profile.name}
- University: ${profile.university}, graduating ${profile.graduation}
- GPA: ${profile.gpa}
- Majors: ${profile.majors?.join(", ")}
- Visa: ${profile.visa_status} — ${profile.work_auth}
- Skills: ${[...profile.skills?.technical||[], ...profile.skills?.tools||[], ...profile.skills?.platforms||[]].join(", ")}
- Certifications: ${profile.certifications?.map(c=>c.name).join(", ")}
- Interests: ${profile.interests?.join(", ")}
- Strengths: ${profile.strengths?.join(", ")}
- Location: ${profile.location}

CONSTRAINTS:
- Visa friendly only: ${visaFriendly} (skip any requiring US citizenship or security clearance)
- Location: ${location} (us = US only, international = outside US only, both = all)
- Remote preferred: ${remote}
- Today: ${today}

Search for and return current opportunities. Return ONLY valid JSON:

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
      "deadline": "2026-04-15",
      "remote": false,
      "visa_friendly": true,
      "work_auth": "CPT/OPT",
      "apply_url": "https://company.com/careers/role",
      "salary": "$22-28/hr",
      "probability": 82,
      "prob_reason": "One sentence why this candidate matches.",
      "match_skills": ["Power BI", "Python"],
      "missing_skills": ["Tableau"],
      "category": "Fintech",
      "company_size": "large",
      "notes": "Why this fits based on their specific background."
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
      "focus": "One-sentence description of what they build.",
      "why_fit": "Why this candidate's background is directly relevant.",
      "open_roles": ["Data Analyst Intern", "Finance Intern"],
      "outreach_tip": "Specific tip: who to contact and what to say.",
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
      "deadline_r1": "2026-11-01",
      "deadline_r2": "2027-01-15",
      "gre": false,
      "gmat": false,
      "avg_gpa": 3.5,
      "admit_prob": 82,
      "admit_reason": "Why this candidate is strong.",
      "tuition": 45000,
      "scholarship": true,
      "salary_after": 95000,
      "placement": 93,
      "top_employers": ["Amazon", "Deloitte"],
      "apply_url": "https://grad.university.edu/apply",
      "notes": "Why this program fits their goals."
    }
  ],
  "summary": {
    "top_action": "Most important next step.",
    "urgent": ["Deadline alert 1", "Deadline alert 2"],
    "skill_gaps": ["Gap 1 to address"],
    "highlight": ["Strength to emphasize in applications"]
  }
}

Find at least 8 internships, 6 startups, 6 grad programs. Order by probability/fit descending. Use real company names and real URLs where possible.`
      }]
    });

    const text = response.content.find((b) => b.type === "text")?.text || "{}";
    const opportunities = parseJSON(text);
    if (!opportunities) return res.status(422).json({ error: "Could not generate results. Try again." });
    res.json({ opportunities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Draft outreach message ──────────────────────────────────────────────
app.post("/api/message", async (req, res) => {
  try {
    const { profile, target, type } = req.body;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Write a ${type} for ${profile.name} to send to ${target.company || target.university}.
Role/Program: ${target.title || target.program || "data/analytics role"}

Candidate facts:
- ${profile.university}, ${profile.majors?.join(" + ")}, GPA ${profile.gpa}
- Skills: ${[...profile.skills?.technical||[], ...profile.skills?.tools||[]].slice(0,5).join(", ")}
- Experience: ${profile.experience?.slice(0,2).map(e=>`${e.title} at ${e.company}`).join(", ")}
- Portfolio: ${profile.portfolio || "https://iftedinar.github.io"}

Target details: ${JSON.stringify(target)}

Rules:
- Under 120 words
- Reference one specific thing about the company/program
- Name 2 skills that match this specific role
- Clear ask at end
- No cliché openers ("I hope this finds you well")
- Sound like a real student, not AI

Return ONLY the message text.`
      }]
    });

    res.json({ message: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── health check ───────────────────────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// ── serve frontend for all other routes (SPA) ─────────────────────────────
app.get("*", (req, res) => {
  const index = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.json({ message: "API is running. Build the frontend with: npm run build" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Career Intel running at http://localhost:${PORT}`));
