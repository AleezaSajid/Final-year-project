import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { patchOrderWizardFields } from "../../api/ordersApi.js";
import CustomerOrderDeclinedModal from "../../components/customer/CustomerOrderDeclinedModal.jsx";
import { useCustomerRejectedRequest } from "../../hooks/useCustomerRejectedRequest.js";
import { declinedNoticeFromSocketPayload } from "../../utils/customerRejectedOrders.js";
import { ensureSocketThen, socket } from "../../socket";
import { fetchPublicTailors } from "../../api/tailorsPublicApi.js";
import MapDashboardNav from "./components/MapDashboardNav";
import MapHeroSection from "./components/MapHeroSection";
import MapHowItWorks from "./components/MapHowItWorks";
import MapPanelToolbar from "./components/MapPanelToolbar";
import NearbyTailorsSection from "./components/NearbyTailorsSection";
import TailorCard from "./components/TailorCard";
import { distanceKm, formatDistance } from "./utils/haversine";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  looksLikeTailorShopId,
  resolveTailorShopIdFromPublicTailor,
} from "../../utils/chatIdentity.js";
import { resolveOrderCustomerId } from "../../utils/measurementOrderPayload.js";
import {
  getLinkedWizardOrderId,
  shouldRestoreWizardLinkedOrderId,
} from "../../utils/measurementWizardOrderSync.js";
import { getCustomerMeta, putCustomerMeta } from "../../api/accountApi.js";
import { tailorMarkerIcon, userMarkerIcon } from "./markerIcons.js";
import { isStaleAddressText, isStaleLocationRecord, isTrustworthyProfileCoords } from "../../utils/locationSafety.js";

/** Fallback center when geolocation is denied or unavailable */
const FALLBACK_CENTER = [31.5204, 74.3587];

const PAGE_SIZE = 4;
const SELECT_MODE_RADIUS_KM = 5;

/** @typedef {'idle' | 'selecting' | 'confirmed'} MatchStatus */

function sortTailorsSelectMode(list) {
  return [...list].sort((a, b) => {
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    const availRank = (t) => (t.available !== false ? 1 : 0);
    if (availRank(a) !== availRank(b)) return availRank(b) - availRank(a);
    return b.rating - a.rating;
  });
}

function mergeTailorFromInterest(partial, catalog) {
  const id = partial?.id;
  if (!id) return null;
  const base = catalog.find((t) => t.id === id);
  if (!base) return null;
  return { ...base, ...partial };
}

/** MongoDB / GeoJSON: [lng, lat] → Leaflet [lat, lng] */
function leafletPositionFromMongoCoordinates(tailor) {
  const c = tailor?.location?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

/** Marker position: GeoJSON on object, else explicit lat/lng from API mapping */
function leafletMarkerPosition(tailor) {
  if (!tailor) return null;
  const fromGeo = leafletPositionFromMongoCoordinates(tailor);
  if (fromGeo) return fromGeo;
  const lat = tailor.lat;
  const lng = tailor.lng;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return null;
}

function RecenterOnUser({ center, zoom }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      map.setView(center, zoom, { animate: false });
      return;
    }
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

function FlyToSelectedTailor({ tailor }) {
  const map = useMap();
  useEffect(() => {
    if (!tailor) return;
    const pos = leafletMarkerPosition(tailor);
    if (!pos) return;
    map.flyTo(pos, Math.max(map.getZoom?.() || 13, 14), { duration: 0.45 });
  }, [tailor, map]);
  return null;
}

function orderIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a).trim() === String(b).trim();
}

function isRejectedStatusValue(st) {
  const s = String(st || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return s === "rejected" || s === "declined";
}

function orderEventMatches(orderEvent, oid) {
  if (!orderEvent || !oid) return false;
  const o = String(oid).trim();
  if (!o) return false;
  const direct = orderEvent.orderId != null ? String(orderEvent.orderId).trim() : "";
  if (direct && orderIdsMatch(direct, o)) return true;
  const clientDirect = orderEvent.clientOrderId != null ? String(orderEvent.clientOrderId).trim() : "";
  if (clientDirect && orderIdsMatch(clientDirect, o)) return true;
  const full = orderEvent.fullOrder || orderEvent.order || null;
  if (full && typeof full === "object") {
    const id = full.id != null ? String(full.id).trim() : "";
    const _id = full._id != null ? String(full._id).trim() : "";
    const client = full.clientOrderId != null ? String(full.clientOrderId).trim() : "";
    if ((id && orderIdsMatch(id, o)) || (_id && orderIdsMatch(_id, o)) || (client && orderIdsMatch(client, o))) {
      return true;
    }
  }
  return false;
}

function formatDeliveryDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n === 1) return "1 day";
  return `${Math.round(n)} days`;
}

