import styled from "styled-components";

import tailorSignupBg from "../assets/images/tailorsignup.png";

/** Shared full-page shell for tailor signup & complete-profile. */
export const TailorAuthPage = styled.div`
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  color: #1a3558;
  background: #e8f4f0;
  overflow-x: hidden;
`;

/** Hero illustration anchored left; natural colors preserved. */
export const TailorAuthBackdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: #e8f4f0;
  background-image: url(${tailorSignupBg});
  background-repeat: no-repeat;
  background-size: auto min(112%, 1040px);
  background-position: left bottom;

  @media (max-width: 980px) {
    background-size: cover;
    background-position: 22% center;
  }
`;

/** Subtle readability wash — image stays vivid on the left. */
export const TailorAuthOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      rgba(232, 248, 244, 0.06) 0%,
      transparent 36%,
      rgba(241, 247, 255, 0.22) 52%,
      rgba(253, 251, 247, 0.58) 72%,
      rgba(255, 255, 255, 0.82) 88%
    ),
    radial-gradient(ellipse 75% 55% at 8% 18%, rgba(224, 242, 254, 0.2) 0%, transparent 58%);
`;

/** Floating glass card — layered above the hero image. */
export const tailorAuthGlassCardCss = `
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 28px 56px -16px rgba(26, 53, 88, 0.16),
    0 12px 28px -10px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
`;
