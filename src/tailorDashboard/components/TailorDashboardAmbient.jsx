import React from "react";

/** Low-opacity studio wash over the landing page background (tailor dashboard only). */
export default function TailorDashboardAmbient() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 55% 45% at 8% 12%, rgba(167,243,208,0.14), transparent 58%)",
            "radial-gradient(ellipse 50% 40% at 92% 8%, rgba(186,230,253,0.11), transparent 55%)",
            "radial-gradient(ellipse 45% 38% at 75% 92%, rgba(243,235,221,0.16), transparent 52%)",
            "radial-gradient(ellipse 40% 35% at 20% 80%, rgba(224,242,254,0.09), transparent 50%)",
          ].join(", "),
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.015]"
        aria-hidden
        style={{
          backgroundImage: [
            "repeating-linear-gradient(45deg, #1F6B52 0, #1F6B52 1px, transparent 1px, transparent 14px)",
            "repeating-linear-gradient(-45deg, #1F6B52 0, #1F6B52 1px, transparent 1px, transparent 14px)",
          ].join(", "),
        }}
      />
    </>
  );
}
