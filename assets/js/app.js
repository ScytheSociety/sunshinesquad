export function repoRoot() {
  const origin = window.location.origin;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const repo = parts.length > 0 ? parts[0] : "";
  return repo ? `${origin}/${repo}/` : `${origin}/`;
}

export function url(path) {
  return repoRoot() + path.replace(/^\//, "");
}

export async function loadJson(path) {
  const fullUrl = url(path);
  const res = await fetch(fullUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar: ${fullUrl} (${res.status})`);
  return await res.json();
}

export async function loadText(path) {
  const fullUrl = url(path);
  const res = await fetch(fullUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar: ${fullUrl} (${res.status})`);
  return await res.text();
}

export function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
}