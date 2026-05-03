import { socket } from "../socket.js";
import { resolveTailorIdForCustomerChat } from "./chatIdentity.js";
import { tailorId as dashboardDefaultTailorId } from "../tailorDashboard/constants.js";
import { patchOrderWizardFields } from "../api/ordersApi.js";
import { getLinkedWizardOrderId, syncWizardOrderToServer } from "./measurementWizardOrderSync.js";

function cloneWizardState(wizardData) {
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(wizardData);
    }
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(JSON.stringify(wizardData));
  } catch {
    return wizardData;
  }
}

/**
 * Sets stable `wizardData.image` for socket/API (data URL or remote URL only — no blob: URLs).
 * Prefers `referenceImage.dataUrl`, then existing string `image`.
 * @param {Record<string, unknown>} wd — cloned wizard payload (mutated)
 */
function normalizeWizardImageForEmit(wd) {
  if (!wd || typeof wd !== "object" || Array.isArray(wd)) return;
  const ref = wd.referenceImage;
  if (ref && typeof ref === "object" && !Array.isArray(ref) && typeof ref.dataUrl === "string" && ref.dataUrl.trim() !== "") {
    wd.image = ref.dataUrl.trim();
    return;
  }
  if (typeof wd.image === "string" && wd.image.trim() !== "") {
    wd.image = wd.image.trim();
  }
}

/** Socket.io may drop huge payloads; keep DB patch full, slim only the realtime event. */
const MAX_MEASUREMENT_REVIEW_SOCKET_BYTES = 450000;

function isStableImageUrl(s) {
  if (typeof s !== "string" || !s.trim()) return false;
  const t = s.trim();
  return /^https?:\/\//i.test(t) || t.startsWith("/");
}

/**
 * @returns {{ orderId: string, tailorId: string, timestamp: number, wizardData: object, wizardImageDeferred?: boolean }}
 */
function buildMeasurementReviewSocketPayload(orderId, tailorId, full) {
  const timestamp = Date.now();
  const base = {
    orderId,
    tailorId,
    timestamp,
    wizardData: full,
  };
  let size = 0;
  try {
    size = JSON.stringify(base).length;
  } catch {
    return base;
  }
  if (size <= MAX_MEASUREMENT_REVIEW_SOCKET_BYTES) {
    return base;
  }

  const slim = cloneWizardState(full);
  normalizeWizardImageForEmit(slim);
  if (typeof slim.image === "string" && slim.image.startsWith("data:")) {
    slim.image = null;
  }
  if (slim.referenceImage && typeof slim.referenceImage === "object") {
    const name = slim.referenceImage.name;
    slim.referenceImage = name ? { name: String(name) } : null;
  }
  if (typeof slim.image === "string" && !isStableImageUrl(slim.image)) {
    slim.image = null;
  }

  console.warn(
    `[measurement:review emit] Payload ~${size} bytes; sending slim wizardData for socket (full snapshot remains on server).`
  );

  return {
    orderId,
    tailorId,
    timestamp,
    wizardData: slim,
    wizardImageDeferred: true,
  };
}

/**
 * Persists the order, stores the complete wizard state on the order document, then emits
 * measurement:review with a single unfiltered `wizardData` object.
 * @param {Record<string, unknown>} wizardData — entire wizard state (no field picking)
 * @param {object | null} authUser
 */
export async function emitWizardMeasurementReview(wizardData, authUser) {
  if (typeof window === "undefined" || !wizardData || typeof wizardData !== "object") {
    return { ok: false, orderId: null };
  }
  const full = cloneWizardState(wizardData);
  normalizeWizardImageForEmit(full);
  const syncedOrderId = await syncWizardOrderToServer(full, authUser);
  const orderId = syncedOrderId || getLinkedWizardOrderId();
  if (!orderId) {
    throw new Error("Could not create order from wizard. Please try again.");
  }
  try {
    await patchOrderWizardFields(orderId, { orderPayload: full });
  } catch (e) {
    console.warn("[review emit] could not persist full wizard state on order", e);
  }
  const assigned =
    full && typeof full.assignedTailorShopId === "string" && full.assignedTailorShopId.trim()
      ? full.assignedTailorShopId.trim()
      : "";
  const tailorId = String(
    assigned || resolveTailorIdForCustomerChat(authUser) || dashboardDefaultTailorId
  );
  const socketPayload = buildMeasurementReviewSocketPayload(orderId, tailorId, full);
  console.log("[measurement:review emit] wizardData.image:", socketPayload?.wizardData?.image);
  socket.emit("measurement:review", socketPayload);
  return { ok: true, orderId };
}
