import L from "leaflet";

const pinSvg = (isSelected, isInterested) => {
  const ring = isSelected ? "4" : isInterested ? "4" : "2.5";
  const scale = isSelected ? 1.08 : isInterested ? 1.05 : 1;
  const stroke = isSelected ? "white" : isInterested ? "#7dd3fc" : "white";
  const glow = isInterested
    ? "drop-shadow(0 10px 22px rgba(14,165,233,0.28)) drop-shadow(0 0 0 rgba(56,189,248,0))"
    : "drop-shadow(0 6px 16px rgba(15,23,42,0.22))";
  return `
    <div style="transform:translate(-50%,-100%) scale(${scale});transform-origin:50% 100%;filter:${glow};">
      <style>
        @keyframes sewserveTailorPulse {
          0% { box-shadow: 0 0 0 0 rgba(56,189,248,0.38); }
          70% { box-shadow: 0 0 0 14px rgba(56,189,248,0); }
          100% { box-shadow: 0 0 0 0 rgba(56,189,248,0); }
        }
      </style>
      ${
        isInterested && !isSelected
          ? `<div style="position:absolute;left:50%;top:18px;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:999px;animation:sewserveTailorPulse 1.35s ease-out infinite;"></div>`
          : ""
      }
      <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M20 46c6-8 16-18.5 16-28a16 16 0 1 0-32 0c0 9.5 10 20 16 28z" fill="${isSelected ? "#355542" : "#4a7c59"}"/>
        <path d="M20 46c6-8 16-18.5 16-28a16 16 0 1 0-32 0c0 9.5 10 20 16 28z" stroke="${stroke}" stroke-width="${ring}"/>
        <circle cx="20" cy="18" r="7" fill="white" fill-opacity="0.95"/>
        <path d="M17 15.5h6M17 18h6M17 20.5h6" stroke="${isSelected ? "#2d4a38" : "#355542"}" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    </div>
  `;
};

export function tailorMarkerIcon(isSelected, isInterested = false) {
  return L.divIcon({
    className: "leaflet-tailor-marker",
    html: pinSvg(isSelected, isInterested),
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -46],
  });
}

export function userMarkerIcon() {
  return L.divIcon({
    className: "leaflet-user-marker",
    html: `
      <div style="transform:translate(-50%,-50%);">
        <div style="width:20px;height:20px;border-radius:999px;background:#15803d;border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.22),0 0 0 5px rgba(21,128,61,0.22);"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}
