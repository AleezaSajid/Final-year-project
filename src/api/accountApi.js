import { api } from "./client.js";

function accountBody(user) {
  if (!user || user.id == null || !user.email) return null;
  return {
    userId: user.id,
    email: String(user.email).trim().toLowerCase(),
  };
}

function accountQuery(user) {
  const b = accountBody(user);
  if (!b) return null;
  return `userId=${encodeURIComponent(b.userId)}&email=${encodeURIComponent(b.email)}`;
}

export async function getWizardDraft(user) {
  const q = accountQuery(user);
  if (!q) return { draft: null, updatedAt: null };
  return api(`/api/account/wizard-draft?${q}`);
}

export async function putWizardDraft(user, draft) {
  const b = accountBody(user);
  if (!b) throw new Error("Not signed in.");
  return api("/api/account/wizard-draft", {
    method: "PUT",
    json: { ...b, draft },
  });
}

export async function getCustomerMeta(user) {
  const q = accountQuery(user);
  if (!q) return null;
  try {
    return await api(`/api/account/customer-meta?${q}`);
  } catch {
    return null;
  }
}

export async function putCustomerMeta(user, partial) {
  const b = accountBody(user);
  if (!b) throw new Error("Not signed in.");
  return api("/api/account/customer-meta", {
    method: "PUT",
    json: { ...b, ...partial },
  });
}

export async function getTailorProfileSelf(user) {
  const q = accountQuery(user);
  if (!q) return null;
  try {
    return await api(`/api/tailor/profile-self?${q}`);
  } catch {
    return null;
  }
}

export async function patchTailorProfileSelf(user, fields) {
  const b = accountBody(user);
  if (!b) throw new Error("Not signed in.");
  return api("/api/tailor/profile-self", {
    method: "PATCH",
    json: { ...b, ...fields },
  });
}
