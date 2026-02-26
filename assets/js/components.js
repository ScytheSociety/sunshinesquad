import { url, loadText, setYear } from "./app.js";

async function inject(id, path) {
  const el = document.getElementById(id);
  if (!el) return;
  const html = await loadText(path);
  el.innerHTML = html.replaceAll("{{ROOT}}", url("").slice(0, -1) + "/");
}

document.addEventListener("DOMContentLoaded", async () => {
  await inject("navbar-container", "components/navbar.html");
  await inject("footer-container", "components/footer.html");
  setYear();
});