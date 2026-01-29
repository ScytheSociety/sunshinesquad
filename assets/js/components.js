import { rootPrefix, loadText, setYear } from "./app.js";

async function inject(id, file){
  const el = document.getElementById(id);
  if(!el) return;
  const html = await loadText(file);
  el.innerHTML = html.replaceAll("{{ROOT}}", rootPrefix());
}

document.addEventListener("DOMContentLoaded", async () => {
  await inject("navbar-container", "components/navbar.html");
  await inject("footer-container", "components/footer.html");
  setYear();
});
