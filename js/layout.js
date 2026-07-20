(function () {
  const R = typeof SITE_ROOT !== 'undefined' ? SITE_ROOT : '';

  const NAV_HTML = `
    <nav class="site-nav" id="site-nav">
      <a href="${R}index.html">Inicio</a>
      <a href="${R}blog.html">Blog</a>
      <div class="nav-dropdown">
        <span>Guías ▾</span>
        <div class="nav-dropdown-menu">
          <a class="ro"  href="${R}juego/ragnarok.html">Ragnarok Online</a>
          <a class="wow" href="${R}juego/wow.html">World of Warcraft</a>
        </div>
      </div>
      <div class="nav-auth" id="nav-auth"></div>
    </nav>
  `;

  const FOOTER_HTML = `
    <footer class="site-footer">
      <div class="footer-inner">
        <span>&copy; 2026 Scythe Society &mdash; Sunshine Squad</span>
        <a href="https://github.com/ScytheSociety/sunshinesquad" target="_blank" rel="noopener">GitHub</a>
      </div>
    </footer>
  `;

  document.addEventListener('DOMContentLoaded', () => {
    /* ── Logo: reemplazar texto por imagen ──────────── */
    const logoEl = document.querySelector('.site-logo');
    if (logoEl) {
      logoEl.innerHTML = `<img src="${R}img/logo/sunshine_squad.png" alt="Sunshine Squad">`;
    }

    /* ── Inyectar nav ─────────────────────────────── */
    const navSlot = document.getElementById('site-nav-slot');
    if (navSlot) navSlot.outerHTML = NAV_HTML;

    /* ── Inyectar footer ──────────────────────────── */
    const footSlot = document.getElementById('site-footer-slot');
    if (footSlot) footSlot.outerHTML = FOOTER_HTML;

    /* ── Marcar page activa ────────────────────────── */
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav > a').forEach(a => {
      if (a.getAttribute('href') && a.getAttribute('href').endsWith(path)) {
        a.setAttribute('aria-current', 'page');
      }
    });

    /* ── Hamburguesa ──────────────────────────────── */
    const toggle = document.getElementById('nav-toggle');
    const nav    = document.getElementById('site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        nav.classList.toggle('open');
        toggle.textContent = nav.classList.contains('open') ? '✕' : '☰';
      });
    }

    /* ── Auth en nav ──────────────────────────────── */
    const authArea = document.getElementById('nav-auth');
    if (authArea) {
      fetch(`${R}api/auth/me`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(user => {
          if (!user) {
            authArea.innerHTML = `<a href="${R}api/auth/discord" class="btn">Login Discord</a>`;
          } else {
            const adminLink = user.is_owner
              ? `<a href="${R}admin.html" class="btn btn-admin">Admin</a>`
              : '';
            authArea.innerHTML = `
              <div class="nav-user">
                <img src="${user.avatar || ''}" alt="${user.username}" onerror="this.style.display='none'">
                <span>${user.username}</span>
              </div>
              ${adminLink}
              <a href="${R}api/auth/logout" class="btn btn-logout">Salir</a>
            `;
          }
        })
        .catch(() => {
          authArea.innerHTML = `<a href="${R}api/auth/discord" class="btn">Login Discord</a>`;
        });
    }
  });
})();
