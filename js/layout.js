// ===================================================================
// LAYOUT.JS
// -------------------------------------------------------------------
// Que hace: genera el <nav> y el <footer> UNA sola vez aqui, y los
// inyecta en cualquier pagina que tenga los marcadores:
//   <div id="site-nav"></div>
//   <div id="site-footer"></div>
//
// Por que: asi si cambias un link del menu o el texto del footer,
// lo haces en ESTE archivo y se actualiza en TODO el sitio, sin
// tener que editar pagina por pagina.
//
// SITE_ROOT: como el sitio tiene paginas a distinta profundidad
// (index.html esta en la raiz, las guias estan en /guias/...),
// cada pagina debe declarar una variable SITE_ROOT ANTES de cargar
// este script, indicando cuantas carpetas hay que subir para volver
// a la raiz:
//   - en index.html (raiz):      const SITE_ROOT = "";
//   - en guias/algo.html:        const SITE_ROOT = "../";
//   - en posts/algo.html:        const SITE_ROOT = "../";
// Con eso los links del nav funcionan igual sin importar en que
// carpeta este la pagina.
// ===================================================================

(function () {
  const ROOT = typeof SITE_ROOT !== 'undefined' ? SITE_ROOT : '';

  // ---- NAV --------------------------------------------------------
  // El link "Guias" tiene un submenu (dropdown) que aparece al
  // pasar el mouse (el hover esta definido en css/header.css).
  const navHTML = `
    <nav class="nav">
      <a href="${ROOT}index.html">Inicio</a>
      <a href="${ROOT}blog.html">Blog</a>
      <div class="nav-dropdown">
        <a href="${ROOT}guias.html">Guias</a>
        <div class="nav-dropdown-menu">
          <a href="${ROOT}guias/ragnarok.html">Ragnarok Online uaRO</a>
          <a href="${ROOT}guias/wow.html">World of Warcraft</a>
        </div>
      </div>
    </nav>
  `;

  // ---- FOOTER -------------------------------------------------------
  const footerHTML = `
    <footer class="foot">
      <span>&copy; 2026 Scythe Society</span>
      <a href="https://github.com/ScytheSociety/sunshinesquad">github</a>
    </footer>
  `;

  document.addEventListener('DOMContentLoaded', () => {
    const navPlaceholder = document.getElementById('site-nav');
    const footerPlaceholder = document.getElementById('site-footer');
    if (navPlaceholder) navPlaceholder.outerHTML = navHTML;
    if (footerPlaceholder) footerPlaceholder.outerHTML = footerHTML;
  });
})();