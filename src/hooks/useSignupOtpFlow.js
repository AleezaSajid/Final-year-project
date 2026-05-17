import { useCallback, useEffect, useState } from "react";

import { useToast } from "../components/ToastProvider.jsx";

const PENDING_SIGNUP_EMAIL_KEY = "sewserve_pending_signup_email";

/**
 * Shared post-signup OTP gate state for customer and tailor signup.
 * Persists email in sessionStorage so OTP step survives page refresh.
 */
export function useSignupOtpFlow() {
  const toast = useToast();
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PENDING_SIGNUP_EMAIL_KEY);
      if (stored) {
        setOtpEmail(stored);
        setOtpOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openOtpGate = useCallback((email) => {
    const safe = String(email || "").trim().toLowerCase();
    setOtpEmail(safe);
    setOtpOpen(true);
    try {
      sessionStorage.setItem(PENDING_SIGNUP_EMAIL_KEY, safe);
    } catch {
      /* ignore */
    }
  }, []);

  const dismissOtpGate = useCallback(() => {
    setOtpOpen(false);
  }, []);

  const completeOtpGate = useCallback(() => {
    setOtpOpen(false);
    try {
      sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /** @returns {boolean} true if OTP gate opened (signup awaiting verification) */
  const handleRegisterResponse = useCallback(
    (data, email) => {
      if (data?.needsVerification) {
        openOtpGate(email);
        toast.success("Check your email", "We sent a 6-digit verification code.");
        return true;
      }
      return false;
    },
    [openOtpGate, toast]
  );

  return {
    otpOpen,
    otpEmail,
    openOtpGate,
    dismissOtpGate,
    completeOtpGate,
    handleRegisterResponse,
  };
}
