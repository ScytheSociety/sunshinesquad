(function () {
  const R = typeof SITE_ROOT !== 'undefined' ? SITE_ROOT : '';

  function escH(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* Nav con el menú de juegos hardcodeado como fallback — se reemplaza tras fetch */
  const NAV_HTML = `
    <nav class="site-nav" id="site-nav">
      <a href="${R}index.html">Inicio</a>
      <a href="${R}blog.html">Blog</a>
      <div class="nav-dropdown">
        <span>Juegos &#9660;</span>
        <div class="nav-dropdown-menu" id="nav-games-menu">
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

    /* ── Menú de juegos dinámico desde API ─────────── */
    fetch(`${R}api/games`)
      .then(r => r.json())
      .then(games => {
        const menu = document.getElementById('nav-games-menu');
        if (!menu || !games.length) return;
        menu.innerHTML = games.map(g => {
          const isRo  = g.slug === 'ragnarok';
          const isWow = g.slug === 'wow';
          const cls   = isRo ? 'ro' : isWow ? 'wow' : '';
          const style = (!isRo && !isWow) ? ` style="border-left:3px solid ${escH(g.color)} !important"` : '';
          return `<a class="${cls}" href="${R}juego/${escH(g.slug)}.html"${style}>${escH(g.name)}</a>`;
        }).join('');
      })
      .catch(() => {});

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

    /* ── Toggle tema claro/oscuro ──────────────────── */
    const headerInner = document.querySelector('.header-inner');
    if (headerInner) {
      const themeBtn = document.createElement('button');
      themeBtn.className = 'theme-toggle';
      themeBtn.id = 'theme-toggle';
      themeBtn.type = 'button';
      themeBtn.setAttribute('aria-label', 'Cambiar tema claro/oscuro');
      headerInner.insertBefore(themeBtn, toggle || null);

      const setIcon = () => {
        themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
      };
      setIcon();

      themeBtn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('ss-theme', next); } catch {}
        setIcon();
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
                <img src="${user.avatar || ''}" alt="${escH(user.username)}" onerror="this.style.display='none'">
                <span>${escH(user.username)}</span>
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
