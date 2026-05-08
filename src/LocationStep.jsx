import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LocateFixed, MapPin, Loader2 } from "lucide-react";

import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import DashboardNavbar from "./components/DashboardNavbar.jsx";

const USER_LOCATION_KEY = "userLocation";
const PENDING_ORDER_ID_KEY = "sewserve_pending_order_id";

function normalizeText(v) {
  return String(v ?? "").trim();
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

export default function LocationStep() {
  const navigate = useNavigate();

  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");

  const canContinue = useMemo(() => {
    const hasCoords = typeof lat === "number" && typeof lng === "number";
    const hasAddress = normalizeText(address).length > 0;
    return hasCoords || hasAddress;
  }, [lat, lng, address]);

  const handleUseMyLocation = useCallback(() => {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setLat(nextLat);
        setLng(nextLng);
        setLocating(false);

        // Reverse geocode to auto-fill address.
        const controller = new AbortController();
        setGeocoding(true);
        try {
          const display = await reverseGeocodeNominatim(nextLat, nextLng, controller.signal);
          if (display) setAddress(display);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not reverse geocode location.");
        } finally {
          setGeocoding(false);
        }
      },
      (geoErr) => {
        setLocating(false);
        if (geoErr && geoErr.code === 1) {
          setError("Location permission denied. Please enter your address manually.");
          return;
        }
        setError("Could not get your location. Please try again or enter address manually.");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  }, []);

  const handleContinue = useCallback(() => {
    setError("");
    const a = normalizeText(address);
    const hasCoords = typeof lat === "number" && typeof lng === "number";
    if (!hasCoords && !a) {
      setError("Please use your current location or enter an address to continue.");
      return;
    }

    const payload = {
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
      address: a,
    };
    try {
      localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }

    let pendingOrderId = "";
    try {
      pendingOrderId = normalizeText(localStorage.getItem(PENDING_ORDER_ID_KEY));
    } catch {
      pendingOrderId = "";
    }

    navigate(pendingOrderId ? `/map?orderId=${encodeURIComponent(pendingOrderId)}` : "/map");
  }, [address, lat, lng, navigate]);

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
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your full address"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200/80 bg-white/80 py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <div className="rounded-lg bg-white/70 px-3 py-2">
                  <span className="font-semibold text-slate-700">Lat:</span>{" "}
                  {typeof lat === "number" ? lat.toFixed(6) : "—"}
                </div>
                <div className="rounded-lg bg-white/70 px-3 py-2">
                  <span className="font-semibold text-slate-700">Lng:</span>{" "}
                  {typeof lng === "number" ? lng.toFixed(6) : "—"}
                </div>
              </div>
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

