/** In-memory tailor orders keyed by shop id (survives useTailorDashboard remounts). */
const store = new Map();

export function getCachedTailorOrders(shopId) {
  const id = String(shopId || "").trim();
  if (!id) return null;
  const rows = store.get(id);
  return Array.isArray(rows) && rows.length > 0 ? rows : null;
}

export function setCachedTailorOrders(shopId, rows) {
  const id = String(shopId || "").trim();
  if (!id) return;
  if (!Array.isArray(rows) || rows.length === 0) return;
  store.set(id, rows);
}

export function clearCachedTailorOrders(shopId) {
  const id = String(shopId || "").trim();
  if (id) store.delete(id);
}

/** Last active shop id in this tab — detects real shop switch vs route remount. */
let sessionTailorShopId = "";

export function getSessionTailorShopId() {
  return sessionTailorShopId;
}

export function setSessionTailorShopId(shopId) {
  sessionTailorShopId = String(shopId || "").trim();
}
