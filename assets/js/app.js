export function rootPrefix(){
  const parts = window.location.pathname.split("/").filter(Boolean);
  const depth = Math.max(0, parts.length - 1);
  return "../".repeat(depth);
}

export async function loadText(pathFromRoot){
  const url = rootPrefix() + pathFromRoot;
  const res = await fetch(url, { cache: "no-store" });
  return await res.text();
}

export async function loadJson(pathFromRoot){
  const url = rootPrefix() + pathFromRoot;
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return await res.json();
}

export function setYear(){
  const y = document.getElementById("year");
  if(y) y.textContent = new Date().getFullYear();
}
