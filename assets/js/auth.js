// ── Módulo de autenticación Discord ────────────────────────────────
// Uso: import { getUser, requireLogin, logout, apiFetch } from "/assets/js/auth.js";

const API = "https://sunshinesquad.es/api";

// Devuelve el usuario del JWT almacenado, o null si no hay sesión
export function getUser() {
  const token = localStorage.getItem("ss_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Verificar expiración
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem("ss_token");
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Redirige al login de Discord si no hay sesión
export function requireLogin() {
  if (!getUser()) {
    sessionStorage.setItem("ss_login_redirect", window.location.pathname);
    window.location.href = `${API}/auth/discord`;
    return false;
  }
  return true;
}

// Cierra sesión
export function logout() {
  localStorage.removeItem("ss_token");
  window.location.href = "/";
}

// fetch con token JWT incluido automáticamente
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("ss_token");
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("ss_token");
    sessionStorage.setItem("ss_login_redirect", window.location.pathname);
    window.location.href = `${API}/auth/discord`;
    return null;
  }

  return res;
}

// Inyecta el botón de login/usuario en el navbar
export function renderAuthButton(containerId = "auth-btn-container") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = getUser();
  if (user) {
    container.innerHTML = `
      <div class="dropdown">
        <button class="btn btn-sm d-flex align-items-center gap-2 dropdown-toggle"
          style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:10px;padding:.35rem .75rem;"
          data-bs-toggle="dropdown" aria-expanded="false">
          <img src="${user.avatar}" alt="${user.username}" width="24" height="24"
               style="border-radius:50%;border:1.5px solid #6366f1;flex-shrink:0;">
          <span class="d-none d-md-inline" style="font-size:.85rem;">${user.username}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end"
            style="background:rgba(10,13,20,.97);border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:.5rem;min-width:170px;backdrop-filter:blur(12px);">
          <li>
            <a class="dropdown-item" href="/pages/perfil/perfil.html?id=${user.id}"
               style="border-radius:8px;color:rgba(255,255,255,.75);font-size:.85rem;padding:.4rem .75rem;text-decoration:none;">
              👤 Mi perfil
            </a>
          </li>
          <li><hr class="dropdown-divider" style="border-color:rgba(255,255,255,.08);margin:.3rem 0;"></li>
          <li>
            <button class="dropdown-item" id="logout-btn"
              style="border-radius:8px;color:rgba(255,100,100,.8);font-size:.85rem;padding:.4rem .75rem;background:none;border:none;width:100%;text-align:left;cursor:pointer;">
              Cerrar sesión
            </button>
          </li>
        </ul>
      </div>`;
    document.getElementById("logout-btn")?.addEventListener("click", logout);
  } else {
    container.innerHTML = `
      <a href="${API}/auth/discord" class="btn btn-sm btn-indigo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="me-1">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
        Iniciar sesión
      </a>`;
  }
}
