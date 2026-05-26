import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import {
  TailorAuthBackdrop,
  TailorAuthOverlay,
  TailorAuthPage,
  tailorAuthGlassCardCss,
} from "../styles/tailorAuthPageTheme.js";
import LocationPickerMap from "../components/LocationPickerMap.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { completeTailorProfile, getTailorOnboardingProfile } from "../api/tailorOnboardingApi.js";
import { isTailorPendingLocation } from "../utils/tailorOnboarding.js";
import {
  FRESH_GEOLOCATION_OPTIONS,
  geolocationErrorMessage,
  isStaleAddressText,
  isStaleLatLng,
  isTrustworthyProfileCoords,
  normalizeLocationText,
  purgeStaleLocationStorage,
} from "../utils/locationSafety.js";
import { useSewServeLogoProcessedSrc } from "../hooks/useSewServeLogoProcessedSrc";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const Page = TailorAuthPage;
const PageBackdrop = TailorAuthBackdrop;
const PageOverlay = TailorAuthOverlay;

const Shell = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: clamp(1rem, 2.5vw, 1.75rem) clamp(1rem, 2vw, 1.5rem) clamp(1.25rem, 2vw, 2rem);

  @media (min-width: 900px) {
    margin-left: auto;
    margin-right: clamp(1.25rem, 5vw, 3.5rem);
  }
`;

const Header = styled.header`
  text-align: center;
  margin-bottom: 1.25rem;
`;

const Logo = styled.img`
  max-height: 44px;
  width: auto;
  margin-bottom: 0.85rem;
`;

const Title = styled.h1`
  margin: 0 0 0.4rem;
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(1.65rem, 3vw, 2.25rem);
  font-weight: 700;
  color: #1a3558;
`;

const Lead = styled.p`
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.55;
  color: #4a5d70;
  max-width: 36rem;
  margin-left: auto;
  margin-right: auto;
`;

const Card = styled.section`
  border-radius: 28px;
  padding: clamp(1.1rem, 2vw, 1.5rem);
  ${tailorAuthGlassCardCss}
`;

const SectionTitle = styled.h2`
  margin: 0 0 0.75rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
`;

const Field = styled.div`
  margin-bottom: 0.65rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
`;

const inputBase = `
  width: 100%;
  font-size: 0.92rem;
  border: 1.5px solid rgba(216, 231, 248, 0.95);
  border-radius: 11px;
  padding: 0.62rem 0.85rem;
  outline: none;
  background: rgba(255, 255, 255, 0.98);
  color: #274c7b;
  font-family: inherit;
  &:focus {
    border-color: #6eb58a;
    box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.14);
  }
`;

const Input = styled.input`
  ${inputBase}
`;

const TextArea = styled.textarea`
  ${inputBase}
  min-height: 4.5rem;
  resize: vertical;
  line-height: 1.45;
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const MapActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const SecondaryBtn = styled.button`
  flex: 1;
  min-width: 140px;
  padding: 0.55rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 10px;
  border: 1px solid rgba(216, 231, 248, 0.95);
  background: rgba(255, 255, 255, 0.95);
  color: #1a3558;
  cursor: pointer;
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LocationHint = styled.p`
  margin: 0 0 0.65rem;
  font-size: 0.8rem;
  color: ${(p) => (p.$ok ? "#15803d" : "#64748b")};
  font-weight: 600;
`;

const SubmitBtn = styled.button`
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: linear-gradient(180deg, #4a7c59 0%, #2f5a42 48%, #264a38 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 4px 14px rgba(38, 74, 56, 0.32);
  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const ErrorBox = styled.div`
  margin-bottom: 0.75rem;
  padding: 0.65rem 0.85rem;
  font-size: 0.88rem;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
  border-radius: 10px;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  margin: 1.1rem 0;
`;

async function reverseGeocode(latVal, lngVal) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(String(latVal))}` +
    `&lon=${encodeURIComponent(String(lngVal))}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Could not fetch address.");
  const data = await res.json();
  return String(data?.display_name || "").trim();
}

