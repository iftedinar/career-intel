import { useState } from "react";
import { X, ExternalLink, Bookmark, BookmarkCheck, Copy, CheckCircle } from "lucide-react";
import { api } from "../lib/api.js";

function pc(p) { return p >= 70 ? "hi" : p >= 50 ? "mid" : "lo"; }
function pColor(p) { return p >= 70 ? "var(--green)" : p >= 50 ? "var(--amber)" : "var(--red)"; }

function Row({ label, value, accent }) {
  if (!value || value === "null") return null;
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--b)", fontSize:".79rem" }}>
      <span style={{ color:"var(--tx3)" }}>{label}</span>
      <span style={{ color: accent ? "var(--amber)" : "var(--tx2)", fontFamily: accent ? "var(--mono)" : undefined }}>{value}</span>
    </div>
  );
}

export default function DetailPanel({ item, type, profile, saved, onSave, onClose }) {
  const [msgType, setMsgType] = useState("");
  const [msg, setMsg] = useState("");
  const [genning, setGenning] = useState(false);
  const [copied, setCopied] = useState(false);

  const score = item.probability || item.admit_prob || item.fit_score;
  const reason = item.prob_reason || item.admit_reason || item.why_fit;
  const isSaved = !!saved[item.id];

  async function genMsg(t) {
    setMsgType(t); setMsg(""); setGenning(true);
    try {
      const r = await api.message(profile, item, t);
      setMsg(r.message);
    } catch { setMsg("Could not generate — check API."); }
    finally { setGenning(false); }
  }

  return (
    <>
      <div className="dov" onClick={onClose} />
      <div className="dpan si">
        {/* close */}
        <button className="btn ghost ico" style={{ position:"absolute", top:"1rem", right:"1rem" }} onClick={onClose}>
          <X size={15} />
        </button>

        {/* title */}
        <div style={{ paddingRight:"2.5rem", marginBottom:"1.1rem" }}>
          <div style={{ fontFamily:"var(--serif)", fontSize:"1.3rem", lineHeight:1.2, marginBottom:3 }}>
            {item.title || item.company || item.program}
          </div>
          <div style={{ fontSize:".82rem", color:"var(--tx2)" }}>
            {item.company || item.university} · {item.location}
          </div>
        </div>

        {/* badges */}
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:"1rem" }}>
          {item.visa_friendly && <span className="bd g">CPT/OPT ✓</span>}
          {item.stem && <span className="bd g">STEM OPT 3yr</span>}
          {item.remote && <span className="bd b">Remote</span>}
          {item.stage && <span className="bd n">{item.stage}</span>}
          {item.type && <span className="bd n">{item.type}</span>}
          {item.category && <span className="bd n">{item.category}</span>}
          {item.degree && <span className="bd n">{item.degree}</span>}
        </div>

        {/* probability */}
        {score && (
          <div style={{ background:"var(--bg3)", borderRadius:"var(--r)", padding:".85rem", marginBottom:"1rem" }}>
            <div style={{ fontSize:".67rem", color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
              {type === "grad" ? "Admission probability" : type === "startup" ? "Fit score" : "Match probability"}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:"1.55rem", fontWeight:500, color:pColor(score) }}>{score}%</span>
              {reason && <span style={{ fontSize:".79rem", color:"var(--tx2)", lineHeight:1.5 }}>{reason}</span>}
            </div>
          </div>
        )}

        {/* type-specific details */}
        {type === "internship" && (
          <div style={{ marginBottom:"1rem" }}>
            <Row label="Salary" value={item.salary} accent />
            <Row label="Work auth" value={item.work_auth} />
            <Row label="Deadline" value={item.deadline} />
            <Row label="Company size" value={item.company_size} />
            {item.match_skills?.length > 0 && (
              <div style={{ paddingTop:8 }}>
                <div style={{ fontSize:".67rem", color:"var(--tx3)", marginBottom:4 }}>MATCHING SKILLS</div>
                <div className="tags">{item.match_skills.map(s => <span key={s} className="tag">{s}</span>)}</div>
              </div>
            )}
            {item.missing_skills?.length > 0 && (
              <div style={{ paddingTop:8 }}>
                <div style={{ fontSize:".67rem", color:"var(--tx3)", marginBottom:4 }}>SKILL GAPS</div>
                <div className="tags">{item.missing_skills.map(s => <span key={s} className="bd r">{s}</span>)}</div>
              </div>
            )}
          </div>
        )}

        {type === "startup" && (
          <div style={{ marginBottom:"1rem" }}>
            <Row label="Stage" value={item.stage} />
            <Row label="Funding" value={item.funding} accent />
            <Row label="Team size" value={item.headcount} />
            <Row label="Best channel" value={item.outreach_channel} />
            {item.outreach_tip && (
              <div style={{ background:"var(--amberD)", borderRadius:"var(--r)", padding:".7rem", marginTop:10, fontSize:".79rem", color:"var(--amber)", lineHeight:1.55 }}>
                💡 {item.outreach_tip}
              </div>
            )}
            {item.open_roles?.length > 0 && (
              <div style={{ paddingTop:8 }}>
                <div style={{ fontSize:".67rem", color:"var(--tx3)", marginBottom:4 }}>OPEN ROLES</div>
                <div className="tags">{item.open_roles.map(r => <span key={r} className="bd g">{r}</span>)}</div>
              </div>
            )}
          </div>
        )}

        {type === "grad" && (
          <div style={{ marginBottom:"1rem" }}>
            <Row label="Duration" value={item.duration} />
            <Row label="Avg GPA admitted" value={item.avg_gpa} accent />
            <Row label="Placement rate" value={item.placement ? `${item.placement}%` : null} />
            <Row label="Avg salary after" value={item.salary_after ? `$${item.salary_after?.toLocaleString()}` : null} accent />
            <Row label="Total tuition" value={item.tuition ? `$${item.tuition?.toLocaleString()}` : null} />
            <Row label="R1 Deadline" value={item.deadline_r1} />
            <Row label="R2 Deadline" value={item.deadline_r2} />
            <Row label="OPT extension" value={item.opt} />
            {item.scholarship && <div className="bd g" style={{ marginTop:8, display:"inline-flex" }}>Scholarship available</div>}
            {item.top_employers?.length > 0 && (
              <div style={{ paddingTop:8 }}>
                <div style={{ fontSize:".67rem", color:"var(--tx3)", marginBottom:4 }}>TOP HIRING COMPANIES</div>
                <div className="tags">{item.top_employers.map(e => <span key={e} className="tag">{e}</span>)}</div>
              </div>
            )}
          </div>
        )}

        {/* notes */}
        {item.notes && (
          <div style={{ fontSize:".81rem", color:"var(--tx2)", lineHeight:1.65, marginBottom:"1rem" }}>{item.notes}</div>
        )}

        {/* actions */}
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:"1.2rem" }}>
          {(item.apply_url || item.careers_url || item.website) && (
            <a href={item.apply_url || item.careers_url || item.website} target="_blank" rel="noreferrer" className="btn sm prim">
              <ExternalLink size={12} />
              {type === "grad" ? "Apply" : type === "startup" ? "Website" : "Apply now"}
            </a>
          )}
          {item.linkedin_url && (
            <a href={item.linkedin_url} target="_blank" rel="noreferrer" className="btn sm">LinkedIn</a>
          )}
          <button className="btn sm" onClick={() => onSave(item.id, item)}>
            {isSaved ? <BookmarkCheck size={13} style={{ color:"var(--amber)" }} /> : <Bookmark size={13} />}
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>

        {/* outreach generator */}
        {type !== "grad" && profile && (
          <>
            <div className="div" />
            <div style={{ fontSize:".79rem", fontWeight:500, marginBottom:8 }}>Generate outreach message</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
              {["LinkedIn DM", "Cold email", "Follow-up", "Referral ask"].map(t => (
                <button key={t} className="btn sm" onClick={() => genMsg(t)}
                  style={{ borderColor: msgType === t ? "var(--amber)" : undefined }}>
                  {t}
                </button>
              ))}
            </div>
            {genning && <div style={{ display:"flex", gap:8, color:"var(--tx3)", fontSize:".79rem" }}><span className="spin" /> Drafting…</div>}
            {msg && (
              <div style={{ background:"var(--bg3)", borderRadius:"var(--r)", padding:".9rem", fontSize:".81rem", color:"var(--tx2)", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                {msg}
                <div style={{ marginTop:9 }}>
                  <button className="btn sm" onClick={() => { navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    {copied ? <CheckCircle size={12} style={{ color:"var(--green)" }} /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
