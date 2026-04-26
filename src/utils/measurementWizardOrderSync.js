import { createMeasurementOrder, patchOrderWizardFields } from "../api/ordersApi.js";
import { buildMeasurementOrderPayload, measurementOrderPayloadToServerBody } from "./measurementOrderPayload.js";
import { CUSTOMER_ID_STORAGE_KEY, TAILOR_SESSION_STORAGE_KEY } from "./chatIdentity.js";

export const WIZARD_LINKED_ORDER_ID_KEY = "sewserve_wizard_linked_order_id";

export function getLinkedWizardOrderId() {
  if (typeof window === "undefined") return null;
  try {
    const id = localStorage.getItem(WIZARD_LINKED_ORDER_ID_KEY);
    return id && String(id).trim() !== "" ? String(id).trim() : null;
  } catch {
    return null;
  }
}

export function setLinkedWizardOrderId(mongoId) {
  if (typeof window === "undefined" || !mongoId) return;
  try {
    localStorage.setItem(WIZARD_LINKED_ORDER_ID_KEY, String(mongoId));
  } catch {
    // ignore
  }
}

export function clearLinkedWizardOrderId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WIZARD_LINKED_ORDER_ID_KEY);
  } catch {
    // ignore
  }
}

let createOrderPromise = null;

function buildPayloadAndFlat(snapshot, authUser) {
  const payload = buildMeasurementOrderPayload({
    customerInfo: snapshot.customerInfo,
    selectedGarmentType: snapshot.selectedGarmentType,
    customGarmentType: snapshot.customGarmentType,
    measurements: snapshot.measurements,
    styleOptions: snapshot.styleOptions,
    designBrief: snapshot.designBrief,
    selectedNeck: snapshot.selectedNeck,
    authUser,
  });
  return { payload, flat: measurementOrderPayloadToServerBody(payload) };
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
    orderPayload: flat.orderPayload,
    dueDate: flat.dueDate,
    source: flat.source,
    orderId: flat.orderId,
  };
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null)
  );
}

/**
 * Pushes the current wizard snapshot to the same order the tailor list uses, creating the
 * document once, then PATCHing. Tailor subscribes via socket for immediate UI merge.
 * @param {object} snapshot — customerInfo, selectedGarmentType, customGarmentType, measurements, styleOptions, designBrief, selectedNeck
 * @param {object | null} authUser
 */
export async function syncWizardOrderToServer(snapshot, authUser) {
  if (typeof window === "undefined") return;
  if (!snapshot || typeof snapshot !== "object") return;

  const { payload, flat } = buildPayloadAndFlat(snapshot, authUser);
  try {
    if (payload?.customer?.id) {
      localStorage.setItem(CUSTOMER_ID_STORAGE_KEY, String(payload.customer.id));
    }
    if (payload?.tailorId) {
      localStorage.setItem(TAILOR_SESSION_STORAGE_KEY, String(payload.tailorId));
    }
  } catch {
    /* ignore storage errors */
  }
  let linked = getLinkedWizardOrderId();

  if (!linked) {
    if (createOrderPromise) {
      await createOrderPromise;
      linked = getLinkedWizardOrderId();
    }
    if (!linked) {
      createOrderPromise = (async () => {
        try {
          const created = await createMeasurementOrder(payload);
          const id = created && (created._id != null ? created._id : created.id);
          if (id) setLinkedWizardOrderId(String(id));
        } catch (e) {
          console.warn("[measurement sync] create failed", e);
        } finally {
          createOrderPromise = null;
        }
      })();
      await createOrderPromise;
      linked = getLinkedWizardOrderId();
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
