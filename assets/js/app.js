export function rootPrefix(){
  // Queremos el prefijo hacia la RAÍZ del repo (no hacia el dominio).
  // Si estás en /sunshinesquad/index.html -> prefijo ""
  // Si estás en /sunshinesquad/pages/blog/index.html -> prefijo "../../"

  const parts = window.location.pathname.split("/").filter(Boolean);

  // Si el último segmento parece archivo (tiene punto), lo quitamos
  if (parts.length > 0 && parts[parts.length - 1].includes(".")) {
    parts.pop();
  }

  // Ahora parts representa el directorio actual.
  // En GitHub Pages project: el primer segmento es el nombre del repo ("sunshinesquad")
  // Profundidad desde la raíz del repo = parts.length - 1
  const depthFromRepoRoot = Math.max(0, parts.length - 1);

  return "../".repeat(depthFromRepoRoot);
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
