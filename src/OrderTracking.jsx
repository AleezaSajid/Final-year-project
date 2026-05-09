import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageBackground } from "./components/PageBackground.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { listOrdersForCustomer } from "./api/ordersApi.js";

export default function OrderTracking() {
  const { user } = useAuth();
  const [count, setCount] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id || user.role !== "customer") {
      setCount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listOrdersForCustomer(user.id);
        if (!cancelled) setCount(Array.isArray(rows) ? rows.length : 0);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load orders.");
          setCount(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  const detail =
    user?.role === "customer" && count != null
      ? `Your account has ${count} order record${count === 1 ? "" : "s"} on the server. Use Track Orders for full status and history.`
      : user?.role === "customer" && error
        ? error
        : "Placeholder page for order tracking. Content will be added later.";

  return (
    <div className="relative isolate min-h-screen bg-transparent">
      <PageBackground />
      <div style={{ padding: "2rem", maxWidth: "40rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Real-Time Order Tracking</h1>
        <p style={{ color: "#64748b", lineHeight: 1.6 }}>{detail}</p>
        {user?.role === "customer" ? (
          <p style={{ marginTop: "1rem" }}>
            <Link to="/track-orders" style={{ color: "#3b6b52", fontWeight: 600 }}>
              Open Track Orders
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
