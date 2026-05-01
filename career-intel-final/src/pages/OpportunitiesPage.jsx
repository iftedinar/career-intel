import { useState, useMemo } from "react";
import { RefreshCw, Filter, X, Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "../lib/api.js";
import DetailPanel from "../components/DetailPanel.jsx";

function pc(p) { return p>=70 ? "hi" : p>=50 ? "mid" : "lo"; }
function pCol(p) { return p>=70 ? "var(--green)" : p>=50 ? "var(--amber)" : "var(--red)"; }

function OppCard({ item, type, saved, onSave, onClick }) {
  const score = item.probability || item.admit_prob || item.fit_score;
  return (
    <div className={`opp ${saved ? "sv" : ""}`} onClick={onClick}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:".875rem", fontWeight:500, color:"var(--tx)" }}>
            {item.title || item.company || item.program}
          </div>
          <div style={{ fontSize:".77rem", color:"var(--tx2)", marginTop:2 }}>
            {(item.company || item.university)} · {item.location}
            {item.remote ? " · Remote" : ""}
            {item.type ? ` · ${item.type}` : ""}
            {item.stage ? ` · ${item.stage}` : ""}
            {item.degree ? ` · ${item.degree}` : ""}
          </div>
        </div>
        {score && (
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div className={`pr ${pc(score)}`}>{score}%</div>
            <div className="pbar"><div className="pf" style={{ width:`${score}%`, background:pCol(score) }} /></div>
          </div>
        )}
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:8, flexWrap:"wrap" }}>
        {item.visa_friendly && <span className="bd g">CPT/OPT ✓</span>}
        {item.stem && <span className="bd g">STEM OPT</span>}
        {item.remote && <span className="bd b">Remote</span>}
        {item.salary && <span className="bd a">{item.salary}</span>}
        {item.category && <span className="bd n">{item.category}</span>}
        {item.hiring_signal && <span className={`bd ${item.hiring_signal.includes("active") ? "g" : "a"}`}>{item.hiring_signal}</span>}
        {item.deadline && item.deadline !== "null" && (
          <span className="bd n" style={{ marginLeft:"auto" }}>⏳ {item.deadline}</span>
        )}
        {item.deadline_r1 && <span className="bd a" style={{ marginLeft:"auto" }}>R1: {item.deadline_r1}</span>}
        <button className="btn ghost ico xs" style={{ marginLeft: (!item.deadline && !item.deadline_r1) ? "auto" : 0 }}
          onClick={e => { e.stopPropagation(); onSave(item.id, item); }}>
          {saved ? <BookmarkCheck size={13} style={{ color:"var(--amber)" }} /> : <Bookmark size={13} />}
        </button>
      </div>

      {(item.match_skills || item.open_roles) && (
        <div className="tags">
          {(item.match_skills || item.open_roles || []).slice(0,5).map(s => <span key={s} className="tag">{s}</span>)}
        </div>
      )}
      {item.focus && <div style={{ fontSize:".77rem", color:"var(--tx3)", marginTop:5, lineHeight:1.5 }}>{item.focus}</div>}
    </div>
  );
}

