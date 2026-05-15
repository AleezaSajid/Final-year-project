import { createMeasurementOrder, patchOrderWizardFields } from "../api/ordersApi.js";
import {
  buildMeasurementOrderPayload,
  canCreateMeasurementOrderOnServer,
  measurementOrderPayloadToServerBody,
} from "./measurementOrderPayload.js";

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
 * @param {object} snapshot
 * @param {object | null} authUser
 * @param {{ rejectOnCreateFailure?: boolean }} [options] — when true (final wizard submit), surface API errors instead of failing silently.
 */
export async function syncWizardOrderToServer(snapshot, authUser, options = {}) {
  const { rejectOnCreateFailure = false, tailorResolutionHints } = options;
  if (typeof window === "undefined") return;
  if (!snapshot || typeof snapshot !== "object") return;

  const { payload, flat } = buildPayloadAndFlat(snapshot, authUser, { tailorResolutionHints });
  let linked = getLinkedWizardOrderId();

  if (!linked) {
    if (createOrderPromise) {
      await createOrderPromise;
      linked = getLinkedWizardOrderId();
    }
    if (!linked && !canCreateMeasurementOrderOnServer(snapshot, authUser, tailorResolutionHints)) {
      return null;
    }
    if (!linked) {
      createOrderPromise = (async () => {
        try {
          const created = await createMeasurementOrder(payload);
          const id = created && (created._id != null ? created._id : created.id);
          if (id) setLinkedWizardOrderId(String(id));
        } catch (e) {
          console.warn("[measurement sync] create failed", e);
          if (rejectOnCreateFailure) {
            throw e instanceof Error ? e : new Error(String(e));
          }
        } finally {
          createOrderPromise = null;
        }
      })();
      try {
        await createOrderPromise;
      } catch (e) {
        if (rejectOnCreateFailure) throw e;
      }
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
