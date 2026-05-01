import { useState, useCallback } from "react";

const get = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export function useStore() {
  const [profile, setProfileRaw] = useState(() => get("ci_profile"));
  const [opps, setOppsRaw] = useState(() => get("ci_opps"));
  const [saved, setSavedRaw] = useState(() => get("ci_saved") || {});

  const setProfile = useCallback((p) => { setProfileRaw(p); set("ci_profile", p); }, []);
  const setOpps = useCallback((o) => { setOppsRaw(o); set("ci_opps", o); }, []);

  const toggleSave = useCallback((id, data) => {
    setSavedRaw((prev) => {
      const next = { ...prev };
      if (next[id]) { delete next[id]; } else { next[id] = { ...data, status: "saved" }; }
      set("ci_saved", next);
      return next;
    });
  }, []);

  const setStatus = useCallback((id, status) => {
    setSavedRaw((prev) => {
      const next = { ...prev, [id]: { ...prev[id], status } };
      set("ci_saved", next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    ["ci_profile", "ci_opps", "ci_saved"].forEach((k) => localStorage.removeItem(k));
    setProfileRaw(null); setOppsRaw(null); setSavedRaw({});
  }, []);

  return { profile, setProfile, opps, setOpps, saved, toggleSave, setStatus, reset };
}
