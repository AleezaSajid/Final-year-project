import React from "react";
import { motion } from "framer-motion";
import {
  formatStatusLabel,
  getProfileImageSrc,
  getStatusIndex,
  normalizeStatus,
  tailorId,
  workflowStages,
} from "../constants";
import {
  TD_CARD_CLASS,
  TD_INPUT_CLASS,
  TD_METRIC_CARD_CLASS,
  TD_PRIMARY_BUTTON_CLASS,
  TD_SECONDARY_NAVY_BTN,
} from "../tailorDashboardClassNames";

export default function TdDashboardWorkspace({
  profiles,
  newOrder,
  setNewOrder,
  formErrors,
  notifications,
  profileForm,
  setProfileForm,
  displayStats,
  displayMonthlyRevenue,
  activeOrder,
  upcomingOrders,
  newOrders,
  isAdvancing,
  advanceWorkflow,
  handleWorkflowStageClick,
  openChatForOrder,
  openChatFromActiveOrder,
  handleNewOrderSubmit,
  handleProfileUpdate,
  notificationText,
  navigate,
  setActiveOrderId,
}) {
  const cardClass = TD_CARD_CLASS;
  const inputClass = TD_INPUT_CLASS;
  const primaryButtonClass = TD_PRIMARY_BUTTON_CLASS;
  const secondaryNavyBtn = TD_SECONDARY_NAVY_BTN;
  const metricCardClass = TD_METRIC_CARD_CLASS;

  return (
    <div className="border-t border-white/40 pt-10">
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
        Workspace
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className={cardClass}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-apple-h3 font-semibold text-ink">Incoming Orders / New Orders</h3>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={openChatFromActiveOrder}
                  className={secondaryNavyBtn}
                >
                  Open Chat
                </motion.button>
              </div>
              <motion.button
                type="button"
                onClick={() => navigate("/tailor-profile")}
                title="Go to Profile"
                className="flex w-full items-center gap-4 rounded-2xl border border-white/50 bg-white/50 px-4 py-3 text-left shadow-sm backdrop-blur-md transition hover:bg-white/70"
                aria-label="Open tailor profile"
                whileTap={{ scale: 0.995 }}
              >
                <img
                  src={getProfileImageSrc(profiles[tailorId]?.profilePicture)}
                  alt={`${profiles[tailorId]?.name || "Tailor"} profile`}
                  className="h-16 w-16 rounded-full border border-white/60 object-cover shadow-sm sm:h-20 sm:w-20"
                />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Active Tailor</p>
                  <p className="text-base font-semibold text-slate-900">{profiles[tailorId]?.name || "Tailor"}</p>
                </div>
              </motion.button>

              <form onSubmit={handleNewOrderSubmit} className="space-y-3">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="e.g. Ali Khan"
                    value={newOrder.customerName}
                    onChange={(event) => setNewOrder((prev) => ({ ...prev, customerName: event.target.value }))}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="e.g. Bridal Dress"
                    value={newOrder.garmentType}
                    onChange={(event) => setNewOrder((prev) => ({ ...prev, garmentType: event.target.value }))}
                    className={inputClass}
                  />
                  <input
                    type="date"
                    value={newOrder.dueDate}
                    onChange={(event) => setNewOrder((prev) => ({ ...prev, dueDate: event.target.value }))}
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 5000"
                    value={newOrder.price}
                    onChange={(event) => setNewOrder((prev) => ({ ...prev, price: event.target.value }))}
                    className={inputClass}
                  />
                </div>
                {(formErrors.customerName || formErrors.garmentType || formErrors.price) ? (
                  <p className="text-xs text-red-600">
                    {formErrors.customerName || formErrors.garmentType || formErrors.price}
                  </p>
                ) : null}
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.985 }}
                  className={`w-full ${primaryButtonClass}`}
                >
                  Add New Order
                </motion.button>
              </form>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {newOrders.length > 0 ? (
                  newOrders.map((order) => (
                    <motion.button
                      key={order.id}
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setActiveOrderId(order.id)}
                      className={`${metricCardClass} w-full text-left`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <p className="text-lg font-semibold text-slate-900">{order.customerName}</p>
                        <span className="inline-flex items-center rounded-full bg-emerald-100/90 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
                          New
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-900">Garment:</span> {order.garmentType}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">Due Date:</span> {order.dueDate}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">Status:</span> {formatStatusLabel(order.status)}
                        </p>
                      </div>
                    </motion.button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/50 bg-white/40 p-5 text-center text-sm text-slate-500 shadow-sm backdrop-blur-md md:col-span-2">
                    No new orders yet
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="space-y-4">
              <h3 className="text-apple-h3 font-semibold text-ink">Production Workflow</h3>
              {activeOrder ? (
                <div className="space-y-3">
                  {workflowStages.map((stage, index) => (
                    <button
                      key={stage.status}
                      type="button"
                      onClick={() => handleWorkflowStageClick(activeOrder, stage.status)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition duration-300 hover:scale-[1.005] ${
                        index < getStatusIndex(activeOrder.status)
                          ? "border-emerald-200/80 bg-emerald-50/80"
                          : index === getStatusIndex(activeOrder.status)
                            ? "border-emerald-600/50 bg-emerald-100/90"
                            : "border-slate-200/60 bg-white/50 hover:bg-emerald-50/50"
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          index < getStatusIndex(activeOrder.status)
                            ? "bg-emerald-100 text-slate-900"
                            : index === getStatusIndex(activeOrder.status)
                              ? "bg-emerald-700 text-white"
                              : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-sm text-slate-700">{stage.label}</span>
                    </button>
                  ))}
                  <motion.button
                    type="button"
                    onClick={advanceWorkflow}
                    disabled={
                      getStatusIndex(activeOrder.status) >= workflowStages.length - 1 ||
                      normalizeStatus(activeOrder.status) === "needs_alteration"
                    }
                    whileTap={{ scale: 0.985 }}
                    className={`w-full ${primaryButtonClass} disabled:opacity-60 ${isAdvancing ? "scale-[0.98]" : ""}`}
                  >
                    {isAdvancing ? "Updating..." : "Advance Stage"}
                  </motion.button>
                  {normalizeStatus(activeOrder.status) === "last_review" ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/tailor/last-review/${activeOrder.id}`, {
                          state: {
                            order: activeOrder,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-emerald-100/90"
                    >
                      Open Final Inspection
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select an order to view workflow.</p>
              )}
            </div>
          </div>

          <div id="td-upcoming" className={cardClass}>
            <div className="space-y-4">
              <h3 className="text-apple-h3 font-semibold text-ink">Upcoming Orders</h3>
              <p className="text-sm text-slate-500">Orders scheduled for next days</p>
              <ul className="space-y-3">
                {upcomingOrders.length > 0 ? (
                  upcomingOrders.map((order) => (
                    <li
                      key={order.id}
                      className="rounded-xl border border-slate-200/50 bg-white/40 p-3 text-sm text-slate-600 backdrop-blur-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p>
                          <span className="font-semibold text-slate-800">{order.customerName}</span> —{" "}
                          {order.garmentType}{" "}
                          <span className="text-slate-500">(Due: {order.dueDate || order.date})</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <motion.button
                            type="button"
                            onClick={() => openChatForOrder(order)}
                            whileTap={{ scale: 0.97 }}
                            className={`${secondaryNavyBtn} text-xs py-1.5 px-3`}
                            aria-label={`Chat with ${order.customerName}`}
                          >
                            Chat
                          </motion.button>
                          {normalizeStatus(order.status) === "last_review" ? (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/tailor/last-review/${order.id}`, {
                                  state: {
                                    order,
                                  },
                                })
                              }
                              className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-emerald-100/90"
                            >
                              Open Final Inspection
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="rounded-xl border border-slate-200/50 p-3 text-sm text-slate-500">
                    No upcoming orders in the next 7 days.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={cardClass}>
            <div className="space-y-4">
              <h3 className="text-apple-h3 font-semibold text-ink">Notifications &amp; Alerts</h3>
              <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {notifications.slice(0, 5).map((note, index) => (
                  <li
                    key={`${index}-${notificationText(note)}`}
                    className="animate-[td-fade-in-up_280ms_ease-out] rounded-xl border border-slate-200/50 bg-white/40 px-3 py-2 text-sm text-slate-600 backdrop-blur-sm"
                  >
                    {notificationText(note)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={cardClass}>
            <div className="space-y-4">
              <h3 className="text-apple-h3 font-semibold text-ink">Tailor Profile</h3>
              <div className="flex items-center gap-3 rounded-xl border border-white/50 bg-white/45 p-3 shadow-sm backdrop-blur-md">
                <img
                  src={getProfileImageSrc(profiles[tailorId]?.profilePicture)}
                  alt={`${profiles[tailorId]?.name || "Tailor"} profile`}
                  className="h-16 w-16 rounded-full border border-white/60 object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{profiles[tailorId]?.name || "Tailor"}</p>
                  <p className="text-xs text-slate-500">Profile picture synced from profile page</p>
                </div>
              </div>
              <input
                type="text"
                placeholder="Name"
                value={profileForm.name}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Specialty (e.g. Bridal, Casual)"
                value={profileForm.skills}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, skills: event.target.value }))}
                className={inputClass}
              />
              <input
                type="number"
                placeholder="Experience (years)"
                value={profileForm.experience}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, experience: event.target.value }))}
                className={inputClass}
              />
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Contact: {profiles[tailorId]?.contact || "N/A"}</p>
                <p className="text-sm text-slate-500">Email: {profiles[tailorId]?.email || "N/A"}</p>
                <p className="text-sm text-slate-500">Skills: {profiles[tailorId]?.skills || "N/A"}</p>
                <p className="text-sm text-slate-500">Experience: {profiles[tailorId]?.experience || "N/A"}</p>
              </div>
              <motion.button
                type="button"
                onClick={handleProfileUpdate}
                whileTap={{ scale: 0.985 }}
                className={`w-full ${primaryButtonClass}`}
              >
                Update Profile
              </motion.button>
            </div>
          </div>
          <div className={cardClass}>
            <div className="space-y-3">
              <h3 className="text-apple-h3 font-semibold text-ink">Monthly Revenue</h3>
              <p className="text-sm text-slate-500">This month&apos;s completed orders</p>
              <h2 className="text-3xl font-bold text-emerald-700">
                Rs {displayMonthlyRevenue.toLocaleString("en-PK")}
              </h2>
              <p className="text-xs text-slate-400">Updates automatically based on completed orders</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