export default function OpportunitiesPage({ profile, opps, onRefresh, saved, onSave }) {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("internships");
  const [selected, setSelected] = useState(null);
  const [err, setErr] = useState("");
  const [showF, setShowF] = useState(false);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({
    visaFriendly: true, remote: false, minProb: 0, location: "both"
  });

  async function refresh() {
    if (!profile) { setErr("Upload your documents first."); return; }
    setLoading(true); setErr("");
    try {
      const { opportunities } = await api.opportunities(profile, filters);
      onRefresh(opportunities);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  const internships = opps?.internships || [];
  const startups = opps?.startups || [];
  const grad = opps?.grad_programs || [];
  const summary = opps?.summary;

  const filtered = useMemo(() => {
    const qL = q.toLowerCase();
    const f = (items) => items.filter(item => {
      if (qL && !JSON.stringify(item).toLowerCase().includes(qL)) return false;
      const score = item.probability || item.admit_prob || item.fit_score || 0;
      if (score < filters.minProb) return false;
      if (filters.visaFriendly && tab === "internships" && item.visa_friendly === false) return false;
      if (filters.remote && tab === "internships" && !item.remote) return false;
      return true;
    });
    return { i: f(internships), s: f(startups), g: f(grad) };
  }, [internships, startups, grad, q, filters, tab]);

  const active = tab==="internships" ? filtered.i : tab==="startups" ? filtered.s : filtered.g;
  const counts = { internships:filtered.i.length, startups:filtered.s.length, grad:filtered.g.length };

  return (
    <div className="page si">
      <div className="ph">
        <div>
          <div className="ph-title">Opportunities</div>
          <div className="ph-sub">
            {opps ? `${internships.length+startups.length+grad.length} results · ${opps.generated_at}` : "Hit Refresh to find live openings matched to your profile"}
          </div>
        </div>
        <div className="ph-r">
          <button className="btn sm" onClick={() => setShowF(!showF)}><Filter size={13} /> Filters</button>
          <button className="btn prim" onClick={refresh} disabled={loading || !profile}>
            {loading ? <span className="spin" /> : <RefreshCw size={13} />}
            {loading ? "Searching…" : "Refresh"}
          </button>
        </div>
      </div>

      {err && <div className="al e">{err}</div>}
      {!profile && <div className="al w">Upload your resume first to get personalized results.</div>}

      {/* Filters */}
      {showF && (
        <div className="card" style={{ marginBottom:"1rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:".75rem" }}>
            <span style={{ fontSize:".85rem", fontWeight:500 }}>Filters</span>
            <button className="btn ghost ico xs" onClick={() => setShowF(false)}><X size={13} /></button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".5rem 1.5rem" }}>
            <Tog label="Visa-friendly only" v={filters.visaFriendly} set={v => setFilters(f=>({...f,visaFriendly:v}))} />
            <Tog label="Remote only" v={filters.remote} set={v => setFilters(f=>({...f,remote:v}))} />
          </div>
          <div style={{ marginTop:".75rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:".77rem", color:"var(--tx2)", marginBottom:4 }}>
              <span>Min probability</span>
              <span style={{ fontFamily:"var(--mono)", color:"var(--amber)" }}>{filters.minProb}%</span>
            </div>
            <input type="range" min="0" max="80" step="5" value={filters.minProb}
              onChange={e => setFilters(f=>({...f,minProb:+e.target.value}))}
              style={{ padding:0, border:"none", background:"var(--bg4)" }} />
          </div>
          <div style={{ marginTop:".75rem" }}>
            <label>Location</label>
            <select value={filters.location} onChange={e => setFilters(f=>({...f,location:e.target.value}))}>
              <option value="both">US + International</option>
              <option value="us">US only</option>
              <option value="international">International only</option>
            </select>
          </div>
        </div>
      )}

      {/* Metrics */}
      {opps && (
        <div className="mets">
          <div className="met"><div className="met-v">{filtered.i.length}</div><div className="met-l">Internships</div></div>
          <div className="met"><div className="met-v">{filtered.s.length}</div><div className="met-l">Startups</div></div>
          <div className="met"><div className="met-v">{filtered.g.length}</div><div className="met-l">Grad programs</div></div>
          <div className="met">
            <div className="met-v" style={{ color:"var(--amber)", fontFamily:"var(--mono)" }}>
              {Math.max(internships[0]?.probability||0, startups[0]?.fit_score||0, grad[0]?.admit_prob||0)}%
            </div>
            <div className="met-l">Top match</div>
          </div>
        </div>
      )}

      {summary?.top_action && <div className="al i"><strong>Top action:</strong> {summary.top_action}</div>}

      {/* Search */}
      {opps && (
        <div style={{ marginBottom:".75rem" }}>
          <input placeholder="Search companies, skills, locations…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {[["internships","Internships"],["startups","Startups"],["grad","Grad programs"]].map(([id,label]) => (
          <button key={id} className={`tab ${tab===id?"on":""}`} onClick={() => setTab(id)}>
            {label}
            {opps && <span style={{ opacity:.55, fontSize:".71rem", marginLeft:3 }}>{counts[id]}</span>}
          </button>
        ))}
      </div>

      {!opps && !loading && (
        <div className="empty">
          <div style={{ fontSize:"2rem", marginBottom:".75rem" }}>🎯</div>
          <div style={{ fontSize:".85rem" }}>Hit Refresh to find current openings matched to your profile</div>
        </div>
      )}

      {active.map(item => (
        <OppCard key={item.id} item={item}
          type={tab==="internships"?"internship":tab==="startups"?"startup":"grad"}
          saved={!!saved[item.id]} onSave={onSave}
          onClick={() => setSelected({ item, type: tab==="internships"?"internship":tab==="startups"?"startup":"grad" })}
        />
      ))}

      {summary?.skill_gaps?.length > 0 && opps && (
        <div className="card" style={{ marginTop:"1.5rem" }}>
          <div style={{ fontSize:".68rem", color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Skill gaps to address</div>
          {summary.skill_gaps.map(g => (
            <div key={g} style={{ fontSize:".8rem", color:"var(--tx2)", padding:"3px 0", display:"flex", gap:6 }}>
              <span style={{ color:"var(--amber)" }}>→</span> {g}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <DetailPanel item={selected.item} type={selected.type}
          profile={profile} saved={saved} onSave={onSave}
          onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Tog({ label, v, set }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:".4rem 0", borderBottom:"1px solid var(--b)", fontSize:".81rem", color:"var(--tx2)" }}>
      <span>{label}</span>
      <label className="tog">
        <input type="checkbox" checked={v} onChange={e => set(e.target.checked)} />
        <span className="tog-s" />
      </label>
    </div>
  );
}
