import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";

import { listOrdersForCustomer } from "./api/ordersApi.js";
import { mapApiOrderToRecentRow } from "./utils/mapApiOrderToRecentRow.js";
import { socket } from "./socket.js";
import { resolveCustomerIdForChat } from "./utils/chatIdentity.js";
import { useAuth } from "./context/AuthContext.jsx";
import DashboardNavbar from "./components/DashboardNavbar.jsx";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";

const C = {
  heading: "#1a1a1a",
  greenDark: "#3d6b4a",
};

const GLASS_CARD =
  "overflow-hidden rounded-2xl border border-white/40 bg-white/45 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.14)] backdrop-blur-xl";

function isPlainOrderObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function mergeOrderPatch(existing, patch) {
  if (!isPlainOrderObject(patch)) return existing;
  const base = isPlainOrderObject(existing) ? existing : {};
  const out = { ...base, ...patch };
  for (const key of ["notes", "orderPayload", "wizardData", "measurements", "style"]) {
    const p = patch[key];
    const e = base[key];
    if (isPlainOrderObject(p) && isPlainOrderObject(e)) {
      out[key] = { ...e, ...p };
    } else if (p !== undefined) {
      out[key] = p;
    }
  }
  return out;
}

function sortOrdersByNewestFirst(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(a.createdAt || a.date || 0).getTime();
    const tb = new Date(b.createdAt || b.date || 0).getTime();
    return tb - ta;
  });
}

function orderIdentity(order) {
  if (!order || typeof order !== "object") return "";
  const raw = order._id ?? order.id ?? order.orderId;
  if (raw != null && typeof raw === "object" && "$oid" in raw && raw.$oid != null) {
    return String(raw.$oid).trim();
  }
  return String(raw ?? "").trim();
}

function upsertCustomerOrderList(prev, raw, customerId) {
  if (!raw || typeof raw !== "object") return prev;
  const cid = String(customerId || "").trim();
  const orderCid = String(raw.customerId || "").trim();
  if (!cid || orderCid !== cid) return prev;
  const id = orderIdentity(raw);
  if (!id) return prev;
  const i = prev.findIndex((o) => orderIdentity(o) === id);
  let next;
  if (i === -1) {
    next = [raw, ...prev];
  } else {
    const merged = mergeOrderPatch(prev[i], raw);
    next = [...prev];
    next[i] = merged;
  }
  return sortOrdersByNewestFirst(next);
}

function StatusPill({ variant }) {
  if (variant === "processing") {
    return (
      <span
        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: "rgba(76, 124, 76, 0.12)", color: C.greenDark }}
      >
        Processing
      </span>
    );
  }
  if (variant === "delivered") {
    return (
      <span
        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: "rgba(76, 124, 76, 0.15)", color: C.greenDark }}
      >
        Delivered
      </span>
    );
  }
  if (variant === "alteration") {
    return (
      <span
        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: "rgba(234, 88, 12, 0.14)", color: "#9a3412" }}
      >
        Alteration
      </span>
    );
  }
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: "rgba(225, 169, 42, 0.2)", color: "#92400e" }}
    >
      Out for Delivery
    </span>
  );
}

