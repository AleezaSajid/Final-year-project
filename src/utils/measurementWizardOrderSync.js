import { createMeasurementOrder, patchOrderWizardFields } from "../api/ordersApi.js";
import { buildMeasurementOrderPayload, measurementOrderPayloadToServerBody } from "./measurementOrderPayload.js";

let linkedWizardOrderIdMemory = null;

export function getLinkedWizardOrderId() {
  return linkedWizardOrderIdMemory && String(linkedWizardOrderIdMemory).trim() !== ""
    ? String(linkedWizardOrderIdMemory).trim()
    : null;
}

export function setLinkedWizardOrderId(mongoId) {
  linkedWizardOrderIdMemory = mongoId ? String(mongoId).trim() : null;
}

export function clearLinkedWizardOrderId() {
  linkedWizardOrderIdMemory = null;
}

/** Restore linked order id from server-saved wizard draft (in-memory only for this session). */
export function hydrateLinkedOrderIdFromDraft(draftLinked) {
  if (draftLinked == null || String(draftLinked).trim() === "") return;
  linkedWizardOrderIdMemory = String(draftLinked).trim();
}

let createOrderPromise = null;

function buildPayloadAndFlat(snapshot, authUser) {
  const override =
    snapshot && typeof snapshot.assignedTailorShopId === "string"
      ? snapshot.assignedTailorShopId.trim()
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
