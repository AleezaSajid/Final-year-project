import { useState } from "react";
import styled from "styled-components";

import { useToast } from "./ToastProvider.jsx";
import { sendAuthOtp, verifyAuthOtp } from "../api/authOtpApi.js";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
`;

const Panel = styled.div`
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  padding: 1.25rem 1.35rem 1.35rem;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  color: #1f3d66;
`;

const Title = styled.h2`
  margin: 0 0 0.35rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: #1a3558;
`;

const Hint = styled.p`
  margin: 0 0 1rem;
  font-size: 0.9rem;
  line-height: 1.45;
  color: #64748b;
`;

const SpamNote = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #94a3b8;
`;

const OtpInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 0.75rem;
  font-size: 1.35rem;
  letter-spacing: 0.28em;
  text-align: center;
  border-radius: 9px;
  border: 1px solid rgba(39, 76, 123, 0.22);
  background: #fff;
  color: #0f172a;
  outline: none;

  &:focus {
    border-color: #8ecfb0;
    box-shadow: 0 0 0 3px rgba(31, 168, 85, 0.12);
  }
`;

const Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 0.85rem;
`;

const BtnPrimary = styled.button`
  width: 100%;
  padding: 0.62rem 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  background: linear-gradient(180deg, #4a7c59 0%, #355542 100%);
  box-shadow: inset 0 1px 0 rgba(184, 214, 194, 0.35), 0 2px 10px rgba(32, 58, 44, 0.3);
  transition: filter 0.12s, transform 0.12s;

  &:hover:not(:disabled) {
    filter: brightness(1.06);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const BtnGhost = styled.button`
  width: 100%;
  padding: 0.55rem 1rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: #1a3558;
  border: 1px solid rgba(39, 76, 123, 0.22);
  border-radius: 9px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.75);

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

/**
 * Post-signup email OTP step (no route changes).
 * @param {{ email: string; onVerified: (verifyResult?: { redirectPath?: string; user?: object }) => Promise<void> | void; onDismiss: () => void }} props
 */
export default function EmailOtpGate({ email, onVerified, onDismiss }) {
  const toast = useToast();
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const safeEmail = String(email || "").trim().toLowerCase();

  async function handleVerify(e) {
    e.preventDefault();
    const digits = otp.replace(/\D/g, "");
    if (digits.length !== 6) {
      toast.error("Invalid code", "Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyAuthOtp(safeEmail, digits);
      toast.success("Verified", "Your email is verified.");
      await onVerified(result);
    } catch (err) {
      toast.error(
        "Verification failed",
        err instanceof Error ? err.message : "Invalid or expired code."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setSending(true);
    try {
      await sendAuthOtp(safeEmail);
      toast.success("Code sent", "Check your inbox for a new code.");
    } catch (err) {
      toast.error("Could not resend", err instanceof Error ? err.message : "Try again shortly.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Overlay role="dialog" aria-modal="true" aria-labelledby="otp-title">
      <Panel>
        <Title id="otp-title">Verify your email</Title>
        <Hint>
          We sent a <strong>6-digit code</strong> to <strong>{safeEmail}</strong>. It expires in{" "}
          <strong>10 minutes</strong>.
        </Hint>
        <form onSubmit={handleVerify}>
          <OtpInput
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="______"
            value={otp}
            onChange={(ev) => setOtp(ev.target.value)}
            aria-label="Verification code"
          />
          <SpamNote>Check your spam or junk folder if you don&apos;t see the OTP.</SpamNote>
          <Row>
            <BtnPrimary type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify & continue"}
            </BtnPrimary>
            <BtnGhost type="button" onClick={handleResend} disabled={sending || busy}>
              {sending ? "Sending…" : "Resend code"}
            </BtnGhost>
            <BtnGhost type="button" onClick={onDismiss} disabled={busy}>
              Close
            </BtnGhost>
          </Row>
        </form>
      </Panel>
    </Overlay>
  );
}
