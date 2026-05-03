import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { patchOrderWizardFields } from "../../api/ordersApi.js";
import { ensureSocketThen, socket } from "../../socket";
import MapView from "./MapView";
import MapDashboardNav from "./components/MapDashboardNav";
import MapHeroSection from "./components/MapHeroSection";
import MapHowItWorks from "./components/MapHowItWorks";
import MapPanelToolbar from "./components/MapPanelToolbar";
import MapPlaceOrderForm from "./components/MapPlaceOrderForm";
import NearbyTailorsSection from "./components/NearbyTailorsSection";
import { TAILOR_SEEDS } from "./data/mockTailors";
import { distanceKm, formatDistance } from "./utils/haversine";

/** Fallback center when geolocation is denied or unavailable */
const FALLBACK_CENTER = [31.5204, 74.3587];

const PAGE_SIZE = 4;

/** Fixed radius for wizard tailor selection (?mode=select). */
const SELECT_MODE_RADIUS_KM = 5;

/** @typedef {'idle' | 'placing' | 'waiting' | 'selecting' | 'confirmed'} MatchStatus */

function sortTailorsSelectMode(list) {
  return [...list].sort((a, b) => {
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    const availRank = (t) => (t.available !== false ? 1 : 0);
    if (availRank(a) !== availRank(b)) return availRank(b) - availRank(a);
    return b.rating - a.rating;
  });
}