function formatRawOrderStatus(order) {
  if (!order || typeof order !== "object") return "—";
  const s = order.status;
  if (s == null || String(s).trim() === "") return "—";
  const t = String(s).replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const cid = resolveCustomerIdForChat(user);
      const list = await listOrdersForCustomer(cid);
      setOrders(sortOrdersByNewestFirst(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const cid = String(resolveCustomerIdForChat(user) || "").trim();
    if (!cid) return undefined;

    const onOrderNew = (payload) => {
      const raw = payload?.fullOrder || payload?.order;
      if (!raw || typeof raw !== "object") return;
      if (String(raw.customerId || "").trim() !== cid) return;
      setOrders((prev) => upsertCustomerOrderList(prev, raw, cid));
    };

    const onMeasurementUpdated = (payload) => {
      const raw = payload?.fullOrder || payload?.order;
      if (!raw || typeof raw !== "object") return;
      if (String(raw.customerId || "").trim() !== cid) return;
      setOrders((prev) => upsertCustomerOrderList(prev, raw, cid));
    };

    const onOrderStatusUpdated = (data) => {
      if (!data) return;
      if (data.fullOrder && typeof data.fullOrder === "object") {
        const raw = data.fullOrder;
        if (String(raw.customerId || "").trim() !== cid) return;
        setOrders((prev) => upsertCustomerOrderList(prev, raw, cid));
        return;
      }
      if (data.orderId == null || data.status == null) return;
      const oid = String(data.orderId);
      const st = String(data.status);
      setOrders((prev) =>
        prev.map((o) => (orderIdentity(o) === oid ? mergeOrderPatch(o, { status: st }) : o))
      );
    };

    socket.on("order:new", onOrderNew);
    socket.on("measurement:updated", onMeasurementUpdated);
    socket.on("order:statusUpdated", onOrderStatusUpdated);

    return () => {
      socket.off("order:new", onOrderNew);
      socket.off("measurement:updated", onMeasurementUpdated);
      socket.off("order:statusUpdated", onOrderStatusUpdated);
    };
  }, [user]);

  useEffect(() => {
    const onRefresh = () => void fetchOrders();
    window.addEventListener("sewserve:orders-refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener("sewserve:orders-refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      const row = mapApiOrderToRecentRow(order);
      if (statusFilter !== "all" && row.variant !== statusFilter) return false;
      if (!q) return true;
      const statusText = formatRawOrderStatus(order).toLowerCase();
      return (
        row.orderId.toLowerCase().includes(q) ||
        row.item.toLowerCase().includes(q) ||
        statusText.includes(q) ||
        String(order.status || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  return (
    <div
      className="relative isolate min-h-screen overflow-x-hidden antialiased"
      style={{ backgroundColor: "#eceff3" }}
    >
      <LandingStylePageBackground />

      <DashboardNavbar />

      <div className="relative z-10 font-['Inter',system-ui,sans-serif] text-slate-600">
        <main className="mx-auto w-full max-w-7xl px-4 py-[72px] sm:px-6 lg:px-8 lg:py-20">
          <button
            type="button"
            onClick={() => navigate("/customer/dashboard")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 transition hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to Dashboard
          </button>

          <section className={`flex min-h-0 flex-col p-5 sm:p-6 ${GLASS_CARD}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-apple-h3 font-semibold" style={{ color: C.heading }}>
                  All Orders
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {orders.length === 0 && !loading
                    ? "No orders yet."
                    : `${filteredOrders.length} of ${orders.length} shown`}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <label className="relative flex w-full min-w-[200px] flex-1 items-center sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search ID, item, status…"
                    className="w-full rounded-xl border border-slate-200/80 bg-white/70 py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    aria-label="Search orders"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 sm:w-[160px]"
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="processing">Processing</option>
                  <option value="inTransit">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="alteration">Alteration</option>
                </select>
              </div>
            </div>

            {error ? (
              <p className="mt-4 text-sm text-amber-800/90" role="alert">
                {error}
              </p>
            ) : null}

            <style>
              {`
                .orders-page-scroll {
                  scrollbar-width: thin;
                  scrollbar-color: rgba(61, 107, 74, 0.45) transparent;
                }
                .orders-page-scroll::-webkit-scrollbar {
                  width: 8px;
                }
                .orders-page-scroll::-webkit-scrollbar-track {
                  background: transparent;
                }
                .orders-page-scroll::-webkit-scrollbar-thumb {
                  background-color: rgba(61, 107, 74, 0.4);
                  border-radius: 9999px;
                  border: 2px solid transparent;
                  background-clip: padding-box;
                }
                .orders-page-scroll::-webkit-scrollbar-thumb:hover {
                  background-color: rgba(61, 107, 74, 0.55);
                }
              `}
            </style>

            <div
              className="orders-page-scroll relative mt-5 max-h-[min(70vh,720px)] overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-xl border border-slate-200/50 bg-white/35 py-2 pl-3 pr-2 sm:mt-6 sm:py-3 sm:pl-4"
              aria-label="All orders table, scroll for more"
            >
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-gray-200/90 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-sm">
                  <tr>
                    <th className="w-[19%] pb-3 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:pr-3">
                      Order ID
                    </th>
                    <th className="w-[26%] pb-3 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:pr-3">
                      Item
                    </th>
                    <th className="w-[22%] pb-3 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:pr-3">
                      Status
                    </th>
                    <th className="w-[18%] pb-3 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:pr-3">
                      Date
                    </th>
                    <th className="w-[15%] pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/90">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                        Loading orders…
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-1 py-10 text-center text-sm leading-relaxed text-slate-500">
                        {orders.length === 0
                          ? "No orders yet. Complete the measurement wizard to create your first order."
                          : "No orders match your search or filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const row = mapApiOrderToRecentRow(order);
                      return (
                        <tr key={row.rawId || row.orderId || orderIdentity(order)} className="align-top">
                          <td
                            className="py-3 pr-2 font-medium sm:py-3.5 sm:pr-3"
                            style={{ color: C.heading }}
                            title={row.orderId}
                          >
                            <span className="line-clamp-2 break-all sm:line-clamp-1">{row.orderId}</span>
                          </td>
                          <td className="py-3 pr-2 text-slate-700 sm:py-3.5 sm:pr-3" title={row.item}>
                            <span className="line-clamp-2 break-words">{row.item}</span>
                          </td>
                          <td className="py-3 pr-2 sm:py-3.5 sm:pr-3">
                            <StatusPill variant={row.variant} />
                          </td>
                          <td
                            className="py-3 pr-2 text-slate-600 sm:py-3.5 sm:pr-3"
                            title={row.delivery}
                          >
                            <span className="line-clamp-2 break-words sm:line-clamp-1">{row.delivery}</span>
                          </td>
                          <td className="py-3 sm:py-3.5">
                            <button
                              type="button"
                              onClick={() => navigate("/customer/dashboard")}
                              className="text-left text-sm font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-1"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-center text-xs text-slate-500">
              Need the public tracking experience?{" "}
              <button
                type="button"
                onClick={() => navigate("/track-orders#order-tracking")}
                className="font-semibold text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:opacity-80"
              >
                Open order tracking
              </button>
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
