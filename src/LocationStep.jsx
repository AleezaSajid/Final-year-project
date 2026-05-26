import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LocateFixed, MapPin, Loader2 } from "lucide-react";

import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import DashboardNavbar from "./components/DashboardNavbar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { getCustomerMeta, putCustomerMeta } from "./api/accountApi.js";
import { getOrderById, patchOrderWizardFields } from "./api/ordersApi.js";
import {
  getLinkedWizardOrderId,
  shouldRestoreWizardLinkedOrderId,
} from "./utils/measurementWizardOrderSync.js";
import {
  FRESH_GEOLOCATION_OPTIONS,
  geolocationErrorMessage,
  isStaleAddressText,
  isStaleLatLng,
  isStaleLocationRecord,
  normalizeLocationText,
  purgeStaleLocationStorage,
} from "./utils/locationSafety.js";

const LOCATION_STEP_MANUAL_ADDRESS_KEY = "sewserve_location_step_manual_address";

function normalizeText(v) {
  return normalizeLocationText(v);
}

function readLastManualAddress() {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(LOCATION_STEP_MANUAL_ADDRESS_KEY);
    const text = normalizeText(raw);
    if (!text || isStaleAddressText(text)) {
      localStorage.removeItem(LOCATION_STEP_MANUAL_ADDRESS_KEY);
      return "";
    }
    return text;
  } catch {
    return "";
  }
}

function writeLastManualAddress(address) {
  if (typeof window === "undefined") return;
  const text = normalizeText(address);
  try {
    if (!text || isStaleAddressText(text)) {
      localStorage.removeItem(LOCATION_STEP_MANUAL_ADDRESS_KEY);
      return;
    }
    localStorage.setItem(LOCATION_STEP_MANUAL_ADDRESS_KEY, text);
  } catch {
    /* ignore */
  }
}

async function reverseGeocodeNominatim(lat, lng, signal) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lng))}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      // Nominatim requests a valid UA; browsers ignore custom UA, but we can send a Referer-like hint.
      "Accept": "application/json",
    },
    signal,
  });
  if (!res.ok) throw new Error("Could not fetch address from coordinates.");
  const data = await res.json();
  const display = normalizeText(data?.display_name);
  return display || "";
}

async function saveLocationToOrder(orderId, { address, lat, lng, usedGps }) {
  const order = await getOrderById(orderId);
  const existing =
    order?.orderPayload && typeof order.orderPayload === "object" && !Array.isArray(order.orderPayload)
      ? order.orderPayload
      : {};
  const customerInfo =
    existing.customerInfo && typeof existing.customerInfo === "object" && !Array.isArray(existing.customerInfo)
      ? { ...existing.customerInfo }
      : {};
  if (address) customerInfo.address = address;
  const hasGpsCoords =
    usedGps && typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
  if (hasGpsCoords) {
    customerInfo.lat = lat;
    customerInfo.lng = lng;
  } else {
    delete customerInfo.lat;
    delete customerInfo.lng;
  }
  const orderPayload = {
    ...existing,
    customerInfo,
    customerLocation: hasGpsCoords ? { lat, lng, address } : { address },
  };
  await patchOrderWizardFields(
    orderId,
    { orderPayload },
    { operation: "Save delivery location" }
  );
}

