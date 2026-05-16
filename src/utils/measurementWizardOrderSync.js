import { getOrderById, patchOrderWizardFields } from "../api/ordersApi.js";
import {
  buildMeasurementOrderPayload,
  measurementOrderPayloadToServerBody,
  resolveOrderCustomerId,
} from "./measurementOrderPayload.js";
import { normalizeConversationId } from "../chatUtils.js";

let linkedWizardOrderIdMemory = null;

export const WIZARD_LINKED_ORDER_SESSION_KEY = "sewserve_wizard_linked_order_id";
export const WIZARD_CLIENT_ORDER_SESSION_KEY = "sewserve_wizard_client_order_id";

function readSessionOrderId(key) {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(key) != null ? String(sessionStorage.getItem(key)).trim() : "";
  } catch {
    return "";
  }
}

function writeSessionOrderId(key, value) {
  if (typeof window === "undefined") return;
  try {
    const v = value != null ? String(value).trim() : "";
    if (v) sessionStorage.setItem(key, v);
    else sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getLinkedWizardOrderId() {
  if (linkedWizardOrderIdMemory && String(linkedWizardOrderIdMemory).trim() !== "") {
    return String(linkedWizardOrderIdMemory).trim();
  }
  const fromSession = readSessionOrderId(WIZARD_LINKED_ORDER_SESSION_KEY);
  if (fromSession) {
    linkedWizardOrderIdMemory = fromSession;
    return fromSession;
  }
  return null;
}

export function getWizardClientOrderId() {
  return readSessionOrderId(WIZARD_CLIENT_ORDER_SESSION_KEY) || null;
}

export function setLinkedWizardOrderId(mongoId) {
  const v = mongoId ? String(mongoId).trim() : "";
  linkedWizardOrderIdMemory = v || null;
  writeSessionOrderId(WIZARD_LINKED_ORDER_SESSION_KEY, v);
}

export function setWizardClientOrderId(clientOrderId) {
  writeSessionOrderId(WIZARD_CLIENT_ORDER_SESSION_KEY, clientOrderId);
}

export function clearLinkedWizardOrderId() {
  linkedWizardOrderIdMemory = null;
  writeSessionOrderId(WIZARD_LINKED_ORDER_SESSION_KEY, "");
  writeSessionOrderId(WIZARD_CLIENT_ORDER_SESSION_KEY, "");
}

/** Restore linked order id from server-saved wizard draft. */
export function hydrateLinkedOrderIdFromDraft(draftLinked) {
  if (draftLinked == null || String(draftLinked).trim() === "") return;
  setLinkedWizardOrderId(String(draftLinked).trim());
}

/** True when tailor accepted the order the customer is currently filling in the wizard. */
export function wizardOrderAcceptMatches(payload, currentWizardOrderId) {
  const current = normalizeConversationId(currentWizardOrderId);
  if (!current) return false;

  const acceptedMongo = normalizeConversationId(
    payload?.orderId ?? payload?.conversationId ?? ""
  );
  if (acceptedMongo && acceptedMongo === current) return true;

  const clientAccepted = String(payload?.clientOrderId || "").trim();
  const storedClient = getWizardClientOrderId();
  if (clientAccepted && storedClient && clientAccepted === storedClient) return true;

  return false;
}

function authIdsMatch(a, b) {
  const sa = a != null ? String(a).trim() : "";
  const sb = b != null ? String(b).trim() : "";
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const na = Number(sa);
  const nb = Number(sb);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na === nb) return true;
  return false;
}

/** Returns false if linked order belongs to another customer (or cannot be verified). */
async function linkedOrderBelongsToCurrentUser(linkedId, authUser) {
  const authCid = resolveOrderCustomerId(authUser);
  if (!linkedId || !authCid) return false;
  try {
    const doc = await getOrderById(linkedId);
    const orderCid = doc?.customerId != null ? String(doc.customerId).trim() : "";
    return authIdsMatch(orderCid, authCid);
  } catch {
    return false;
  }
}

function buildPayloadAndFlat(snapshot, authUser, options = {}) {
  const tailorResolutionHints = options.tailorResolutionHints;
  const override =
    snapshot && typeof snapshot.assignedTailorShopId === "string"
      ? snapshot.assignedTailorShopId.trim()
      : "";
  const displayName =
    snapshot && typeof snapshot.assignedTailorDisplayName === "string"
      ? snapshot.assignedTailorDisplayName.trim()
      : "";
  const payload = buildMeasurementOrderPayload({
    customerInfo: snapshot.customerInfo,
    selectedGarmentType: snapshot.selectedGarmentType,
    customGarmentType: snapshot.customGarmentType,
    measurements: snapshot.measurements,
    styleOptions: snapshot.styleOptions,
    designBrief: snapshot.designBrief,
    selectedNeck: snapshot.selectedNeck,
    authUser,
    tailorShopIdOverride: override || undefined,
    assignedTailorDisplayName: displayName || undefined,
    snapshotForTailorResolve: snapshot,
    tailorResolutionHints,
  });
  return { payload, flat: measurementOrderPayloadToServerBody(payload) };
}

function sanitizeOrderPayloadBlob(blob) {
  if (!blob || typeof blob !== "object" || Array.isArray(blob)) return blob;
  const out = { ...blob };
  delete out.tailorId;
  delete out.tailorShopId;
  delete out.assignedTailorId;
  delete out.assignedTailorShopId;
  return out;
}

function pickPatchBody(flat) {
  const o = {
    customerName: flat.customerName,
    customerId: flat.customerId,
    customerPhone: flat.customerPhone,
    garmentType: flat.garmentType,
    garmentCategory: flat.garmentCategory,
    measurements: flat.measurements,
    style: flat.style,
    notes: flat.notes,
    orderPayload: sanitizeOrderPayloadBlob(flat.orderPayload),
    dueDate: flat.dueDate,
    source: flat.source,
    orderId: flat.orderId,
  };
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null)
  );
}

/**
 * @param {object} snapshot
 * @param {object | null} authUser
 * @param {{ rejectOnCreateFailure?: boolean }} [options] — when true (final wizard submit), surface API errors instead of failing silently.
 */
export async function syncWizardOrderToServer(snapshot, authUser, options = {}) {
  const { rejectOnCreateFailure = false, tailorResolutionHints } = options;
  if (typeof window === "undefined") return;
  if (!snapshot || typeof snapshot !== "object") return;

  const { payload, flat } = buildPayloadAndFlat(snapshot, authUser, { tailorResolutionHints });
  if (flat.orderId) setWizardClientOrderId(String(flat.orderId));

  let linked = getLinkedWizardOrderId();
  if (linked) {
    const owned = await linkedOrderBelongsToCurrentUser(linked, authUser);
    if (!owned) {
      console.warn("[measurement sync] clearing stale linked order (wrong customer)", linked);
      clearLinkedWizardOrderId();
      linked = null;
    }
  }

  if (!linked) return null;
  try {
    const patch = pickPatchBody(flat);
    await patchOrderWizardFields(linked, patch);
    return linked;
  } catch (e) {
    console.warn("[measurement sync] patch failed", e);
    return null;
  }
}