export default function TailorCompleteProfilePage() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const logoSrc = useSewServeLogoProcessedSrc(LOGO_SRC);

  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [priceStart, setPriceStart] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  /** True only after a successful GPS read from "Use my location". */
  const [usedGps, setUsedGps] = useState(false);
  /** True after map pick or verified coords loaded from the server profile. */
  const [usedMapPick, setUsedMapPick] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");

  const hasConfirmedCoords =
    (usedGps || usedMapPick) && isTrustworthyProfileCoords(lat, lng);

  useEffect(() => {
    document.title = "SewServe | Complete your tailor profile";
    purgeStaleLocationStorage();
    let cancelled = false;
    (async () => {
      try {
        const data = await getTailorOnboardingProfile();
        if (cancelled) return;
        const p = data?.profile;
        if (p) {
          setBio(p.bio || "");
          setExperienceYears(p.experienceYears != null ? String(p.experienceYears) : "");
          setPriceStart(p.priceStart != null ? String(p.priceStart) : "");
          setDeliveryDays(p.deliveryDays != null ? String(p.deliveryDays) : "");
          const profileAddress = normalizeLocationText(p.address);
          if (profileAddress && !isStaleAddressText(profileAddress)) {
            setAddress(profileAddress);
          } else {
            setAddress("");
          }
          const pLat = p.lat != null ? Number(p.lat) : NaN;
          const pLng = p.lng != null ? Number(p.lng) : NaN;
          if (
            isTrustworthyProfileCoords(pLat, pLng) &&
            !isTailorPendingLocation(pLat, pLng)
          ) {
            setLat(pLat);
            setLng(pLng);
            setUsedMapPick(true);
            setUsedGps(false);
          } else {
            setLat(null);
            setLng(null);
            setUsedMapPick(false);
            setUsedGps(false);
          }
        }
      } catch {
        if (!cancelled) setError("Could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyMapOrGpsLocation = async (nextLat, nextLng, { fromGps }) => {
    setLocationError("");
    const nLat = Number(nextLat);
    const nLng = Number(nextLng);
    if (!isTrustworthyProfileCoords(nLat, nLng)) {
      setLocationError(
        "That location looks like a default Lahore placeholder. Use GPS again or pick your shop on the map."
      );
      setLat(null);
      setLng(null);
      setUsedGps(false);
      setUsedMapPick(false);
      return;
    }
    setLat(nLat);
    setLng(nLng);
    setUsedGps(Boolean(fromGps));
    setUsedMapPick(!fromGps);
    setGeocoding(true);
    try {
      const display = await reverseGeocode(nLat, nLng);
      if (display && !isStaleAddressText(display)) {
        setAddress(display);
      } else if (!normalizeLocationText(address)) {
        setAddress("Selected location");
      }
    } catch {
      if (!normalizeLocationText(address)) {
        setAddress("Selected location");
      }
    } finally {
      setGeocoding(false);
    }
  };

  const handleUseMyLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError(
        "Geolocation is not supported. Enter your address manually or pick a point on the map."
      );
      return;
    }
    setLocating(true);
    setGeocoding(false);
    setUsedGps(false);
    setUsedMapPick(false);
    setAddress("");
    setLat(null);
    setLng(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setLocating(false);
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
          setLocationError(
            "Received invalid coordinates from your device. Enter your address manually or pick a point on the map."
          );
          return;
        }
        if (isStaleLatLng(nextLat, nextLng)) {
          setLocationError(
            "Received a default Lahore location instead of your GPS position. Try again or pick your shop on the map."
          );
          return;
        }
        await applyMapOrGpsLocation(nextLat, nextLng, { fromGps: true });
      },
      (geoErr) => {
        setLocating(false);
        setUsedGps(false);
        setUsedMapPick(false);
        setLat(null);
        setLng(null);
        setLocationError(
          geolocationErrorMessage(geoErr, {
            manualHint: "enter your address manually or pick a point on the map",
          })
        );
      },
      FRESH_GEOLOCATION_OPTIONS
    );
  };

  const handleAddressChange = (e) => {
    setAddress(e.target.value);
    setLocationError("");
    if (!usedGps && !usedMapPick) {
      setLat(null);
      setLng(null);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLocationError("");
    if (!hasConfirmedCoords) {
      setLocationError(
        "Please use GPS or pick your shop on the map to set coordinates. You can type your address manually, but coordinates are not saved until you do."
      );
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("bio", bio.trim());
      formData.append("experienceYears", String(parseInt(experienceYears, 10) || 0));
      formData.append("priceStart", String(parseInt(priceStart, 10) || 1500));
      formData.append("deliveryDays", String(parseInt(deliveryDays, 10) || 7));
      formData.append("address", address.trim());
      formData.append("lat", String(lat));
      formData.append("lng", String(lng));
      if (imageFile) formData.append("avatar", imageFile);

      await completeTailorProfile(formData);
      await refreshUser();
      toast.success("Profile complete", "Your shop is ready on SewServe.");
      navigate("/tailor/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Could not save profile.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Page>
        <PageBackdrop aria-hidden />
        <PageOverlay aria-hidden />
        <Shell style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#64748b", fontWeight: 600 }}>Loading your profile…</p>
        </Shell>
      </Page>
    );
  }

  return (
    <Page>
      <PageBackdrop aria-hidden />
      <PageOverlay aria-hidden />
      <Shell>
        <Header>
          <Logo src={logoSrc} alt="SewServe" />
          <Title>Complete your shop profile</Title>
          <Lead>
            Add a few professional details so customers can find you on the map and browse your services.
          </Lead>
        </Header>

        <Card as="form" onSubmit={handleSubmit} noValidate>
          {error ? <ErrorBox role="alert">{error}</ErrorBox> : null}
          {locationError ? <ErrorBox role="alert">{locationError}</ErrorBox> : null}

          <SectionTitle>Branding</SectionTitle>
          <Field>
            <Label htmlFor="avatar">Shop image</Label>
            <Input id="avatar" type="file" name="avatar" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </Field>
          <Field>
            <Label htmlFor="bio">Short bio</Label>
            <TextArea id="bio" name="bio" placeholder="Tell customers about your craft and services…" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>

          <Divider />

          <SectionTitle>Business details</SectionTitle>
          <Grid2>
            <Field>
              <Label htmlFor="experienceYears">Years of experience</Label>
              <Input id="experienceYears" type="number" name="experienceYears" min={0} placeholder="e.g. 5" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
            </Field>
            <Field>
              <Label htmlFor="priceStart">Starting price (PKR)</Label>
              <Input id="priceStart" type="number" name="priceStart" min={0} placeholder="e.g. 1500" value={priceStart} onChange={(e) => setPriceStart(e.target.value)} />
            </Field>
          </Grid2>
          <Field>
            <Label htmlFor="deliveryDays">Typical delivery (days)</Label>
            <Input id="deliveryDays" type="number" name="deliveryDays" min={1} placeholder="e.g. 7" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} />
          </Field>

          <Divider />

          <SectionTitle>Shop location</SectionTitle>
          <MapActions>
            <SecondaryBtn type="button" onClick={handleUseMyLocation} disabled={locating || geocoding || submitting}>
              {locating || geocoding ? "Locating…" : "Use my location"}
            </SecondaryBtn>
            <SecondaryBtn type="button" onClick={() => setIsMapOpen(true)} disabled={submitting}>
              Pick on map
            </SecondaryBtn>
          </MapActions>
          <LocationHint $ok={hasConfirmedCoords}>
            {hasConfirmedCoords ? "Location selected ✓" : "No location selected yet"}
          </LocationHint>
          <Field>
            <Label htmlFor="address">Address</Label>
            <TextArea id="address" name="address" rows={2} value={address} onChange={handleAddressChange} placeholder="Shop address" />
          </Field>

          <SubmitBtn type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Complete profile & go to dashboard"}
          </SubmitBtn>
        </Card>
      </Shell>

      <AnimatePresence>
        {isMapOpen ? (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setIsMapOpen(false)}
          >
            <motion.div
              className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-xl backdrop-blur-md"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Select shop location</p>
                <button type="button" onClick={() => setIsMapOpen(false)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                <LocationPickerMap
                  onSelect={async (a, b) => {
                    setIsMapOpen(false);
                    await applyMapOrGpsLocation(a, b, { fromGps: false });
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Page>
  );
}