/**
 * Unified map page: MapPage shell + Leaflet markers (GeoJSON + lat/lng).
 */
export default function NearbyTailorsMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSelectMode = searchParams.get("mode") === "select";
  const wizardOrderId = (searchParams.get("orderId") || "").trim();
  const { user } = useAuth();

  const [userCenter, setUserCenter] = useState(FALLBACK_CENTER);
  const [geoStatus, setGeoStatus] = useState("pending");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);
  const [sortBy, setSortBy] = useState("distance");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [matchStatus, setMatchStatus] = useState(/** @type {MatchStatus} */ ("idle"));
  const [interestedTailors, setInterestedTailors] = useState([]);
  const interestedTailorsRef = useRef([]);
  const matchStatusRef = useRef(matchStatus);
  const activeOrderIdRef = useRef("");

  const [assignBusy, setAssignBusy] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignError, setAssignError] = useState("");

  const [apiTailors, setApiTailors] = useState([]);
  const [orderLiveHint, setOrderLiveHint] = useState("");
  const redirectedRef = useRef(false);
  const lastMapTailorRequestRef = useRef(null);

  // Map/card sync: marker popups + horizontal rail scroll
  const markerRefs = useRef(new Map());
  const cardRefs = useRef(new Map());

  /** New wizard flow: persist order id in URL so /map stays the hub (no track-orders redirect). */
  useEffect(() => {
    const q = (searchParams.get("orderId") || "").trim();
    if (q) return;
    if (!user?.id || user.role !== "customer") return;
    let cancelled = false;
    void (async () => {
      const meta = await getCustomerMeta(user);
      if (cancelled) return;
      const pending = (meta?.lastWizardOrderId || "").trim();
      if (pending && (await shouldRestoreWizardLinkedOrderId(pending))) {
        navigate(`/map?orderId=${encodeURIComponent(pending)}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, user]);

  useEffect(() => {
    if (!user?.id || user.role !== "customer") return;
    let cancelled = false;
    void (async () => {
      const meta = await getCustomerMeta(user);
      if (cancelled) return;
      if (meta?.lastMapTailorRequest && typeof meta.lastMapTailorRequest === "object") {
        lastMapTailorRequestRef.current = meta.lastMapTailorRequest;
      }
      const parsed = meta?.lastKnownLocation;
      if (!parsed || typeof parsed !== "object") return;
      if (isStaleLocationRecord(parsed)) {
        try {
          await putCustomerMeta(user, { lastKnownLocation: null });
        } catch {
          /* non-fatal */
        }
        return;
      }
      const lat = typeof parsed.lat === "number" ? parsed.lat : null;
      const lng = typeof parsed.lng === "number" ? parsed.lng : null;
      const hasCoords = isTrustworthyProfileCoords(lat, lng);
      const address =
        typeof parsed.address === "string" && !isStaleAddressText(parsed.address) ? parsed.address : "";
      if (hasCoords) {
        setUserCenter([lat, lng]);
        setGeoStatus("ok");
      }
      ensureSocketThen(() => {
        socket.emit("get_nearby_tailors", {
          lat: hasCoords ? lat : null,
          lng: hasCoords ? lng : null,
          address,
        });
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCenter([pos.coords.latitude, pos.coords.longitude]);
        setGeoStatus("ok");
      },
      () => {
        setGeoStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { tailors, ok } = await fetchPublicTailors();
      if (cancelled) return;
      setApiTailors(ok && Array.isArray(tailors) ? tailors : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allTailors = useMemo(() => {
    const [userLat, userLng] = userCenter;
    const raw = Array.isArray(apiTailors) ? apiTailors : [];
    const mapped = raw
      .map((t) => {
        if (!t || typeof t !== "object") return null;

        // Real coordinates only: accept either explicit lat/lng (number or numeric string)
        // OR GeoJSON Point coordinates [lng, lat] from backend.
        let lat = Number(t.lat);
        let lng = Number(t.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          const c = t?.location?.coordinates;
          if (Array.isArray(c) && c.length >= 2) {
            lng = Number(c[0]);
            lat = Number(c[1]);
          }
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const coords = { lat, lng };
        const km = distanceKm(userLat, userLng, coords.lat, coords.lng);
        const hasPriceStart = t.priceStart != null && t.priceStart !== "";
        const priceStart = hasPriceStart ? Number(t.priceStart) : null;
        const safePriceStart = Number.isFinite(priceStart) ? priceStart : null;
        const ratingRaw = Number(t.rating);
        const safeRating = Number.isFinite(ratingRaw) ? ratingRaw : null;
        const delRaw = Number(t.deliveryDays);
        const safeDelivery = Number.isFinite(delRaw) ? delRaw : null;
      return {
        id: String(t.id || t._id || ""),
        tailorShopId: t.tailorShopId ? String(t.tailorShopId) : "",
        name: t.name || t.shopName || "Tailor",
        city: t.city || "",
        specialty: t.specialty || "",
        rating: safeRating,
        experienceYears: Number.isFinite(Number(t.experienceYears)) ? Number(t.experienceYears) : null,
        availability: t.availability || "available",
        priceLabel: t.priceLabel || "",
        priceStart: safePriceStart,
        deliveryDays: safeDelivery,
        imageUrl: typeof t.imageUrl === "string" ? t.imageUrl : "",
        avatarImg: typeof t.avatarImg === "string" ? t.avatarImg : "",
        lat: coords.lat,
        lng: coords.lng,
        distanceKm: km,
        distanceLabel: formatDistance(km),
      };
      })
      .filter(Boolean);
    return mapped.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [apiTailors, userCenter]);

  const allTailorsRef = useRef(allTailors);
  allTailorsRef.current = allTailors;
  interestedTailorsRef.current = interestedTailors;
  matchStatusRef.current = matchStatus;

  const clearLastMapTailorRequest = useCallback(async () => {
    lastMapTailorRequestRef.current = null;
    if (user?.id && user.role === "customer") {
      try {
        await putCustomerMeta(user, { lastMapTailorRequest: null });
      } catch {
        /* ignore */
      }
    }
  }, [user]);

  const linkedOrderId = useMemo(
    () => (wizardOrderId || getLinkedWizardOrderId() || "").trim(),
    [wizardOrderId]
  );

  const tailorCatalogForDecline = useMemo(
    () =>
      allTailors.map((t) => ({
        id: t.id,
        tailorShopId: t.tailorShopId ? String(t.tailorShopId) : "",
        name: t.name,
        shopName: t.name,
      })),
    [allTailors]
  );

  const onRequestDeclined = useCallback(() => {
    void clearLastMapTailorRequest();
    setMatchStatus("idle");
    setAssignSuccess(false);
    setAssignError("");
    setInterestedTailors([]);
    window.dispatchEvent(new CustomEvent("sewserve:orders-refresh"));
  }, [clearLastMapTailorRequest]);

  const {
    declinedNotice: requestDeclinedNotice,
    showDeclinedNotice,
    dismissNotice,
    syncDeclinedFromOrder,
    applyDeclinedNotice,
    isTailorHidden,
  } = useCustomerRejectedRequest({
    user,
    linkedOrderId,
    tailorCatalog: tailorCatalogForDecline,
    lastRequestRef: lastMapTailorRequestRef,
    onDeclined: onRequestDeclined,
  });

  const syncFocusedOrderRejection = useCallback(async () => {
    const oid = linkedOrderId;
    if (!oid || user?.role !== "customer") return false;
    return syncDeclinedFromOrder(oid);
  }, [linkedOrderId, user?.role, syncDeclinedFromOrder]);

  const selectTailorsSorted = useMemo(() => {
    if (!isSelectMode) return [];
    let list = allTailors.filter(
      (t) => !isTailorHidden(t) && t.distanceKm <= SELECT_MODE_RADIUS_KM
    );
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.specialty.toLowerCase().includes(q)
      );
    }
    return sortTailorsSelectMode(list);
  }, [isSelectMode, allTailors, search, isTailorHidden]);


  useEffect(() => {
    if (!isSelectMode) return;
    setAssignSuccess(false);
    setAssignError("");
    setSelectedId(null);
  }, [isSelectMode, wizardOrderId]);

  useEffect(() => {
    if (!linkedOrderId) {
      return;
    }
    activeOrderIdRef.current = linkedOrderId;
    setOrderLiveHint("");
    let cancelled = false;

    const applyRestore = (last) => {
      if (last && orderIdsMatch(last.orderId, linkedOrderId)) {
        setMatchStatus("confirmed");
        return true;
      }
      return false;
    };

    void (async () => {
      const rejected = await syncFocusedOrderRejection();
      if (cancelled) return;
      if (rejected) {
        setMatchStatus("idle");
        setAssignSuccess(false);
        return;
      }

      let restoredSent = false;
      if (lastMapTailorRequestRef.current) {
        restoredSent = applyRestore(lastMapTailorRequestRef.current);
      }
      if (!restoredSent && user?.id && user.role === "customer") {
        const meta = await getCustomerMeta(user);
        if (cancelled) return;
        const last = meta?.lastMapTailorRequest;
        if (last && typeof last === "object") {
          lastMapTailorRequestRef.current = last;
          restoredSent = applyRestore(last);
        }
      }
      if (!restoredSent) {
        setMatchStatus("idle");
        setInterestedTailors([]);
        setSelectedId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [linkedOrderId, user, syncFocusedOrderRejection]);

  /** Join order room + surface status updates on the map (same events as order tracking). */
  useEffect(() => {
    const oid = linkedOrderId;
    if (!oid) {
      setOrderLiveHint("");
      return undefined;
    }
    redirectedRef.current = false;
    const join = () => {
      socket.emit("join_order_room", oid);
    };
    ensureSocketThen(join);
    socket.on("connect", join);

    const applyMapRejectFromPayload = (payload = {}, data = null) => {
      const built = declinedNoticeFromSocketPayload(
        { ...payload, orderId: payload?.orderId || data?.orderId || oid },
        allTailorsRef.current,
        lastMapTailorRequestRef.current
      );
      if (built) {
        applyDeclinedNotice(built);
        return;
      }
      if (data && isRejectedStatusValue(data.status || data.workflowStatus || data.fullOrder?.status)) {
        applyDeclinedNotice({
          orderId: oid,
          tailorId: data.tailorId ?? data.fullOrder?.tailorId ?? payload?.tailorId,
          tailorName: lastMapTailorRequestRef.current?.tailorName,
          reason:
            data.rejectionReason ??
            data.fullOrder?.rejectionReason ??
            data.patch?.rejectionReason ??
            payload?.rejectionReason ??
            "",
        });
      }
    };

    const onOrderEvent = (data) => {
      if (!data || !orderEventMatches(data, oid)) return;
      const st =
        (data.status && String(data.status)) ||
        (data.fullOrder && data.fullOrder.status && String(data.fullOrder.status)) ||
        (data.patch && data.patch.status && String(data.patch.status)) ||
        "";
      if (st) {
        if (isRejectedStatusValue(st)) {
          applyMapRejectFromPayload(
            {
              orderId: oid,
              tailorId: data.tailorId ?? data.fullOrder?.tailorId,
              rejectionReason:
                data.rejectionReason ??
                data.fullOrder?.rejectionReason ??
                data.patch?.rejectionReason,
              status: st,
            },
            data
          );
          return;
        }
        setOrderLiveHint(`Latest: ${st}`);
      }
    };

    socket.on("order:statusUpdated", onOrderEvent);
    socket.on("order:liveUpdate", onOrderEvent);
    const onAccepted = (payload = {}) => {
      if (!payload || !orderEventMatches(payload, oid)) return;
      redirectedRef.current = true;
      setMatchStatus("confirmed");
      navigate("/customer/dashboard", { replace: true });
    };
    const onRejected = (payload = {}) => {
      if (!payload || !orderEventMatches(payload, oid)) return;
      applyMapRejectFromPayload(payload);
    };
    socket.on("orderAccepted", onAccepted);
    socket.on("orderRejected", onRejected);
    return () => {
      socket.off("connect", join);
      socket.off("order:statusUpdated", onOrderEvent);
      socket.off("order:liveUpdate", onOrderEvent);
      socket.off("orderAccepted", onAccepted);
      socket.off("orderRejected", onRejected);
    };
  }, [linkedOrderId, navigate, applyDeclinedNotice]);

  const listTailors = useMemo(() => {
    const list = [...interestedTailors];
    if (sortBy === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    } else {
      list.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) => t.name.toLowerCase().includes(q) || t.specialty.toLowerCase().includes(q)
    );
  }, [interestedTailors, sortBy, search]);

  const browseBaseTailors = useMemo(() => {
    let list = allTailors.filter((t) => !isTailorHidden(t));
    list = list.filter((t) => t.distanceKm <= radiusKm);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.specialty.toLowerCase().includes(q)
      );
    }
    if (sortBy === "rating") list.sort((a, b) => b.rating - a.rating);
    else list.sort((a, b) => a.distanceKm - b.distanceKm);
    return list;
  }, [allTailors, radiusKm, search, sortBy, isTailorHidden]);

  const interestedTailorIds = useMemo(() => {
    return new Set(interestedTailors.map((t) => t.id));
  }, [interestedTailors]);

  const browseMapTailors = useMemo(() => {
    return browseBaseTailors.map((t) => ({
      ...t,
      isInterested: interestedTailorIds.has(t.id),
    }));
  }, [browseBaseTailors, interestedTailorIds]);

  const mapTailors = useMemo(
    () => (isSelectMode ? selectTailorsSorted : browseMapTailors),
    [isSelectMode, selectTailorsSorted, browseMapTailors]
  );

  const tailorsOnMap = useMemo(() => [...mapTailors], [mapTailors]);

  const selectedTailor = useMemo(
    () => mapTailors.find((t) => t.id === selectedId) ?? null,
    [mapTailors, selectedId]
  );

  const selectedTailorOnMap = useMemo(
    () => tailorsOnMap.find((t) => t.id === selectedId) ?? null,
    [tailorsOnMap, selectedId]
  );

  useEffect(() => {
    if (!selectedId) return;
    const m = markerRefs.current.get(selectedId);
    m?.openPopup?.();
    const el = cardRefs.current.get(selectedId);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedId]);

  useEffect(() => {
    if (selectedId && !tailorsOnMap.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, tailorsOnMap]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, radiusKm, sortBy, userCenter, interestedTailors, matchStatus, isSelectMode]);

  useEffect(() => {
    const onTailorInterested = (payload = {}) => {
      const oid = payload.orderId != null ? String(payload.orderId).trim() : "";
      if (oid && activeOrderIdRef.current && oid !== activeOrderIdRef.current) {
        return;
      }
      const partial = payload.tailor && typeof payload.tailor === "object" ? payload.tailor : {};
      const tid = String(partial.id ?? payload.tailorId ?? "").trim();
      if (!tid) return;

      const full = mergeTailorFromInterest({ ...partial, id: tid }, allTailorsRef.current);
      if (!full) return;
      setInterestedTailors((prev) => {
        if (prev.some((t) => t.id === full.id)) return prev;
        return [...prev, full];
      });
      setMatchStatus((s) => (s === "confirmed" ? s : "selecting"));
    };

    socket.on("tailorInterested", onTailorInterested);
    return () => {
      socket.off("tailorInterested", onTailorInterested);
    };
  }, [matchStatus, navigate]);

  const handleSelectTailor = useCallback(
    async (tailor) => {
      const oid = (wizardOrderId || activeOrderIdRef.current || getLinkedWizardOrderId() || "").trim();
      const tailorShopId = resolveTailorShopIdFromPublicTailor(tailor);
      if (!oid) {
        setAssignError("Complete the measurement wizard before selecting a tailor.");
        return;
      }
      if (!tailorShopId || !looksLikeTailorShopId(tailorShopId)) {
        setAssignError("Could not resolve a valid tailor shop for this selection.");
        return;
      }
      setAssignBusy(true);
      setAssignError("");
      dismissNotice();
      try {
        await patchOrderWizardFields(
          oid,
          {
            action: "select_tailor",
            tailorId: tailorShopId,
            status: "pending",
            isActive: false,
            chatEnabled: false,
          },
          { operation: "Select tailor" }
        );
        const customerId = resolveOrderCustomerId(user);
        ensureSocketThen(() => {
          socket.emit("tailor:selected", {
            tailorId: tailorShopId,
            customerId,
            orderId: oid,
            location: { lat: userCenter[0], lng: userCenter[1] },
            garmentType: tailor?.specialty || "—",
            budget: "—",
          });
        });
        setMatchStatus("confirmed");
        setAssignSuccess(true);
        const mapReq = {
          orderId: oid,
          tailorId: tailorShopId,
          tailorName: tailor?.name != null ? String(tailor.name) : "",
          sentAt: Date.now(),
        };
        lastMapTailorRequestRef.current = mapReq;
        if (user?.id && user.role === "customer") {
          void putCustomerMeta(user, { lastMapTailorRequest: mapReq }).catch(() => {});
        }
        window.dispatchEvent(new CustomEvent("sewserve:orders-refresh"));
        navigate(`/map?orderId=${encodeURIComponent(oid)}`, { replace: true });
      } catch (e) {
        setAssignSuccess(false);
        setAssignError(e instanceof Error ? e.message : "Could not send request to tailor.");
      } finally {
        setAssignBusy(false);
      }
    },
    [wizardOrderId, user, userCenter, navigate, dismissNotice]
  );

  const handleConfirmWizardTailor = useCallback(async () => {
    if (!isSelectMode || !selectedTailor) return;
    if (!wizardOrderId) {
      setAssignError("Order ID is missing. Use a link that includes ?orderId=… with your order.");
      return;
    }
    setAssignError("");
    setAssignBusy(true);
    try {
      const tailorShopId = String(selectedTailor.tailorShopId || "").trim();
      if (!tailorShopId || !looksLikeTailorShopId(tailorShopId)) {
        throw new Error("Could not resolve a valid tailor shop for this selection.");
      }
      await patchOrderWizardFields(
        wizardOrderId,
        {
          action: "select_tailor",
          tailorId: tailorShopId,
          status: "pending",
          isActive: false,
          chatEnabled: false,
        },
        { operation: "Select tailor" }
      );
      setAssignSuccess(true);
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Could not assign tailor.");
    } finally {
      setAssignBusy(false);
    }
  }, [isSelectMode, selectedTailor, wizardOrderId]);

  const hasMore = visibleCount < listTailors.length;
  const selectHasMore = isSelectMode && visibleCount < selectTailorsSorted.length;

  const userPin = useMemo(() => userMarkerIcon(), []);

  const cardTailors = useMemo(() => {
    // Render from the same source as map markers (no duplicate arrays).
    return [...mapTailors];
  }, [mapTailors]);

  const lowerSection = (() => {
    if (isSelectMode) {
      return null;
    }
    if (matchStatus === "selecting") {
      return (
        <div className="mt-10 lg:mt-12">
          <NearbyTailorsSection
            tailors={listTailors}
            selectedId={selectedId}
            onSelectTailor={(t) => setSelectedId(t.id)}
            onViewAccept={handleSelectTailor}
            sortBy={sortBy}
            onSortChange={setSortBy}
            visibleCount={visibleCount}
            onLoadMore={() => setVisibleCount((n) => n + PAGE_SIZE)}
            hasMore={hasMore}
            primaryActionLabel="Select"
          />
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent text-slate-600 antialiased">
      <div className="ss-page-bg-anim" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col font-['Inter',sans-serif]">
        <MapDashboardNav />

        <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div
            className="pointer-events-none absolute -left-36 top-[4%] h-[min(22rem,70vw)] w-[min(22rem,70vw)] rounded-full bg-emerald-400/12 blur-[2.75rem]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-28 top-[20%] h-[min(20rem,65vw)] w-[min(20rem,65vw)] rounded-full bg-sky-400/13 blur-[2.75rem]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-[8%] left-1/3 h-48 w-48 rounded-full bg-violet-200/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
            {isSelectMode ? (
              <section className="ss-glass-card relative overflow-hidden rounded-apple-card p-6 shadow-lg shadow-slate-900/5 sm:p-8">
                <h1 className="font-['Playfair_Display',Georgia,serif] text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
                  {"Select a Tailor for Your Order"}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  {geoStatus === "ok"
                    ? `Showing tailors within ${SELECT_MODE_RADIUS_KM} km, sorted by distance, availability, and rating.`
                    : geoStatus === "pending"
                      ? "Detecting your location…"
                      : "Location unavailable — showing tailors relative to the default area. Enable location for best results."}
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="hero-cta inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2 bg-gradient-to-b from-[#4a7c59] to-[#355542]"
                  >
                    <span className="relative z-10">Refresh location</span>
                  </button>
                </div>
              </section>
            ) : (
              <MapHeroSection geoStatus={geoStatus} onDetectLocation={requestLocation} />
            )}

            {isSelectMode && assignSuccess ? (
              <div
                className="mt-6 rounded-apple-card border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-center text-sm font-semibold text-emerald-900 shadow-sm"
                role="status"
              >
                Request sent. Waiting for tailor acceptance.
              </div>
            ) : null}
            {isSelectMode && assignError ? (
              <div className="mt-6 rounded-apple-card border border-red-200 bg-red-50/90 px-4 py-3 text-center text-sm font-medium text-red-800">
                {assignError}
              </div>
            ) : null}

            <CustomerOrderDeclinedModal
              open={showDeclinedNotice}
              notice={requestDeclinedNotice}
              onDismiss={dismissNotice}
              onChooseAnotherTailor={() => {
                dismissNotice();
                setMatchStatus("idle");
                setSelectedId(null);
              }}
            />

            {!isSelectMode && wizardOrderId && !showDeclinedNotice ? (
              <div
                className="mt-6 rounded-apple-card border border-emerald-200/70 bg-emerald-50/85 px-4 py-3 text-emerald-950 shadow-sm sm:px-5 sm:py-4"
                role="status"
              >
                {matchStatus === "confirmed" ? (
                  <div>
                    <p className="text-sm font-semibold">Request sent. Waiting for tailor acceptance.</p>
                    <p className="mt-1 text-sm text-emerald-900/85">
                      You will be redirected to your dashboard once the tailor accepts.
                      {orderLiveHint ? (
                        <span className="mt-1 block text-xs font-medium text-emerald-800/90">{orderLiveHint}</span>
                      ) : null}
                    </p>
                  </div>
                ) : matchStatus === "selecting" ? (
                  <div>
                    <p className="text-sm font-semibold">Tailors are responding</p>
                    <p className="mt-1 text-sm text-emerald-900/85">
                      Pick someone from the map (highlighted pins) or use the list below.
                    </p>
                    {orderLiveHint ? (
                      <p className="mt-1 text-xs font-medium text-emerald-800/90">{orderLiveHint}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Your order is active</p>
                      <p className="mt-1 text-sm text-emerald-900/85">
                        Tap a tailor on the map, then send your request — everything stays here on the map.
                      </p>
                      {orderLiveHint ? (
                        <p className="mt-1 text-xs font-medium text-emerald-800/90">{orderLiveHint}</p>
                      ) : null}
                    </div>
                    {selectedTailorOnMap && matchStatus === "idle" ? (
                      <button
                        type="button"
                        onClick={() => handleSelectTailor(selectedTailorOnMap)}
                        className="hero-cta shrink-0 rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#355542] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2"
                      >
                        Send request to {selectedTailorOnMap.name || "tailor"}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-6 min-h-0 flex-1 lg:mt-8">
              <div className="ss-glass-card relative overflow-hidden rounded-apple-card shadow-lg shadow-slate-900/5">
                <MapPanelToolbar
                  search={search}
                  onSearchChange={setSearch}
                  radiusKm={isSelectMode ? SELECT_MODE_RADIUS_KM : radiusKm}
                  onRadiusChange={setRadiusKm}
                  radiusLockedKm={isSelectMode ? SELECT_MODE_RADIUS_KM : undefined}
                />
                <div className="map-dashboard-root relative h-[min(52vh,420px)] min-h-[280px] w-full sm:h-[min(56vh,480px)] lg:h-[min(62vh,520px)]">
                  <MapContainer
                    center={userCenter}
                    zoom={14}
                    className="h-full w-full rounded-none"
                    scrollWheelZoom
                    style={{ zIndex: 0 }}
                  >
                    <RecenterOnUser center={userCenter} zoom={14} />
                    <FlyToSelectedTailor tailor={selectedTailorOnMap} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={userCenter} icon={userPin}>
                      <Popup>
                        <div className="rounded-xl border border-white/40 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/10 backdrop-blur">
                          You are here
                        </div>
                      </Popup>
                    </Marker>
                    {tailorsOnMap.map((t) => {
                      const pos = leafletMarkerPosition(t);
                      if (!pos) return null;
                      const isSelected = t.id === selectedId;
                      const isInterested = Boolean(t.isInterested);
                      return (
                        <Marker
                          key={t.id}
                          ref={(ref) => {
                            if (ref) markerRefs.current.set(t.id, ref);
                            else markerRefs.current.delete(t.id);
                          }}
                          position={pos}
                          icon={tailorMarkerIcon(isSelected, isInterested)}
                          eventHandlers={{
                            click: () => setSelectedId(t.id),
                          }}
                        >
                          <Popup>
                            <div className="min-w-[220px] max-w-[260px] rounded-2xl border border-white/40 bg-white/95 p-3 shadow-xl shadow-slate-900/15 backdrop-blur">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">{t.name}</p>
                                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                                    {t.distanceLabel} away
                                    {typeof t.rating === "number" ? ` • ★ ${t.rating.toFixed(1)}` : ""}
                                  </p>
                                </div>
                                {t.availability === "busy" ? (
                                  <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200/70">
                                    Busy
                                  </span>
                                ) : (
                                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                                    Available
                                  </span>
                                )}
                              </div>
                              {t.specialty ? (
                                <p className="mt-2 line-clamp-2 text-xs text-slate-700">{t.specialty}</p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                                {t.priceLabel ? (
                                  <span className="rounded-full bg-slate-50 px-2 py-1 ring-1 ring-slate-200/70">
                                    {t.priceLabel}
                                  </span>
                                ) : null}
                                {t.deliveryDays ? (
                                  <span className="rounded-full bg-slate-50 px-2 py-1 ring-1 ring-slate-200/70">
                                    {formatDeliveryDays(t.deliveryDays)}
                                  </span>
                                ) : null}
                              </div>
                              {!isSelectMode && wizardOrderId && matchStatus === "idle" ? (
                                <button
                                  type="button"
                                  className="mt-3 w-full rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#355542] px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-900/15 transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectTailor(t);
                                  }}
                                >
                                  Send Request
                                </button>
                              ) : null}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>

                  {tailorsOnMap.length === 0 ? (
                    <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center p-6">
                      <div className="pointer-events-auto rounded-2xl border border-slate-200/70 bg-white/80 px-5 py-4 text-center text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur">
                        No tailors nearby
                      </div>
                    </div>
                  ) : null}

                  {/* Floating side panel over map (lg+); stacks at bottom on small screens */}
                  <div
                    id="map-how"
                    className="pointer-events-auto absolute inset-x-0 bottom-0 z-[1000] max-h-[42%] overflow-y-auto rounded-t-2xl border border-white/30 bg-white/88 p-4 shadow-sm shadow-slate-900/10 backdrop-blur-xl scroll-mt-28 sm:max-h-[38%] lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-4 lg:max-h-[min(420px,calc(100%-2rem))] lg:w-[min(calc(100%-2rem),380px)] lg:rounded-apple-card lg:shadow-md lg:shadow-slate-900/10"
                  >
                    {selectedTailorOnMap ? (
                      <div className="mb-4 rounded-2xl border border-white/30 bg-white/70 p-3 shadow-sm backdrop-blur">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-white/50">
                            {/* Use existing mapped URLs; keep it purely presentational. */}
                            <img
                              src={selectedTailorOnMap.imageUrl || selectedTailorOnMap.avatarImg || ""}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{selectedTailorOnMap.name}</p>
                            <p className="mt-0.5 text-xs font-medium text-slate-600">
                              {selectedTailorOnMap.distanceLabel} away
                              {typeof selectedTailorOnMap.rating === "number"
                                ? ` • ★ ${selectedTailorOnMap.rating.toFixed(1)}`
                                : ""}
                            </p>
                            {selectedTailorOnMap.specialty ? (
                              <p className="mt-1 line-clamp-2 text-xs text-slate-700">{selectedTailorOnMap.specialty}</p>
                            ) : null}
                          </div>
                        </div>
                        {!isSelectMode && wizardOrderId && matchStatus === "idle" ? (
                          <button
                            type="button"
                            onClick={() => handleSelectTailor(selectedTailorOnMap)}
                            className="mt-3 w-full rounded-2xl bg-gradient-to-b from-[#4a7c59] to-[#355542] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-900/10 transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 focus-visible:ring-offset-2"
                          >
                            Send Request
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {isSelectMode ? (
                      <NearbyTailorsSection
                        tailors={selectTailorsSorted}
                        selectedId={selectedId}
                        onSelectTailor={(t) => setSelectedId(t.id)}
                        onViewAccept={() => {}}
                        sortBy="distance"
                        onSortChange={() => {}}
                        visibleCount={visibleCount}
                        onLoadMore={() => setVisibleCount((n) => n + PAGE_SIZE)}
                        hasMore={selectHasMore}
                        sectionTitle="Tailors near you"
                        showSort={false}
                        sortHint="Sorted by distance, availability & rating"
                        hideCardPrimaryAction
                      />
                    ) : (
                      <>
                        <MapHowItWorks />
                        <div className="mt-4 rounded-apple-card bg-white/55 p-4 shadow-sm shadow-slate-900/5 ring-1 ring-inset ring-white/35 backdrop-blur">
                          <p className="text-sm font-medium leading-relaxed text-slate-700">
                            <span className="font-semibold text-emerald-800">Fast. Local. Reliable.</span> Supporting local
                            tailors and bringing quality stitching closer to you.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Nearby tailor discovery rail (map-synced) */}
            <section className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-['Playfair_Display',Georgia,serif] text-2xl font-bold tracking-tight text-ink">
                    Nearby Tailors
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Scroll to explore — tap a card to preview on the map.
                  </p>
                </div>
              </div>

              <div className="relative mt-4 rounded-2xl border border-white/30 bg-white/20 p-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl sm:p-4">
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-1 [-webkit-overflow-scrolling:touch] scroll-smooth">
                  {cardTailors.length === 0 ? (
                    <div className="w-full rounded-xl border border-slate-200/70 bg-white/70 px-4 py-4 text-sm font-semibold text-slate-700">
                      No tailors to show yet. Try increasing the radius or adjusting your search.
                    </div>
                  ) : null}

                  {cardTailors.map((t) => {
                    return (
                      <div
                        key={t.id}
                        ref={(el) => {
                          if (el) cardRefs.current.set(t.id, el);
                          else cardRefs.current.delete(t.id);
                        }}
                        className="snap-center w-[86%] min-w-[280px] max-w-[420px]"
                      >
                        <TailorCard
                          tailor={t}
                          selected={t.id === selectedId}
                          onSelect={(tailor) => setSelectedId(tailor.id)}
                          onViewAccept={handleSelectTailor}
                          primaryActionLabel="Send Request"
                          hidePrimaryAction={false}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#eceff3] via-[#eceff3]/70 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#eceff3] via-[#eceff3]/70 to-transparent" />
              </div>
            </section>

            {isSelectMode && selectedId && !assignSuccess ? (
              <div className="mt-8 flex flex-col items-center gap-3">
                <button
                  type="button"
                  disabled={assignBusy}
                  onClick={() => void handleConfirmWizardTailor()}
                  className="hero-cta inline-flex min-w-[200px] items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45 focus-visible:ring-offset-2 disabled:opacity-60 bg-gradient-to-b from-[#4a7c59] to-[#355542]"
                >
                  <span className="relative z-10">{assignBusy ? "Saving…" : "Confirm Selection"}</span>
                </button>
              </div>
            ) : null}

            {lowerSection}
          </div>
        </main>
      </div>
    </div>
  );
}
