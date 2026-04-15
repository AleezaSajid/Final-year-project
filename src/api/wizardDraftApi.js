/**
 * Measurement wizard draft API — wire to backend when ready.
 * localStorage remains the source of truth until API is integrated.
 */

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

/**
 * @param {object} payload Full wizard snapshot (activeStep, measurements, data, draftVersion, …)
 * @returns {Promise<{ ok?: boolean, localOnly?: boolean }>}
 */
export async function saveWizardDraft(payload) {
  if (!API_BASE_URL) {
    return Promise.resolve({ ok: true, localOnly: true });
  }
  // Future: POST `${API_BASE_URL}/measurements/wizard/draft` with JSON body
  return Promise.resolve({ ok: true, localOnly: true });
}

/**
 * @param {string} userId Authenticated user id when auth exists
 * @returns {Promise<object | null>}
 */
export async function getWizardDraft(userId) {
  if (!API_BASE_URL || !userId) {
    return Promise.resolve(null);
  }
  // Future: GET `${API_BASE_URL}/measurements/wizard/draft?userId=…`
  return Promise.resolve(null);
}
