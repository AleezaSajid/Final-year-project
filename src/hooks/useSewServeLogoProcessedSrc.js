import { useEffect, useState } from "react";

import { sewServeLogoImageToDataUrl } from "../utils/sewServeLogoBackgroundRemoval";

/**
 * Loads a SewServe logo raster and returns a data URL with the flat background keyed out.
 */
export function useSewServeLogoProcessedSrc(rawSrc) {
  const [processedSrc, setProcessedSrc] = useState(rawSrc);

  useEffect(() => {
    let active = true;
    const img = new Image();
    img.decoding = "async";
    img.src = rawSrc;
    img.onload = () => {
      if (!active) return;
      try {
        setProcessedSrc(sewServeLogoImageToDataUrl(img));
      } catch {
        setProcessedSrc(rawSrc);
      }
    };
    img.onerror = () => {
      if (active) setProcessedSrc(rawSrc);
    };
    return () => {
      active = false;
    };
  }, [rawSrc]);

  return processedSrc;
}
