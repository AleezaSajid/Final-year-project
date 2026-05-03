import { useMemo } from "react";
import { Marker as LeafletMarker, Popup } from "react-leaflet";
import { tailorMarkerIcon } from "./markerIcons";

/**
 * Tailor pin marker: custom SVG pin, active state, tap selects tailor.
 */
export default function Marker({ tailor, isSelected, onSelect }) {
  const { lat, lng, name, distanceLabel } = tailor;
  const icon = useMemo(() => tailorMarkerIcon(isSelected), [isSelected]);

  return (
    <LeafletMarker
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        click: () => onSelect?.(tailor),
      }}
    >
      <Popup>
        <div className="min-w-[150px] font-sans text-sm">
          <p className="font-semibold text-ink">{name}</p>
          <p className="text-ink-muted">{distanceLabel} away</p>
        </div>
      </Popup>
    </LeafletMarker>
  );
}
