import { useSewServeLogoProcessedSrc } from "../hooks/useSewServeLogoProcessedSrc";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

/**
 * SewServe wordmark (same asset + background removal as login). Use in nav and branded headers
 * site-wide; login and landing pages may inline their own styling.
 */
export function SewServeBrandImg({ className = "", alt = "SewServe", decorative = false }) {
  const src = useSewServeLogoProcessedSrc(LOGO_SRC);
  return (
    <img
      src={src}
      alt={decorative ? "" : alt}
      className={`block w-auto object-contain ${className}`.trim()}
    />
  );
}
