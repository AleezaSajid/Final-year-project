import React from "react";
import { PageBackground } from "./components/PageBackground.jsx";

export default function LocalTailors() {
  return (
    <div className="relative isolate min-h-screen bg-transparent">
      <PageBackground />
      <div style={{ padding: "2rem", maxWidth: "40rem", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Trusted Local Tailors</h1>
      <p style={{ color: "#64748b", lineHeight: 1.6 }}>
        Placeholder page for local tailors. Content will be added later.
      </p>
    </div>
    </div>
  );
}