export default function LocationStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [address, setAddress] = useState("");
  /** Set only after a successful "Use My Current Location" read — never from storage. */
  const [usedGps, setUsedGps] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    purgeStaleLocationStorage();
    const manual = readLastManualAddress();
    if (manual) {
      setAddress(manual);
    }
    setLat(null);
    setLng(null);
    setUsedGps(false);

    if (!user?.id || user.role !== "customer") return;
    let cancelled = false;
    void (async () => {
      try {
        const meta = await getCustomerMeta(user);
        if (cancelled) return;
        if (isStaleLocationRecord(meta?.lastKnownLocation)) {
          await putCustomerMeta(user, { lastKnownLocation: null });
        }
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const canContinue = useMemo(() => {
    const hasGpsCoords = usedGps && typeof lat === "number" && typeof lng === "number";
    const hasAddress = normalizeText(address).length > 0;
    return hasGpsCoords || hasAddress;
  }, [usedGps, lat, lng, address]);

  const handleAddressChange = useCallback((e) => {
    setAddress(e.target.value);
    setError("");
    if (!usedGps) {
      setLat(null);
      setLng(null);
    }
  }, [usedGps]);

  const handleUseMyLocation = useCallback(() => {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser. Please enter your address manually below.");
      return;
    }
    setLocating(true);
    setGeocoding(false);
    setUsedGps(false);
    setAddress("");
    setLat(null);
    setLng(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
          setLocating(false);
          setError("Received invalid coordinates from your device. Please enter your address manually below.");
          return;
        }
        if (isStaleLatLng(nextLat, nextLng)) {
          setLocating(false);
          setError(
            "Received a default Lahore location instead of your GPS position. Please try again or enter your address manually below."
          );
          return;
        }
        setLat(nextLat);
        setLng(nextLng);
        setUsedGps(true);
        setLocating(false);

        const controller = new AbortController();
        setGeocoding(true);
        try {
          const display = await reverseGeocodeNominatim(nextLat, nextLng, controller.signal);
          if (display && !isStaleAddressText(display)) setAddress(display);
        } catch (e) {
          setError(
            e instanceof Error
              ? `${e.message} Coordinates were captured — you can edit the address below or try again.`
              : "Could not look up your street address. Coordinates were captured — enter or edit the address below."
          );
        } finally {
          setGeocoding(false);
        }
      },
      (geoErr) => {
        setLocating(false);
        setUsedGps(false);
        setLat(null);
        setLng(null);
        setError(geolocationErrorMessage(geoErr));
      },
      FRESH_GEOLOCATION_OPTIONS
    );
  }, []);

  const handleContinue = useCallback(async () => {
    setError("");
    const a = normalizeText(address);
    const hasGpsCoords = usedGps && typeof lat === "number" && typeof lng === "number";
    if (!hasGpsCoords && !a) {
      setError("Please use your current location or enter an address to continue.");
      return;
    }

    const payload = { address: a };
    if (hasGpsCoords) {
      payload.lat = lat;
      payload.lng = lng;
    }

    let pendingOrderId = normalizeText(
      location.state?.wizardOrderId || location.state?.orderId || getLinkedWizardOrderId()
    );
    if (!pendingOrderId && user?.id && user.role === "customer") {
      try {
        const meta = await getCustomerMeta(user);
        const fromMeta = normalizeText(meta?.lastWizardOrderId);
        if (fromMeta && (await shouldRestoreWizardLinkedOrderId(fromMeta))) {
          pendingOrderId = fromMeta;
        }
      } catch {
        pendingOrderId = "";
      }
    }

    if (pendingOrderId) {
      try {
        await saveLocationToOrder(pendingOrderId, {
          address: a,
          lat: hasGpsCoords ? lat : null,
          lng: hasGpsCoords ? lng : null,
          usedGps: hasGpsCoords,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save location to your order. Please try again.");
        return;
      }
    }

    if (hasGpsCoords) {
      writeLastManualAddress("");
    } else if (a) {
      writeLastManualAddress(a);
    }

    if (user?.id && user.role === "customer") {
      try {
        const metaPayload = isStaleLocationRecord(payload) ? null : payload;
        await putCustomerMeta(user, { lastKnownLocation: metaPayload });
      } catch {
        /* non-fatal */
      }
    }

    const mapState = {
      fromWizard: Boolean(location.state?.fromWizard),
      wizardOrderId: pendingOrderId,
      returnAfterSelect: location.state?.returnAfterSelect || "",
      wizardNotice: location.state?.wizardNotice || "",
    };
    if (pendingOrderId) {
      navigate(`/map?orderId=${encodeURIComponent(pendingOrderId)}`, { state: mapState });
    } else {
      navigate("/map", { state: mapState });
    }
  }, [address, lat, lng, usedGps, navigate, location.state, user]);

  const wizardNotice = normalizeText(location.state?.wizardNotice);

  return (
    <div
      className="relative isolate min-h-screen overflow-x-hidden antialiased"
      style={{ backgroundColor: "#eceff3" }}
    >
      <LandingStylePageBackground />
      <DashboardNavbar />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
        <section className="overflow-hidden rounded-2xl border border-white/40 bg-white/45 p-5 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Measurement Wizard / Location
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Confirm your location
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                This helps us show nearby tailors and route your order correctly.
              </p>
            </div>
          </div>

          {wizardNotice ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-900">
              {wizardNotice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-900">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating || geocoding}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#355542] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2"
            >
              {locating || geocoding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {locating ? "Fetching coordinates…" : "Fetching address…"}
                </>
              ) : (
                <>
                  <LocateFixed className="h-4 w-4" aria-hidden />
                  Use My Current Location
                </>
              )}
            </button>

            <div className="rounded-xl border border-slate-200/80 bg-white/60 p-4 shadow-sm">
              <label className="block text-sm font-semibold text-slate-800" htmlFor="manual-address">
                Address (manual)
              </label>
              <div className="relative mt-2">
                <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden />
                <textarea
                  id="manual-address"
                  value={address}
                  onChange={handleAddressChange}
                  placeholder="Enter your full address"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200/80 bg-white/80 py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {usedGps && typeof lat === "number" && typeof lng === "number" ? (
                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/70 px-3 py-2">
                    <span className="font-semibold text-slate-700">Lat:</span> {lat.toFixed(6)}
                  </div>
                  <div className="rounded-lg bg-white/70 px-3 py-2">
                    <span className="font-semibold text-slate-700">Lng:</span> {lng.toFixed(6)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-white/30 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-200/80 bg-white/60 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className="rounded-xl bg-gradient-to-b from-[#4a7c59] to-[#355542] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2"
            >
              Continue
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

