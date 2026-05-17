/** Premium SewServe tailor dashboard surface tokens (UI only). */
/** Transparent so {@link LandingStylePageBackground} shows through (same as landing). */
export const TD_PAGE_BG = "bg-transparent";

export const TD_HOVER_LIFT =
  "transition-all duration-[200ms] ease-out hover:-translate-y-[2px]";

export const TD_GLASS_CARD = [
  "rounded-[20px] border border-white/70 bg-white/88 p-4",
  "shadow-[0_4px_24px_-10px_rgba(31,41,51,0.1)] backdrop-blur-sm",
  TD_HOVER_LIFT,
  "hover:shadow-[0_12px_32px_-12px_rgba(31,41,51,0.14)]",
].join(" ");

export const TD_GLASS_CARD_COMPACT = [
  "rounded-[18px] border border-white/75 bg-white/92 p-3.5",
  "shadow-[0_8px_26px_-10px_rgba(31,41,51,0.12)] backdrop-blur-[2px]",
  TD_HOVER_LIFT,
  "hover:shadow-[0_14px_32px_-12px_rgba(31,41,51,0.16)]",
].join(" ");

export const TD_STAT_ICON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[0_4px_12px_-6px_rgba(31,41,51,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-white/85";

export const TD_HERO_CARD = [
  "relative overflow-hidden rounded-[20px]",
  "border border-white/25 bg-gradient-to-br from-[#164A3A] via-[#1A5C47] to-[#1F6B52]",
  "px-4 py-4 text-white",
  "shadow-[0_10px_40px_-14px_rgba(22,74,58,0.62)] backdrop-blur-md",
  "sm:px-5 sm:py-4",
].join(" ");

export const TD_SIDEBAR_SURFACE_STYLE = {
  background: "linear-gradient(180deg, #f4fcf8 0%, #edf7f3 55%, #e7f3ef 100%)",
  borderRight: "1px solid rgba(46,125,90,0.08)",
  boxShadow: "8px 0 30px rgba(46,125,90,0.04)",
};

export const TD_SIDEBAR_NAV_BASE =
  "relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-[#183b2d] transition-all duration-200 ease-out [&_svg]:text-[#2f6f56]";

export const TD_SIDEBAR_NAV_ACTIVE =
  "bg-[rgba(46,125,90,0.08)] border border-[rgba(46,125,90,0.14)] shadow-[0_6px_18px_rgba(46,125,90,0.08)]";

export const TD_SIDEBAR_NAV_IDLE =
  "border border-transparent bg-transparent hover:bg-[rgba(46,125,90,0.05)] hover:-translate-y-[2px]";

export const TD_CHATS_SURFACE = [
  "flex min-h-[15.5rem] flex-col rounded-[28px] p-4",
  "border border-[rgba(140,170,160,0.18)] bg-[rgba(255,255,255,0.72)]",
  "shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur-[18px]",
  TD_HOVER_LIFT,
  "hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]",
].join(" ");

export const TD_CHATS_OPEN_BTN = [
  "rounded-xl border border-[rgba(46,125,90,0.2)] bg-gradient-to-r from-[#164A3A] via-[#1A5C47] to-[#1F6B52]",
  "px-4 py-2.5 text-sm font-semibold text-white",
  "shadow-[0_8px_22px_-6px_rgba(22,74,58,0.45)]",
  "transition-all duration-200 ease-out",
  "hover:-translate-y-[2px] hover:brightness-105 hover:shadow-[0_12px_28px_-8px_rgba(22,74,58,0.5)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B52]/30 focus-visible:ring-offset-2",
].join(" ");

export const TD_INPUT_CLASS =
  "w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2933] placeholder:text-[#9CA3AF] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] focus:border-[#1F6B52]/40 focus:outline-none focus:ring-2 focus:ring-[#1F6B52]/15";

export const TD_PRIMARY_BUTTON_CLASS = [
  "rounded-xl bg-gradient-to-r from-[#1F6B52] to-[#2A7A5E]",
  "px-3.5 py-2 text-xs font-semibold text-white",
  "shadow-[0_4px_14px_-4px_rgba(31,107,82,0.45)]",
  "transition-all duration-200 ease-out",
  "hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_8px_20px_-6px_rgba(31,107,82,0.5)]",
  "active:scale-[0.98] sm:text-sm sm:px-4",
].join(" ");

export const TD_SECONDARY_NAVY_BTN = [
  "rounded-xl bg-[#1F2933] px-3.5 py-2 text-xs font-semibold text-white shadow-sm",
  "transition-all duration-200 ease-out",
  "hover:-translate-y-0.5 hover:bg-[#374151] hover:shadow-md active:scale-[0.97]",
  "sm:text-sm sm:px-4",
].join(" ");

export const TD_GHOST_BTN = [
  "rounded-xl border border-[#E8EBE9] bg-[#F6F8F7]/80 font-bold text-[#1F2933]",
  "transition-all duration-200 ease-out",
  "hover:-translate-y-0.5 hover:border-[#1F6B52]/25 hover:bg-white hover:shadow-sm",
].join(" ");

export const TD_METRIC_CARD_CLASS = TD_GLASS_CARD_COMPACT;
export const TD_CARD_CLASS = TD_GLASS_CARD;
