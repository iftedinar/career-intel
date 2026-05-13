import { useState, useRef } from "react";
import { Upload, FileText, X, CheckCircle } from "lucide-react";
import { api } from "../lib/api.js";

export default function DocumentsPage({ profile, onDone }) {
  const [queued, setQueued] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef();

  function add(files) {
    const ok = Array.from(files).filter(f => f.name.match(/\.(pdf|txt|docx|doc)$/i));
    setQueued(p => [...p, ...ok]);
  }

  async function parse() {
    if (!queued.length) return;
    setParsing(true); setErr("");
    try {
      const { profile } = await api.parse(queued);
      onDone(profile);
      setQueued([]);
    } catch (e) {
      setErr(`${e.message}`);
    } finally { setParsing(false); }
  }

  return (
    <div className="page si">
      <div className="ph">
        <div>
          <div className="ph-title">Documents</div>
          <div className="ph-sub">Upload your resume and certifications — Claude extracts your full career profile</div>
        </div>
      </div>

      <div className={`drop ${drag ? "ov" : ""}`}
        onClick={() => ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        style={{ marginBottom:"1rem" }}>
        <Upload size={28} style={{ color:"var(--tx3)", margin:"0 auto" }} />
        <div style={{ fontSize:".9rem", color:"var(--tx2)", marginTop:".6rem" }}>Drop files here or click to browse</div>
        <div style={{ fontSize:".75rem", color:"var(--tx3)", marginTop:4 }}>Resume · Certifications · Cover letter — PDF, DOCX, TXT</div>
        <input ref={ref} type="file" multiple accept=".pdf,.txt,.doc,.docx"
          style={{ display:"none" }} onChange={e => add(e.target.files)} />
      </div>

      {queued.length > 0 && (
        <div style={{ marginBottom:"1rem" }}>
          {queued.map((f, i) => (
            <div key={i} className="card sm" style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
              <FileText size={14} style={{ color:"var(--amber)", flexShrink:0 }} />
              <span style={{ flex:1, fontSize:".81rem" }}>{f.name}</span>
              <span style={{ fontSize:".71rem", color:"var(--tx3)" }}>{(f.size/1024).toFixed(0)} KB</span>
              <button className="btn ghost ico xs" onClick={() => setQueued(p => p.filter((_,j) => j!==i))}>
                <X size={12} />
              </button>
            </div>
          ))}
          <button className="btn prim" onClick={parse} disabled={parsing} style={{ marginTop:8 }}>
            {parsing ? <><span className="spin" /> Parsing your documents…</> : <><Upload size={14} /> Parse {queued.length} file{queued.length>1?"s":""}</>}
          </button>
        </div>
      )}

      {err && <div className="al e">{err}</div>}

      {profile && (
        <div className="si">
          <div className="div" />
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:"1rem" }}>
            <CheckCircle size={15} style={{ color:"var(--green)" }} />
            <span style={{ fontSize:".85rem", fontWeight:500 }}>Profile extracted</span>
            <span style={{ fontSize:".73rem", color:"var(--tx3)", marginLeft:"auto" }}>Re-upload to update</span>
          </div>

          <div className="g2" style={{ marginBottom:10 }}>
            <PF l="Name" v={profile.name} />
            <PF l="GPA" v={profile.gpa} accent />
            <PF l="University" v={profile.university} />
            <PF l="Graduation" v={profile.graduation} />
            <PF l="Location" v={profile.location} />
            <PF l="Visa" v={profile.visa_status} />
          </div>

          {profile.majors?.length > 0 && (
            <Sec l="Majors">
              <div className="tags">{profile.majors.map(m => <span key={m} className="bd a">{m}</span>)}</div>
            </Sec>
          )}
          {profile.skills && (
            <Sec l="Skills">
              <div className="tags">
                {[...profile.skills.technical||[], ...profile.skills.tools||[], ...profile.skills.platforms||[]].map(s => (
                  <span key={s} className="tag">{s}</span>
                ))}
              </div>
            </Sec>
          )}
          {profile.certifications?.length > 0 && (
            <Sec l="Certifications">
              <div className="tags">
                {profile.certifications.map(c => <span key={c.name} className="bd b">{c.name}</span>)}
              </div>
            </Sec>
          )}
          {profile.strengths?.length > 0 && (
            <Sec l="Key strengths">
              {profile.strengths.map(s => (
                <div key={s} style={{ fontSize:".79rem", color:"var(--tx2)", display:"flex", gap:6, padding:"2px 0" }}>
                  <span style={{ color:"var(--green)" }}>✓</span> {s}
                </div>
              ))}
            </Sec>
          )}
          {profile.experience?.length > 0 && (
            <Sec l="Experience">
              {profile.experience.map((e,i) => (
                <div key={i} className="card sm" style={{ marginBottom:5 }}>
                  <div style={{ fontSize:".84rem", fontWeight:500 }}>{e.title}</div>
                  <div style={{ fontSize:".77rem", color:"var(--tx2)" }}>{e.company} · {e.start} – {e.end||"Present"}</div>
                </div>
              ))}
            </Sec>
          )}
          {profile.summary && (
            <div style={{ background:"var(--bg3)", borderRadius:"var(--r)", padding:".85rem", fontSize:".81rem", color:"var(--tx2)", lineHeight:1.7, marginTop:".75rem" }}>
              {profile.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PF({ l, v, accent }) {
  return (
    <div className="card sm">
      <div style={{ fontSize:".65rem", color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:2 }}>{l}</div>
      <div style={{ fontSize:".875rem", fontWeight:500, color: accent ? "var(--amber)" : "var(--tx)", fontFamily: accent ? "var(--mono)" : undefined }}>
        {v ?? "—"}
      </div>
    </div>
  );
}

function Sec({ l, children }) {
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ fontSize:".65rem", color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>{l}</div>
      {children}
    </div>
  );
}
