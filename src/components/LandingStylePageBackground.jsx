import React from "react";

/** Same full-viewport animated wash as SewServeLandingPage — used on login routes only. */
const LANDING_PAGE_BG_CSS = `
.ss-page-bg-anim {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(ellipse 100% 80% at 10% 0%, rgba(167, 243, 208, 0.5), transparent 55%),
    radial-gradient(ellipse 90% 70% at 95% 15%, rgba(186, 230, 253, 0.52), transparent 52%),
    radial-gradient(ellipse 85% 60% at 50% 100%, rgba(216, 180, 254, 0.38), transparent 55%),
    radial-gradient(ellipse 60% 50% at 70% 55%, rgba(226, 232, 240, 0.45), transparent 50%),
    linear-gradient(180deg, #eef2f7 0%, #e2e8f0 35%, #f1f5f9 70%, #f8fafc 100%);
  background-size: 140% 140%;
  animation: ss-bg-gradient-drift 52s ease-in-out infinite alternate;
  filter: blur(28px) brightness(1.06);
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
