import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { ensureSocketThen, socket } from "../socket";
import OrderPopup from "../tailorDashboard/components/OrderPopup";
import { useAuth } from "../context/AuthContext.jsx";
import { resolveTailorIdWhenViewingAsTailor } from "../utils/chatIdentity.js";

const MapOrderAlertContext = createContext(null);

const POPUP_AUTO_DISMISS_MS = 60_000;

/** Tailor-area routes where a map “new order” toast should appear (not on /map or customer flows). */
function shouldShowMapOrderPopup(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  if (pathname === "/map" || pathname.startsWith("/map/")) return false;
  if (pathname.startsWith("/customer")) return false;
  return (
    pathname === "/dashboard" ||
    pathname === "/tailor/dashboard" ||
    pathname.startsWith("/tailor/last-review") ||
    pathname === "/profile"
  );
}

export function MapOrderAlertProvider({ children }) {
  const { user } = useAuth();
  const mapInterestTailorId = useMemo(() => resolveTailorIdWhenViewingAsTailor(user), [user]);
  const location = useLocation();
  const [incomingOrder, setIncomingOrder] = useState(null);
  const incomingRef = useRef(null);
  const autoCloseRef = useRef(null);

  incomingRef.current = incomingOrder;

  const clearAutoClose = useCallback(() => {
    if (autoCloseRef.current != null) {
      window.clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
  }, []);

  const dismissIncomingOrder = useCallback(() => {
    clearAutoClose();
    setIncomingOrder(null);
  }, [clearAutoClose]);

  const onIncomingOrderInterested = useCallback(() => {
    const o = incomingRef.current;
    if (!o?.orderId) return;
    const oid = String(o.orderId).trim();
    ensureSocketThen(() => {
      socket.emit("interest", { orderId: oid, tailorId: mapInterestTailorId });
    });
    dismissIncomingOrder();
  }, [dismissIncomingOrder, mapInterestTailorId]);

  useEffect(() => {
    const onTailorMapNewOrder = (payload) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
      if (payload.fullOrder != null) return;
      const orderId = payload.orderId != null ? String(payload.orderId).trim() : "";
      if (!orderId) return;
      setIncomingOrder(payload);
      clearAutoClose();
      autoCloseRef.current = window.setTimeout(() => {
        setIncomingOrder(null);
        autoCloseRef.current = null;
      }, POPUP_AUTO_DISMISS_MS);
    };

    socket.on("newOrder", onTailorMapNewOrder);
    return () => {
      socket.off("newOrder", onTailorMapNewOrder);
      clearAutoClose();
    };
  }, [clearAutoClose]);

  const isTailorRoute = shouldShowMapOrderPopup(location.pathname);
  const showPopup = isTailorRoute && incomingOrder != null;

  const value = useMemo(
    () => ({
      incomingOrder,
      dismissIncomingOrder,
      onIncomingOrderInterested,
    }),
    [incomingOrder, dismissIncomingOrder, onIncomingOrderInterested]
  );

  return (
    <MapOrderAlertContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" && showPopup
        ? createPortal(
            <AnimatePresence>
              <OrderPopup
                key={incomingOrder.orderId}
                order={incomingOrder}
                onInterested={onIncomingOrderInterested}
                onIgnore={dismissIncomingOrder}
              />
            </AnimatePresence>,
            document.body
          )
        : null}
    </MapOrderAlertContext.Provider>
  );
}

export function useMapOrderAlert() {
  return useContext(MapOrderAlertContext);
}
