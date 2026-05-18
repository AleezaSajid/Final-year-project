import { isOrderRejected } from "../../chatUtils.js";

/** Display-only helpers for WhatsApp-style chat workspaces (no business logic). */

export function chatInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function shortOrderId(id) {
  const s = String(id ?? "").trim();
  if (!s) return "";
  if (s.length <= 10) return s;
  return `…${s.slice(-6)}`;
}

/** Status badge from existing order / conversation fields only. */
export function chatStatusBadge(conv, order) {
  const convSt = String(conv?.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const raw = String(order?.status ?? order?.workflowStatus ?? conv?.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    isOrderRejected(order) ||
    order?.rejectedAt ||
    convSt === "rejected" ||
    convSt === "declined" ||
    raw === "rejected" ||
    raw === "declined"
  ) {
    return {
      label: "Declined",
      className:
        "rounded-md bg-rose-50/95 px-1.5 py-px text-[9px] font-medium text-rose-700/90 ring-1 ring-rose-200/80",
    };
  }

  if (order?.chatEnabled === false) {
    return {
      label: "Locked",
      className:
        "rounded-md bg-slate-50 px-1.5 py-px text-[9px] font-medium text-slate-600 ring-1 ring-slate-100/80",
    };
  }

  if (
    order?.isActive === true ||
    order?.acceptedAt ||
    raw === "accepted" ||
    convSt === "accepted"
  ) {
    return {
      label: "Accepted",
      className:
        "rounded-md bg-emerald-50/95 px-1.5 py-px text-[9px] font-medium text-emerald-700/90 ring-1 ring-emerald-100/80",
    };
  }
  if (raw === "pending" || raw === "awaiting_acceptance" || raw === "order_placed") {
    return {
      label: "Pending",
      className:
        "rounded-md bg-amber-50 px-1.5 py-px text-[9px] font-medium text-amber-800/90 ring-1 ring-amber-100/80",
    };
  }
  if (raw === "draft" || raw === "awaiting_tailor_selection") {
    return {
      label: "Locked",
      className:
        "rounded-md bg-slate-50 px-1.5 py-px text-[9px] font-medium text-slate-600 ring-1 ring-slate-100/80",
    };
  }
  if (convSt === "completed" || raw === "completed") {
    return {
      label: "Completed",
      className:
        "rounded-md bg-slate-50 px-1.5 py-px text-[9px] font-medium text-slate-600 ring-1 ring-slate-100/80",
    };
  }
  return {
    label: "Active",
    className: "rounded-md bg-sky-50 px-1.5 py-px text-[9px] font-medium text-sky-700 ring-1 ring-sky-100/80",
  };
}

/** Sidebar conversation row — display classes only */
export function sidebarRowClassName(selected) {
  return [
    "flex w-full gap-3 px-3.5 py-3 text-left transition-colors duration-150 ease-out",
    selected
      ? "bg-emerald-50/90 shadow-[inset_3px_0_0_0_#00a884]"
      : "bg-white hover:bg-slate-50/80 active:bg-slate-100/70",
  ].join(" ");
}

export const sidebarNameClass = "truncate text-[15px] font-bold text-slate-900";
export const sidebarTimeClass = "shrink-0 text-[10px] font-normal text-slate-400/90";
export const sidebarPreviewClass = "min-w-0 flex-1 truncate text-[13px] font-normal text-slate-500";
export const sidebarUnreadClass =
  "flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[10px] font-bold leading-none text-white shadow-sm";

export function avatarClassName(size = "md", extra = "") {
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 text-base"
      : size === "sm"
        ? "h-10 w-10 text-xs"
        : "h-12 w-12 text-sm";
  return `flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#128c7e] to-[#075e54] font-bold text-white shadow-sm ring-2 ring-white ${sizeClass} ${extra}`.trim();
}
