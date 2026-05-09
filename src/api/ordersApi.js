/**
 * Order API: cookie session (/api/orders) with legacy port-5000 /orders fallback.
 */

import { api, getApiBaseUrl } from "./client.js";
import { measurementOrderPayloadToServerBody } from "../utils/measurementOrderPayload.js";
import { mapApiOrderToRecentRow } from "../utils/mapApiOrderToRecentRow.js";

function notifyOrderListsInvalidated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sewserve:orders-refresh"));
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (data && data.success === true && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.orders)) return data.orders;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

function unwrapCreated(data) {
  if (!data || typeof data !== "object") return data;
  if (data.success === true && data.data != null && !Array.isArray(data.data)) return data.data;
  if (data.order) return data.order;
  if (data.data != null && typeof data.data === "object" && !Array.isArray(data.data)) return data.data;
  return data;
}

/** POST structured wizard order. Returns created order document from API. */
export async function createMeasurementOrder(orderPayload) {
  const body = measurementOrderPayloadToServerBody(orderPayload);

  try {
    const data = await api("/api/orders", { method: "POST", json: body });
    const created = unwrapCreated(data);
    notifyOrderListsInvalidated();
    return created;
  } catch (err) {
    if (err && (err.status === 404 || err.status === 405)) {
      return legacyCreateOrder(body);
    }
    throw err;
  }
}

/** Legacy Express shape from tailor dashboard */
async function legacyCreateOrder(body) {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("API base URL is not configured.");
  }
  const compatibility = {
    customerName: body.customerName,
    customerId: body.customerId,
    tailorId: body.tailorId,
    garmentType: body.garmentType,
    measurements: body.measurements || {},
    dueDate: body.dueDate ?? null,
    price: Number(body.price) || 0,
    status:
      body.status === "new" || body.status === "pending"
        ? "order_placed"
        : body.status || "order_placed",
    customerPhone: body.customerPhone,
    garmentCategory: body.garmentCategory,
    style: body.style,
    notes: body.notes,
    orderId: body.orderId,
    createdAt: body.createdAt,
    orderPayload: body.orderPayload,
  };

  const res = await fetch(`${base}/orders`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(compatibility),
  });

  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw.slice(0, 200) };
    }
  }
  if (!res.ok) {
    const msg = data.error || data.message || res.statusText || "Order creation failed";
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  const created = unwrapCreated(data);
  notifyOrderListsInvalidated();
  return created;
}

/**
 * List orders for the signed-in customer, filtered by customerId.
 */
/**
 * Fetch a single order by Mongo id (matches backend GET /orders/:orderId).
 * @param {string} orderId
 */
/** Ensure REST order documents have `id` for client state (matches `_id`). */
export function normalizeApiOrderDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  const id = doc._id != null ? String(doc._id) : doc.id != null ? String(doc.id) : "";
  return id ? { ...doc, id } : { ...doc };
}

export async function getOrderById(orderId) {
  const id = String(orderId || "").trim();
  if (!id) {
    throw new Error("Order id is required.");
  }
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("API base URL is not configured.");
  }
  const res = await fetch(`${base}/orders/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
  });
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw.slice(0, 200) };
    }
  }
  if (!res.ok) {
    const msg = data.message || data.error || res.statusText || "Could not load order.";
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  return data;
}

/**
 * Order flagged by tailor as active for this customer (GET /orders/customer/:id/active).
 */
export async function getActiveOrderForCustomer(customerId) {
  const cid = String(customerId || "").trim();
  if (!cid) {
    throw new Error("customerId is required.");
  }
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("API base URL is not configured.");
  }
  const res = await fetch(`${base}/orders/customer/${encodeURIComponent(cid)}/active`, {
    method: "GET",
    credentials: "include",
  });
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw.slice(0, 200) };
    }
  }
  if (!res.ok) {
    const msg = data.message || data.error || res.statusText || "No active order.";
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  return data;
}

/**
 * Partial update (measurements, garment, customer snapshot) — backend PATCH /orders/:orderId
 * @param {string} orderId Mongo _id
 * @param {Record<string, unknown>} body
 */
export async function patchOrderWizardFields(orderId, body) {
  const id = String(orderId || "").trim();
  if (!id) {
    throw new Error("Order id is required.");
  }
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("API base URL is not configured.");
  }
  const res = await fetch(`${base}/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body && typeof body === "object" ? body : {}),
  });
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw.slice(0, 200) };
    }
  }
  if (!res.ok) {
    const msg = data.message || data.error || res.statusText || "Could not update order.";
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  return data;
}

export async function listOrdersForCustomer(customerId) {
  const cid = String(customerId || "").trim();
  if (!cid) return [];

  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("API base URL is not configured.");
  }

  try {
    const res = await fetch(`${base}/orders?customerId=${encodeURIComponent(cid)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Orders request failed (${res.status})`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : unwrapList(data);
    return list.filter((o) => String(o.customerId || o.customer?.id || "") === cid);
  } catch (e1) {
    try {
      const res = await fetch(`${base}/orders/customer/${encodeURIComponent(cid)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Orders request failed (${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : unwrapList(data);
      return list.filter((o) => String(o.customerId || "") === cid);
    } catch (e2) {
      const msg =
        (e1 instanceof Error && e1.message) ||
        (e2 instanceof Error && e2.message) ||
        "Could not load orders from the server.";
      throw new Error(msg);
    }
  }
}

export function mapOrdersToRecentRows(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.map(mapApiOrderToRecentRow);
}

/**
 * Update order workflow on the server (legacy Express + optional /api proxy). Emits socket update when backend supports it.
 * @param {string} orderId
 * @param {{ status?: string, currentStepIndex?: number }} payload — prefer `{ status }` only so the server advances from the requested status, not a stale step index.
 */
export async function postOrderStatusUpdate(orderId, payload) {
  const id = String(orderId || "").trim();
  if (!id) {
    throw new Error("Order id is required.");
  }
  const body = { orderId: id, ...(payload && typeof payload === "object" ? payload : {}) };

  try {
    return await api("/api/orders/update-status", { method: "POST", json: body });
  } catch (err) {
    if (err && (err.status === 404 || err.status === 405)) {
      const base = getApiBaseUrl();
      if (!base) throw err;
      const res = await fetch(`${base}/orders/update-status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = { message: raw.slice(0, 200) };
        }
      }
      if (!res.ok) {
        const msg = data.message || data.error || res.statusText || "Update failed";
        const e = new Error(msg);
        e.status = res.status;
        throw e;
      }
      return data;
    }
    throw err;
  }
}
