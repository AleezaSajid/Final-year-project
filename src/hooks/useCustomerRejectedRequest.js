import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrderById } from "../api/ordersApi.js";
import { ensureSocketThen, socket } from "../socket.js";
import { resolveOrderCustomerId } from "../utils/measurementOrderPayload.js";
import {
  buildDeclinedNoticeFromOrder,
  declinedNoticeFromSocketPayload,
  orderIdsMatch,
} from "../utils/customerRejectedOrders.js";
import {
  addRejectedTailorIdForRequest,
  clearDeclineNoticeDismissedForRequest,
  isDeclineNoticeDismissedForRejection,
  isDeclineNoticeDismissedForRequest,
  isPublicTailorHiddenForRejectedRequest,
  markDeclineNoticeDismissedForRequest,
  persistDeclinedNoticeForRequest,
  readRejectedTailorIdsForRequest,
} from "../utils/customerRejectedRequest.js";

function isRejectedStatusToken(st) {
  const s = String(st || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return s === "rejected" || s === "declined";
}

function payloadMatchesLinkedOrder(payload, linkedOrderId) {
  const oid = String(linkedOrderId || "").trim();
  if (!oid) return false;
  if (!payload || typeof payload !== "object") return false;
  const direct = payload.orderId != null ? String(payload.orderId).trim() : "";
  if (direct && orderIdsMatch(direct, oid)) return true;
  const full = payload.fullOrder || payload.order;
  if (full && typeof full === "object") {
    const id = full.id != null ? String(full.id).trim() : "";
    const _id = full._id != null ? String(full._id).trim() : "";
    if ((id && orderIdsMatch(id, oid)) || (_id && orderIdsMatch(_id, oid))) return true;
  }
  return false;
}

function rejectionKeys(notice, fallbackOrderId = "") {
  const orderId = String(notice?.orderId || fallbackOrderId || "").trim();
  const tailorId = String(notice?.tailorId || "").trim();
  return { orderId, tailorId };
}

/**
 * Customer-side declined request: notice UI, hidden tailor ids, sockets, refresh sync.
 */
export function useCustomerRejectedRequest({
  user,
  linkedOrderId = "",
  tailorCatalog = [],
  lastRequest = null,
  lastRequestRef = null,
  onDeclined = null,
  debugTag = "",
} = {}) {
  const oid = String(linkedOrderId || "").trim();
  const logDebug = useCallback(
    (message, detail) => {
      if (!debugTag) return;
      if (detail !== undefined) console.log(`[${debugTag}] ${message}`, detail);
      else console.log(`[${debugTag}] ${message}`);
    },
    [debugTag]
  );
  const [declinedNotice, setDeclinedNotice] = useState(null);
  const [rejectedTailorIds, setRejectedTailorIds] = useState(() => readRejectedTailorIdsForRequest(oid));
  const dismissedRejectionRef = useRef(null);

  useEffect(() => {
    setRejectedTailorIds(readRejectedTailorIdsForRequest(oid));
    dismissedRejectionRef.current = null;
  }, [oid]);

  const resolveLastRequest = useCallback(() => {
    if (lastRequestRef?.current && typeof lastRequestRef.current === "object") {
      return lastRequestRef.current;
    }
    return lastRequest;
  }, [lastRequest, lastRequestRef]);

  const trackHiddenTailorFromNotice = useCallback((notice) => {
    const { orderId, tailorId } = rejectionKeys(notice, oid);
    if (orderId && tailorId) {
      setRejectedTailorIds(addRejectedTailorIdForRequest(orderId, tailorId));
    }
    persistDeclinedNoticeForRequest(notice);
  }, [oid]);

  const isNoticeSuppressed = useCallback(
    (notice) => {
      if (!notice || typeof notice !== "object") return false;
      const { orderId, tailorId } = rejectionKeys(notice, oid);
      const ref = dismissedRejectionRef.current;
      if (ref?.orderId && orderId && ref.orderId === orderId) {
        if (ref.tailorId && tailorId) {
          if (ref.tailorId === tailorId) return true;
        } else if (!ref.tailorId || !tailorId) {
          return true;
        }
      }
      if (isDeclineNoticeDismissedForRejection(notice)) return true;
      if (orderId && isDeclineNoticeDismissedForRequest(orderId, tailorId)) return true;
      return false;
    },
    [oid]
  );

  const applyDeclinedNotice = useCallback(
    (notice) => {
      if (!notice || typeof notice !== "object") return;
      trackHiddenTailorFromNotice(notice);
      if (isNoticeSuppressed(notice)) {
        logDebug("notice suppressed", notice);
        return;
      }
      logDebug("notice built", notice);
      setDeclinedNotice(notice);
      onDeclined?.(notice);
    },
    [trackHiddenTailorFromNotice, isNoticeSuppressed, onDeclined, logDebug]
  );

  const dismissNotice = useCallback(() => {
    const { orderId, tailorId } = rejectionKeys(declinedNotice, oid);
    if (orderId) {
      markDeclineNoticeDismissedForRequest(orderId, tailorId);
      dismissedRejectionRef.current = { orderId, tailorId };
    }
    setDeclinedNotice(null);
  }, [declinedNotice, oid]);

  const syncDeclinedFromOrder = useCallback(
    async (orderIdOverride) => {
      const target = String(orderIdOverride || oid).trim();
      if (!target || user?.role !== "customer") return false;
      try {
        const order = await getOrderById(target);
        const built = buildDeclinedNoticeFromOrder(order, tailorCatalog, resolveLastRequest());
        if (built) {
          trackHiddenTailorFromNotice(built);
          if (!isNoticeSuppressed(built)) {
            setDeclinedNotice(built);
          }
          return true;
        }
      } catch {
        /* keep existing notice */
      }
      return false;
    },
    [oid, user?.role, tailorCatalog, resolveLastRequest, trackHiddenTailorFromNotice, isNoticeSuppressed]
  );

  const ingestSocketPayload = useCallback(
    (payload, data = null) => {
      logDebug("event received", { payload, data, linkedOrderId: oid });
      if (!oid) {
        logDebug("skip — no linked order id");
        return;
      }
      if (!payloadMatchesLinkedOrder(payload, oid) && !payloadMatchesLinkedOrder(data, oid)) {
        logDebug("skip — order id mismatch", { payloadOrderId: payload?.orderId, dataOrderId: data?.orderId });
        return;
      }
      const built = declinedNoticeFromSocketPayload(
        { ...payload, orderId: payload?.orderId || data?.orderId || oid },
        tailorCatalog,
        resolveLastRequest()
      );
      if (built) {
        applyDeclinedNotice(built);
        return;
      }
      const st = String(
        data?.status ||
          data?.workflowStatus ||
          data?.fullOrder?.status ||
          data?.fullOrder?.workflowStatus ||
          payload?.status ||
          ""
      )
        .trim()
        .toLowerCase();
      if (data && isRejectedStatusToken(st)) {
        applyDeclinedNotice(
          buildDeclinedNoticeFromOrder(
            {
              ...(data.fullOrder || data.order || {}),
              id: data.orderId || oid,
              _id: data.orderId || oid,
              tailorId: data.tailorId ?? data.fullOrder?.tailorId ?? payload?.tailorId,
              rejectionReason:
                data.rejectionReason ??
                data.fullOrder?.rejectionReason ??
                data.patch?.rejectionReason ??
                payload?.rejectionReason,
              status: st,
              workflowStatus: data.workflowStatus ?? data.fullOrder?.workflowStatus,
            },
            tailorCatalog,
            resolveLastRequest()
          )
        );
        return;
      }
      void syncDeclinedFromOrder(oid);
    },
    [oid, tailorCatalog, resolveLastRequest, applyDeclinedNotice, syncDeclinedFromOrder, logDebug]
  );

  useEffect(() => {
    if (!user?.id || user.role !== "customer") return undefined;
    const joinCustomer = () => {
      const cid = resolveOrderCustomerId(user);
      if (cid) socket.emit("join_user", { userId: cid });
    };
    ensureSocketThen(joinCustomer);
    socket.on("connect", joinCustomer);

    const onRefresh = () => {
      void syncDeclinedFromOrder(oid);
    };
    const onRejected = (payload = {}) => {
      logDebug("socket orderRejected", payload);
      ingestSocketPayload(payload);
    };
    const onStatus = (data = {}) => {
      const st = String(
        data.status || data.workflowStatus || data.fullOrder?.status || data.fullOrder?.workflowStatus || ""
      )
        .trim()
        .toLowerCase();
      if (st === "rejected" || st === "declined") {
        logDebug("socket order:statusUpdated rejected", data);
        ingestSocketPayload({ ...data, orderId: data.orderId || oid, status: st }, data);
      }
    };

    window.addEventListener("sewserve:orders-refresh", onRefresh);
    socket.on("orderRejected", onRejected);
    socket.on("order:statusUpdated", onStatus);
    return () => {
      socket.off("connect", joinCustomer);
      window.removeEventListener("sewserve:orders-refresh", onRefresh);
      socket.off("orderRejected", onRejected);
      socket.off("order:statusUpdated", onStatus);
    };
  }, [user, oid, syncDeclinedFromOrder, ingestSocketPayload, logDebug]);

  const showDeclinedNotice = Boolean(
    declinedNotice && !isNoticeSuppressed(declinedNotice)
  );

  useEffect(() => {
    if (!debugTag) return;
    logDebug("modal visible", showDeclinedNotice);
    logDebug("dismissed ids", [...rejectedTailorIds]);
  }, [debugTag, showDeclinedNotice, declinedNotice, rejectedTailorIds, logDebug]);

  const isTailorHidden = useCallback(
    (tailor) => isPublicTailorHiddenForRejectedRequest(tailor, rejectedTailorIds),
    [rejectedTailorIds]
  );

  const tailorCatalogForResolve = useMemo(() => tailorCatalog, [tailorCatalog]);

  return {
    declinedNotice,
    showDeclinedNotice,
    rejectedTailorIds,
    applyDeclinedNotice,
    dismissNotice,
    syncDeclinedFromOrder,
    isTailorHidden,
    tailorCatalogForResolve,
    clearNoticeDismissed: () => {
      if (oid) clearDeclineNoticeDismissedForRequest(oid);
      dismissedRejectionRef.current = null;
    },
  };
}
