import styled from "styled-components";

import { useSewServeLogoProcessedSrc } from "../hooks/useSewServeLogoProcessedSrc";

const DEFAULT_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const Wrap = styled.div`
  display: inline-block;
  line-height: 0;
  transform-origin: center;
`;

const LogoImage = styled.img`
  width: ${(p) => p.$width || "300px"};
  max-width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  background: transparent;
  filter: drop-shadow(0 2px 8px rgba(20, 44, 77, 0.14));
`;

/** Raster SewServe logo with flat background removed at runtime (same asset as login hero). */
export function SewServeLogo({ size, titleSize, src }) {
  const source = src ?? DEFAULT_SRC;
  const processedSrc = useSewServeLogoProcessedSrc(source);

  const width = titleSize ? `calc(${titleSize} * 6)` : "300px";
  return (
    <Wrap style={size ? { transform: `scale(${size})` } : undefined}>
      <LogoImage src={processedSrc} alt="SewServe" $width={width} />
    </Wrap>
  );
}
