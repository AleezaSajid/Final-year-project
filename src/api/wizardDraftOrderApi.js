import { api, getApiBaseUrl } from "./client.js";
import {
  buildMeasurementOrderPayload,
  measurementOrderPayloadToServerBody,
  resolveOrderCustomerId,
} from "../utils/measurementOrderPayload.js";
import {
  clearLinkedWizardOrderId,
  setLinkedWizardOrderId,
  setWizardClientOrderId,
} from "../utils/measurementWizardOrderSync.js";

/**
 * Create a server draft order after wizard completion — no tailor until map selection.
 * @param {object} snapshot — full wizard state
 * @param {object | null} authUser
 */
export async function createWizardDraftOrder(snapshot, authUser) {
  const customerId = resolveOrderCustomerId(authUser);
  if (!customerId) {
    throw new Error("Please sign in to place an order.");
  }
  const payload = buildMeasurementOrderPayload({
    customerInfo: snapshot.customerInfo,
    selectedGarmentType: snapshot.selectedGarmentType,
    customGarmentType: snapshot.customGarmentType,
    measurements: snapshot.measurements,
    styleOptions: snapshot.styleOptions,
    designBrief: snapshot.designBrief,
    selectedNeck: snapshot.selectedNeck,
    authUser,
    tailorShopIdOverride: "",
    snapshotForTailorResolve: snapshot,
  });
  const flat = measurementOrderPayloadToServerBody({ ...payload, tailorId: "" });
  const body = {
    ...flat,
    tailorId: "",
    status: "draft",
    createDraft: true,
    awaitingTailorSelection: true,
    isActive: false,
    chatEnabled: false,
    orderPayload: snapshot,
  };
  clearLinkedWizardOrderId();
  let created;
  try {
    created = await api("/api/orders", { method: "POST", json: body });
  } catch (err) {
    const base = getApiBaseUrl();
    if (!base || !(err && (err.status === 404 || err.status === 405))) throw err;
    const res = await fetch(`${base}/orders`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw.slice(0, 200) };
      }
    }
    if (!res.ok) {
      throw new Error(data.message || data.error || res.statusText || "Could not save draft order.");
    }
    created = data;
  }
  const id = created && (created._id != null ? created._id : created.id);
  if (id) setLinkedWizardOrderId(String(id));
  if (created?.clientOrderId) setWizardClientOrderId(String(created.clientOrderId));
  return { orderId: id ? String(id) : null, order: created };
}
