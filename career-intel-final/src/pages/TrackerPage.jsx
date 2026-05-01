import { useState } from "react";
import { Trash2, ChevronRight, ChevronDown } from "lucide-react";

const FLOW = ["saved","applied","interviewing","offer","rejected"];
const LABELS = { saved:"Saved", applied:"Applied", interviewing:"Interviewing", offer:"Offer 🎉", rejected:"Rejected" };

export default function TrackerPage({ saved, setStatus, onRemove }) {
  const [exp, setExp] = useState({});
  const items = Object.values(saved);
  const grouped = FLOW.reduce((a,s) => ({ ...a, [s]: items.filter(i=>i.status===s) }), {});
  const stats = { total:items.length, applied:grouped.applied.length, interviewing:grouped.interviewing.length, offers:grouped.offer.length };

  function label(item) { return item.title || item.program || item.company || "Opportunity"; }
  function sub(item) { return item.company || item.university || item.location || ""; }

  return (
    <div className="page si">
      <div className="ph">
        <div>
          <div className="ph-title">Tracker</div>
          <div className="ph-sub">Track saved opportunities through every stage</div>
        </div>
      </div>

      <div className="mets">
        <div className="met"><div className="met-v">{stats.total}</div><div className="met-l">Tracked</div></div>
        <div className="met"><div className="met-v" style={{color:"var(--blue)"}}>{stats.applied}</div><div className="met-l">Applied</div></div>
        <div className="met"><div className="met-v" style={{color:"var(--amber)"}}>{stats.interviewing}</div><div className="met-l">Interviewing</div></div>
        <div className="met"><div className="met-v" style={{color:"var(--green)"}}>{stats.offers}</div><div className="met-l">Offers</div></div>
      </div>

      {items.length === 0 && (
        <div className="empty">
          <div style={{ fontSize:"2rem", marginBottom:".75rem" }}>📋</div>
          <div style={{ fontSize:".85rem" }}>Bookmark opportunities from the Opportunities page</div>
        </div>
      )}

      {FLOW.filter(s => grouped[s].length > 0).map(status => (
        <div key={status} style={{ marginBottom:"1.4rem" }}>
          <div style={{ fontSize:".67rem", color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".07em", marginBottom:".4rem" }}>
            {LABELS[status]} <span style={{ fontFamily:"var(--mono)" }}>({grouped[status].length})</span>
          </div>
          {grouped[status].map(item => (
            <div key={item.id} className="card" style={{ marginBottom:5, padding:".8rem 1rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <button className="btn ghost ico xs" onClick={() => setExp(p=>({...p,[item.id]:!p[item.id]}))}>
                  {exp[item.id] ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <span style={{ fontSize:".875rem", fontWeight:500 }}>{label(item)}</span>
                    <span className={`sp ${status==="saved"?"sv":status==="applied"?"ap":status==="interviewing"?"iv":status==="offer"?"of":"rj"}`}>
                      {LABELS[status]}
                    </span>
                  </div>
                  <div style={{ fontSize:".76rem", color:"var(--tx3)", marginTop:1 }}>{sub(item)}</div>
                </div>
                <button className="btn ghost ico xs" onClick={() => onRemove(item.id)}><Trash2 size={12}/></button>
              </div>
              {exp[item.id] && (
                <div style={{ marginTop:".7rem", paddingTop:".7rem", borderTop:"1px solid var(--b)" }}>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {FLOW.map(s => (
                      <button key={s} className="btn xs"
                        style={{ borderColor: status===s ? "var(--amber)" : undefined, color: status===s ? "var(--amber)" : undefined }}
                        onClick={() => setStatus(item.id, s)}>
                        {LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
