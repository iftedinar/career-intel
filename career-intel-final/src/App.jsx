import { useState } from "react";
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
