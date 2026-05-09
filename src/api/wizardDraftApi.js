import { getWizardDraft as getDraft, putWizardDraft as putDraft } from "./accountApi.js";

/**
 * Measurement wizard draft — persisted on the user document via `/api/account/wizard-draft`.
 * @param {object} payload Full wizard snapshot
 * @param {object | null} user Auth user (customer)
 * @returns {Promise<{ ok?: boolean }>}
 */
export async function saveWizardDraft(payload, user) {
  if (!user || user.id == null) {
    return { ok: false };
  }
  try {
    await putDraft(user, payload);
    return { ok: true };
  } catch (e) {
    console.warn("[wizardDraftApi] save failed", e);
    return { ok: false };
  }
}

/**
 * @param {object | null} user
 * @returns {Promise<object | null>} draft blob or null
 */
export async function loadWizardDraft(user) {
  if (!user || user.id == null) return null;
  try {
    const data = await getDraft(user);
    return data && data.draft && typeof data.draft === "object" ? data.draft : null;
  } catch {
    return null;
  }
}
