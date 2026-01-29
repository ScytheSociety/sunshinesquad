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

export function setYear(){
  const y = document.getElementById("year");
  if(y) y.textContent = new Date().getFullYear();
}
