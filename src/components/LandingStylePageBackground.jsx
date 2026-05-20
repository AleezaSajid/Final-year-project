import React from "react";

/** Same full-viewport animated wash as SewServeLandingPage (homepage). */
const LANDING_PAGE_BG_CSS = `
.ss-page-bg-anim {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(ellipse 95% 75% at 8% 4%, rgba(186, 230, 217, 0.62), transparent 58%),
    radial-gradient(ellipse 88% 68% at 92% 12%, rgba(186, 215, 245, 0.58), transparent 54%),
    radial-gradient(ellipse 80% 55% at 50% 98%, rgba(255, 248, 235, 0.72), transparent 58%),
    radial-gradient(ellipse 55% 45% at 68% 48%, rgba(232, 247, 243, 0.45), transparent 52%),
    linear-gradient(165deg, #e8f7f2 0%, #e4eff9 42%, #faf8f4 78%, #fcfaf7 100%);
  background-size: 140% 140%;
  animation: ss-bg-gradient-drift 52s ease-in-out infinite alternate;
  filter: blur(22px) brightness(1.04);
}
.ss-page-bg-anim::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse 95% 90% at 50% 48%, transparent 42%, rgba(15, 23, 42, 0.065) 100%);
}
@keyframes ss-bg-gradient-drift {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 30% 100%; }
}

/*
 * Auth form card: same interaction as landing Features grid cards
 * (transition-all duration-500 ease-out, hover:-translate-y-0.5, hover:shadow-xl shadow-slate-900/8)
 * + .ss-glass-card base/hover from SewServeLandingPage (not edited there)
 */
.ss-auth-form-card {
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.08) 100%);
  -webkit-backdrop-filter: blur(24px) saturate(165%);
  backdrop-filter: blur(24px) saturate(165%);
  box-shadow:
    0 2px 20px -4px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 10px 15px -3px rgba(15, 23, 42, 0.05),
    0 4px 6px -4px rgba(15, 23, 42, 0.05);
  transition: all 0.5s ease-out;
}
.ss-auth-form-card:hover {
  border-color: rgba(255, 255, 255, 0.42);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.1) 100%);
  transform: translateY(-2px);
  box-shadow:
    0 20px 25px -5px rgba(15, 23, 42, 0.08),
    0 8px 10px -6px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
`;

export function LandingStylePageBackground() {
  return (
    <>
      <style>{LANDING_PAGE_BG_CSS}</style>
      <div className="ss-page-bg-anim" aria-hidden="true" />
    </>
  );
}
