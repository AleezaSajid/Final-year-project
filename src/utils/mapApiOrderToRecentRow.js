/**
 * Map API / DB order document → Customer Dashboard “Recent Orders” table row.
 */

function statusToVariant(status) {
  const s = String(status || "").toLowerCase().replace(/\s+/g, "_");
  if (s === "rejected" || s === "declined" || s === "cancelled" || s === "canceled") {
    return "rejected";
  }
  if (
    s === "new" ||
    s === "pending" ||
    s === "order_placed" ||
    s === "processing" ||
    s === "measurements_verified"
  ) {
    return "processing";
  }
  if (s.includes("complete") || s === "delivered") return "delivered";
  if (s === "needs_alteration" || s.includes("alter")) return "alteration";
  if (s.includes("return")) return "alteration";
  if (
    s.includes("deliver") ||
    s.includes("transit") ||
    s.includes("ready_for_delivery") ||
    s === "stitching" ||
    s === "quality_check" ||
    s === "last_review"
  ) {
    return "inTransit";
  }
  return "processing";
}

function formatCreated(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * @param {Record<string, unknown>} order
 * @returns {{ orderId: string; item: string; delivery: string; variant: string; rawId: string }}
 */
export function mapApiOrderToRecentRow(order) {
  if (!order || typeof order !== "object") {
    return { orderId: "—", item: "—", delivery: "—", variant: "processing", rawId: "" };
  }
  const rawId = order._id ?? order.id ?? order.orderId ?? "";
  const idStr = rawId != null ? String(rawId) : "";
  const orderId = idStr
    ? idStr.startsWith("#")
      ? idStr
      : idStr.startsWith("ORD")
        ? `#${idStr}`
        : `#${idStr}`
    : "—";

  const item =
    (typeof order.garmentType === "string" && order.garmentType.trim()) ||
    (order.garment && typeof order.garment === "object" && typeof order.garment.type === "string"
      ? order.garment.type
      : null) ||
    (order.orderPayload &&
      order.orderPayload.garment &&
      typeof order.orderPayload.garment.type === "string" &&
      order.orderPayload.garment.type) ||
    "—";

  const created =
    order.createdAt ?? order.date ?? order.created_at ?? order.orderPayload?.createdAt ?? null;

  return {
    orderId,
    item: String(item).trim() || "—",
    delivery: formatCreated(created),
    variant: statusToVariant(order.status),
    rawId: idStr,
  };
}
