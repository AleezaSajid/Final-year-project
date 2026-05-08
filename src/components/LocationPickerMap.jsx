import React, { useCallback, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const DEFAULT_CENTER = [31.5204, 74.3587]; // Lahore

function pickerMarkerIcon() {
  return L.divIcon({
    className: "leaflet-location-picker-marker",
    html: `
      <div style="transform:translate(-50%,-100%);filter:drop-shadow(0 10px 20px rgba(15,23,42,0.22));">
        <svg width="36" height="44" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M20 46c6-8 16-18.5 16-28a16 16 0 1 0-32 0c0 9.5 10 20 16 28z" fill="#4a7c59"/>
          <path d="M20 46c6-8 16-18.5 16-28a16 16 0 1 0-32 0c0 9.5 10 20 16 28z" stroke="white" stroke-width="3"/>
          <circle cx="20" cy="18" r="7" fill="white" fill-opacity="0.95"/>
        </svg>
      </div>
    `,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -46],
  });
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      if (!e?.latlng) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Reusable map picker.
 *
 * Props:
 * - onSelect(lat, lng): called whenever the user picks a point
 * - defaultCenter?: [lat, lng]
 */
export default function LocationPickerMap({ onSelect, defaultCenter = DEFAULT_CENTER }) {
  const [pos, setPos] = useState(null); // { lat, lng } | null

  const icon = useMemo(() => pickerMarkerIcon(), []);

  const handlePick = useCallback(
    (lat, lng) => {
      setPos({ lat, lng });
      if (typeof onSelect === "function") onSelect(lat, lng);
    },
    [onSelect]
  );

  return (
    <div className="w-full">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        className="h-[400px] w-full rounded-xl"
        scrollWheelZoom
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={handlePick} />
        {pos ? <Marker position={[pos.lat, pos.lng]} icon={icon} /> : null}
      </MapContainer>
    </div>
  );
}

