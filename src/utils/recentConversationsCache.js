/** In-memory recent-conversation rows keyed by role + user/shop id (survives route remounts). */
const store = new Map();

function cacheKey(role, id) {
  const r = String(role || "").trim();
  const i = String(id || "").trim();
  if (!r || !i) return "";
  return `${r}:${i}`;
}

export function getCachedConversations(role, id) {
  const key = cacheKey(role, id);
  if (!key) return null;
  const rows = store.get(key);
  return Array.isArray(rows) && rows.length > 0 ? rows : null;
}

export function setCachedConversations(role, id, rows) {
  const key = cacheKey(role, id);
  if (!key) return;
  if (!Array.isArray(rows) || rows.length === 0) return;
  store.set(key, rows);
}

export function clearCachedConversations(role, id) {
  const key = cacheKey(role, id);
  if (key) store.delete(key);
}
