const BASE = import.meta.env.VITE_API_URL || "/api";

async function post(path, body, isForm = false) {
  const opts = { method: "POST" };
  if (isForm) {
    opts.body = body;
  } else {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json().catch(() => ({ error: "Bad response" }));
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json;
}

export const api = {
  parse: (files) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return post("/parse", form, true);
  },
  opportunities: (profile, filters) => post("/opportunities", { profile, filters }),
  message: (profile, target, type) => post("/message", { profile, target, type }),
};
