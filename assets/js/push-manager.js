// Push notifications client manager
const API     = "https://sunshinesquad.es/api";
const SW_PATH = "/sw.js";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getRegistration() {
  if (!isPushSupported()) return null;
  try { return await navigator.serviceWorker.getRegistration(SW_PATH); } catch { return null; }
}

export async function isPushSubscribed() {
  const reg = await getRegistration();
  if (!reg) return false;
  try { return !!(await reg.pushManager.getSubscription()); } catch { return false; }
}

export function getPermission() {
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// Register SW and subscribe to push
export async function subscribeToPush(userId = null) {
  if (!isPushSupported()) throw new Error("Push no soportado en este navegador");
  if (Notification.permission === "denied") throw new Error("Notificaciones bloqueadas. Habilítalas en la configuración del navegador.");

  // Register SW
  let reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  await navigator.serviceWorker.ready;

  // Get VAPID public key
  const keyRes = await fetch(`${API}/push/vapid-public-key`);
  if (!keyRes.ok) throw new Error("Error obteniendo VAPID key");
  const { key } = await keyRes.json();

  // Convert VAPID key to Uint8Array
  const vapidKey = urlBase64ToUint8Array(key);

  // Request permission + subscribe
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  });

  // Send subscription to server
  const token = localStorage.getItem("ss_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  await fetch(`${API}/push/subscribe`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys:     { p256dh: arrayBufferToBase64(sub.getKey("p256dh")), auth: arrayBufferToBase64(sub.getKey("auth")) },
      user_id:  userId,
    }),
  });

  return sub;
}

export async function unsubscribeFromPush() {
  const reg = await getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await fetch(`${API}/push/unsubscribe`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });

  await sub.unsubscribe();
}

// ── Helpers ───────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function arrayBufferToBase64(buffer) {
  if (!buffer) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Auto-register SW on module load (passive, no permission prompt)
if (isPushSupported()) {
  navigator.serviceWorker.register(SW_PATH, { scope: "/" }).catch(() => {});
}
