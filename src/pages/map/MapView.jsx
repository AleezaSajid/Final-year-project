import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import TailorMarker from "./Marker";
import { userMarkerIcon } from "./markerIcons";

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

function FlyToSelectedTailor({ tailor, zoom = 15 }) {
  const map = useMap();
  const lastId = useRef(null);
  useEffect(() => {
    if (!tailor) {
      lastId.current = null;
      return;
    }
    if (lastId.current === tailor.id) return;
    lastId.current = tailor.id;
    map.flyTo([tailor.lat, tailor.lng], Math.max(map.getZoom(), zoom), {
      duration: 0.55,
      easeLinearity: 0.25,
    });
  }, [tailor, map, zoom]);
  return null;
}

/**
 * Full-screen Leaflet map: user pin + tailor markers.
 */
export default function MapView({
  userCenter,
  zoom = 14,
  tailors,
  selectedId,
  selectedTailor,
  onSelectTailor,
  className = "h-full w-full",
}) {
  const userIcon = userMarkerIcon();

  return (
    <MapContainer
      center={userCenter}
      zoom={zoom}
      className={className}
      scrollWheelZoom
      zoomControl={false}
      style={{ zIndex: 0 }}
    >
      <RecenterOnUser center={userCenter} zoom={zoom} />
      <FlyToSelectedTailor tailor={selectedTailor} />
      <ZoomControl position="topright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker position={userCenter} icon={userIcon}>
        <Popup>
          <div className="font-sans text-sm font-semibold text-ink">You are here</div>
        </Popup>
      </Marker>

      {tailors.map((t) => (
        <TailorMarker
          key={t.id}
          tailor={t}
          isSelected={t.id === selectedId}
          onSelect={onSelectTailor}
        />
      ))}
    </MapContainer>
  );
}