function buildTailorsNearUser(userLat, userLng) {
  return TAILOR_SEEDS.map((seed) => {
    const lat = userLat + seed.deltaLat;
    const lng = userLng + seed.deltaLng;
    const km = distanceKm(userLat, userLng, lat, lng);
    return {
      id: seed.id,
      name: seed.name,
      specialty: seed.specialty,
      rating: seed.rating,
      priceMin: seed.priceMin,
      priceMax: seed.priceMax,
      deliveryDays: seed.deliveryDays,
      avatarImg: seed.avatarImg,
      available: seed.available !== false,
      lat,
      lng,
      distanceKm: km,
      distanceLabel: formatDistance(km),
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

function mergeTailorFromInterest(partial, catalog) {
  const id = partial?.id;
  if (!id) return null;
  const base = catalog.find((t) => t.id === id);
  if (!base) return null;
  return { ...base, ...partial };
}

/**
 * Dashboard map + real-time interest / select flow (socket).
 */
export default function MapPage() {
  const [searchParams] = useSearchParams();
  const isSelectMode = searchParams.get("mode") === "select";
  const wizardOrderId = (searchParams.get("orderId") || "").trim();

  const [userCenter, setUserCenter] = useState(FALLBACK_CENTER);
  const [geoStatus, setGeoStatus] = useState("pending");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);
  const [sortBy, setSortBy] = useState("distance");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [matchStatus, setMatchStatus] = useState(/** @type {MatchStatus} */ ("idle"));
  const [interestedTailors, setInterestedTailors] = useState([]);
  const activeOrderIdRef = useRef("");

  const [assignBusy, setAssignBusy] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignError, setAssignError] = useState("");

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

  const allTailors = useMemo(
    () => buildTailorsNearUser(userCenter[0], userCenter[1]),
    [userCenter]
  );

  const allTailorsRef = useRef(allTailors);
  allTailorsRef.current = allTailors;

  const selectTailorsSorted = useMemo(() => {
    if (!isSelectMode) return [];
    let list = allTailors.filter((t) => t.distanceKm <= SELECT_MODE_RADIUS_KM);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.specialty.toLowerCase().includes(q)
      );
    }
    return sortTailorsSelectMode(list);
  }, [isSelectMode, allTailors, search]);

  useEffect(() => {
    if (!isSelectMode) return;
    setAssignSuccess(false);
    setAssignError("");
    setSelectedId(null);
  }, [isSelectMode, wizardOrderId]);

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

  const browseMapTailors = useMemo(() => {
    if (matchStatus === "idle" || matchStatus === "placing" || matchStatus === "waiting") {
      return [];
    }
    return listTailors;
  }, [matchStatus, listTailors]);

  const mapTailors = useMemo(
    () => (isSelectMode ? selectTailorsSorted : browseMapTailors),
    [isSelectMode, selectTailorsSorted, browseMapTailors]
  );

  const selectedTailor = useMemo(
    () => mapTailors.find((t) => t.id === selectedId) ?? null,
    [mapTailors, selectedId]
  );

  useEffect(() => {
    if (selectedId && !mapTailors.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, mapTailors]);

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
      setMatchStatus((s) => (s === "waiting" || s === "selecting" ? "selecting" : s));
    };

    socket.on("tailorInterested", onTailorInterested);
    return () => {
      socket.off("tailorInterested", onTailorInterested);
    };
  }, []);

  useEffect(() => {
    if (matchStatus !== "waiting") return;
    const timer = window.setTimeout(() => {
      setInterestedTailors((prev) => {
        if (prev.length > 0) return prev;
        return allTailorsRef.current.filter((t) => t.distanceKm <= radiusKm).slice(0, 3);
      });
      setMatchStatus((s) => (s === "waiting" ? "selecting" : s));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [matchStatus, radiusKm]);

  const resetToIdle = useCallback(() => {
    setMatchStatus("idle");
    setInterestedTailors([]);
    activeOrderIdRef.current = "";
    setSelectedId(null);
  }, []);

  const handlePlaceOrderClick = useCallback(() => {
    setMatchStatus("placing");
  }, []);

  const handleOrderFormSubmit = useCallback(
    (fields) => {
      const orderId = `map_${Date.now()}`;
      activeOrderIdRef.current = orderId;
      setInterestedTailors([]);
      const payload = {
        orderId,
        ...fields,
        location: { lat: userCenter[0], lng: userCenter[1] },
        radiusKm,
      };
      setMatchStatus("waiting");
      ensureSocketThen(() => {
        socket.emit("newOrder", payload);
      });
    },
    [userCenter, radiusKm]
  );

  const handleSelectTailor = useCallback(
    (tailor) => {
      const oid = activeOrderIdRef.current;
      ensureSocketThen(() => {
        socket.emit("selectTailor", { orderId: oid, tailorId: tailor.id });
      });
      setMatchStatus("confirmed");
    },
    []
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
      await patchOrderWizardFields(wizardOrderId, {
        tailorId: selectedTailor.id,
        status: "Assigned",
        workflowStatus: "Assigned",
      });
      setAssignSuccess(true);
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Could not assign tailor.");
    } finally {
      setAssignBusy(false);
    }
  }, [isSelectMode, selectedTailor, wizardOrderId]);

  const hasMore = visibleCount < listTailors.length;
  const selectHasMore = isSelectMode && visibleCount < selectTailorsSorted.length;

  const lowerSection = (() => {
    if (isSelectMode) {
      return null;
    }
    if (matchStatus === "idle") {
      return null;
    }
    if (matchStatus === "placing") {
      return (
        <div className="mt-10 lg:mt-12">
          <MapPlaceOrderForm onSubmit={handleOrderFormSubmit} onCancel={resetToIdle} />
        </div>
      );
    }
    if (matchStatus === "waiting") {
      return (
        <div className="mt-10 lg:mt-12">
          <section className="scroll-mt-24">
            <p className="text-center text-base font-medium text-ink-muted">Finding nearby tailors...</p>
          </section>
        </div>
      );
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
    if (matchStatus === "confirmed") {
      return (
        <div className="mt-10 lg:mt-12">
          <section className="scroll-mt-24">
            <h2 className="text-center font-['Playfair_Display',Georgia,serif] text-2xl font-semibold tracking-tight text-ink">
              Order Confirmed
            </h2>
          </section>
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent text-slate-600 antialiased">
      <div className="ss-page-bg-anim" aria-hidden="true" />

      <div className="relative z-10 min-h-screen font-['Inter',sans-serif]">
        <MapDashboardNav />

        <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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

          <div className="relative z-[1]">
            {isSelectMode ? (
              <section className="ss-glass-card relative overflow-hidden rounded-apple-card p-6 shadow-lg shadow-slate-900/5 sm:p-8">
                <h1 className="font-['Playfair_Display',Georgia,serif] text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
                  Select a Tailor for Your Order
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
              <MapHeroSection
                geoStatus={geoStatus}
                onDetectLocation={requestLocation}
                showPlaceOrder={matchStatus === "idle"}
                onPlaceOrder={handlePlaceOrderClick}
              />
            )}

            {isSelectMode && assignSuccess ? (
              <div
                className="mt-6 rounded-apple-card border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-center text-sm font-semibold text-emerald-900 shadow-sm"
                role="status"
              >
                Success — your order is assigned to the selected tailor and status is set to Assigned.
              </div>
            ) : null}
            {isSelectMode && assignError ? (
              <div className="mt-6 rounded-apple-card border border-red-200 bg-red-50/90 px-4 py-3 text-center text-sm font-medium text-red-800">
                {assignError}
              </div>
            ) : null}

            <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-8 lg:items-start">
              <div className="lg:col-span-8">
                <div className="ss-glass-card overflow-hidden rounded-apple-card shadow-lg shadow-slate-900/5">
                  <MapPanelToolbar
                    search={search}
                    onSearchChange={setSearch}
                    radiusKm={isSelectMode ? SELECT_MODE_RADIUS_KM : radiusKm}
                    onRadiusChange={setRadiusKm}
                    radiusLockedKm={isSelectMode ? SELECT_MODE_RADIUS_KM : undefined}
                  />
                  <div className="map-dashboard-root relative h-[min(52vh,420px)] min-h-[280px] w-full sm:h-[400px] lg:h-[460px]">
                    <MapView
                      userCenter={userCenter}
                      zoom={14}
                      tailors={mapTailors}
                      selectedId={selectedId}
                      selectedTailor={selectedTailor}
                      onSelectTailor={(t) => setSelectedId(t.id)}
                      className="h-full w-full rounded-none"
                    />
                  </div>
                </div>
              </div>

              {isSelectMode ? (
                <div
                  id="map-how"
                  className="flex max-h-none flex-col lg:col-span-4 lg:max-h-[460px] lg:overflow-y-auto lg:pr-1 scroll-mt-28"
                >
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
                </div>
              ) : (
                <div id="map-how" className="lg:col-span-4 scroll-mt-28">
                  <MapHowItWorks />
                  <div className="mt-4 rounded-apple-card bg-gradient-to-br from-emerald-50/95 via-white/75 to-emerald-100/55 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.88),0_1px_2px_rgba(16,185,129,0.1),0_4px_14px_-3px_rgba(5,80,60,0.1)] ring-1 ring-inset ring-emerald-200/45">
                    <p className="text-sm font-medium leading-relaxed text-ink-body">
                      <span className="font-semibold text-emerald-800">Fast. Local. Reliable.</span> Supporting local tailors
                      and bringing quality stitching closer to you.
                    </p>
                  </div>
                </div>
              )}
            </div>

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
