import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import {
  requestPasswordResetOtp,
  verifyResetOtpAndSetPassword,
} from "../api/forgotPasswordApi.js";
import CustomerAuthShell, {
  AuthBackButton,
  AuthCard,
  AuthCardHeader,
  AuthCardSubtitle,
  AuthCardTitle,
  AuthEmailHint,
  AuthField,
  AuthFormStack,
  AuthGhostButton,
  AuthIconBtn,
  AuthIconCircle,
  AuthIconLeft,
  AuthInput,
  AuthInputWithToggle,
  AuthMessageBox,
  AuthOtpInput,
  AuthPrimaryButton,
  AuthStepDot,
  AuthStepIndicator,
  AuthTextLink,
} from "../components/auth/CustomerAuthShell.jsx";
import { resolveLoginPathAfterReset } from "../utils/forgotPasswordRoutes.js";

const MIN_PASSWORD_LENGTH = 6;

const stepMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
};

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4V6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10V8a4 4 0 118 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 15V9a4 4 0 018-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l7 4v5c0 4.2-3.1 7.9-7 9-3.9-1.1-7-4.8-7-9V7l7-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ passwordVisible }) {
  if (passwordVisible) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function stepIndex(step) {
  if (step === "email") return 0;
  if (step === "otp") return 1;
  if (step === "password" || step === "done") return 2;
  return 0;
}

const STEP_COPY = {
  email: {
    title: "Forgot Password?",
    subtitle: "Enter your email and we'll send you a reset OTP.",
    icon: <MailIcon />,
  },
  otp: {
    title: "Verify OTP",
    subtitle: "Enter the 6-digit code we sent to your email.",
    icon: <ShieldIcon />,
  },
  password: {
    title: "Update Password",
    subtitle: "Choose a strong new password for your account.",
    icon: <LockIcon />,
  },
  done: {
    title: "Password Updated",
    subtitle: "Redirecting you to login…",
    icon: <KeyIcon />,
  },
};

export default function ForgotPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginPath = useMemo(
    () => resolveLoginPathAfterReset(searchParams, location.state),
    [searchParams, location.state]
  );
  const loginLabel = loginPath === "/tailor-login" ? "tailor login" : "login";

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const activeStep = step === "done" ? 2 : stepIndex(step);
  const copy = STEP_COPY[step] || STEP_COPY.email;
  const busy = sendLoading || otpLoading || updateLoading || resendLoading;

  useEffect(() => {
    document.title = "SewServe | Reset password";
  }, []);

  useEffect(() => {
    if (step !== "done") return undefined;
    const timer = setTimeout(() => {
      navigate(loginPath, { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [step, loginPath, navigate]);

  function clearMessages() {
    setError("");
    setInfo("");
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    clearMessages();
    const trimmed = String(email || "").trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    setSendLoading(true);
    try {
      const data = await requestPasswordResetOtp(trimmed);
      setEmail(trimmed);
      setOtp("");
      setStep("otp");
      setInfo(
        data?.message ||
          "If an account exists with this email, we sent a reset code. Check your inbox."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset code. Please try again.");
    } finally {
      setSendLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    clearMessages();
    const digits = String(otp || "").replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setOtpLoading(true);
    try {
      setOtp(digits);
      setStep("password");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    clearMessages();
    const trimmed = String(email || "").trim().toLowerCase();
    if (!trimmed) return;
    setResendLoading(true);
    try {
      const data = await requestPasswordResetOtp(trimmed);
      setInfo(data?.message || "A new reset code was sent if the account exists.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    clearMessages();
    const trimmedEmail = String(email || "").trim().toLowerCase();
    const digits = String(otp || "").replace(/\D/g, "");

    if (digits.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      setStep("otp");
      return;
    }
    if (String(newPassword || "").length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setUpdateLoading(true);
    try {
      const data = await verifyResetOtpAndSetPassword(trimmedEmail, digits, newPassword);
      setStep("done");
      setInfo(data?.message || "Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password. Please try again.");
    } finally {
      setUpdateLoading(false);
    }
  }

  function goBack() {
    clearMessages();
    if (step === "otp") {
      setStep("email");
      return;
    }
    if (step === "password") {
      setStep("otp");
    }
  }

  return (
    <CustomerAuthShell>
      <AuthCard>
        {step !== "done" ? (
          <AuthStepIndicator aria-label="Password reset progress">
            <AuthStepDot $active={activeStep === 0} $done={activeStep > 0} />
            <AuthStepDot $active={activeStep === 1} $done={activeStep > 1} />
            <AuthStepDot $active={activeStep === 2} $done={false} />
          </AuthStepIndicator>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div key={step} {...stepMotion}>
            <AuthCardHeader>
              <AuthIconCircle aria-hidden>{copy.icon}</AuthIconCircle>
              <AuthCardTitle>{copy.title}</AuthCardTitle>
              <AuthCardSubtitle>{copy.subtitle}</AuthCardSubtitle>
            </AuthCardHeader>

            {step === "email" ? (
              <form onSubmit={handleSendOtp} noValidate>
                <AuthFormStack>
                  {error ? <AuthMessageBox role="alert">{error}</AuthMessageBox> : null}
                  {info ? (
                    <AuthMessageBox $variant="success" role="status">
                      {info}
                    </AuthMessageBox>
                  ) : null}

                  <AuthField>
                    <AuthIconLeft>
                      <MailIcon />
                    </AuthIconLeft>
                    <AuthInput
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      required
                    />
                  </AuthField>

                  <AuthPrimaryButton type="submit" disabled={sendLoading}>
                    {sendLoading ? "Sending…" : "Send Reset OTP"}
                  </AuthPrimaryButton>
                </AuthFormStack>
              </form>
            ) : null}

            {step === "otp" ? (
              <form onSubmit={handleVerifyOtp} noValidate>
                <AuthFormStack>
                  {error ? <AuthMessageBox role="alert">{error}</AuthMessageBox> : null}
                  {info ? (
                    <AuthMessageBox $variant="success" role="status">
                      {info}
                    </AuthMessageBox>
                  ) : null}

                  <AuthEmailHint>
                    Code sent to <strong>{email}</strong>
                  </AuthEmailHint>

                  <AuthField>
                    <AuthOtpInput
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      placeholder="______"
                      value={otp}
                      onChange={(ev) => setOtp(ev.target.value)}
                      aria-label="Verification code"
                      required
                    />
                  </AuthField>

                  <AuthPrimaryButton type="submit" disabled={otpLoading || resendLoading}>
                    {otpLoading ? "Verifying…" : "Verify OTP"}
                  </AuthPrimaryButton>
                  <AuthGhostButton
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendLoading || otpLoading}
                  >
                    {resendLoading ? "Resending…" : "Resend OTP"}
                  </AuthGhostButton>
                  <AuthBackButton type="button" onClick={goBack} disabled={busy}>
                    Back
                  </AuthBackButton>
                </AuthFormStack>
              </form>
            ) : null}

            {step === "password" ? (
              <form onSubmit={handleUpdatePassword} noValidate>
                <AuthFormStack>
                  {error ? <AuthMessageBox role="alert">{error}</AuthMessageBox> : null}

                  <AuthField>
                    <AuthIconLeft>
                      <LockIcon />
                    </AuthIconLeft>
                    <AuthInputWithToggle
                      type={showPassword ? "text" : "password"}
                      name="newPassword"
                      autoComplete="new-password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(ev) => setNewPassword(ev.target.value)}
                      required
                    />
                    <AuthIconBtn
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon passwordVisible={showPassword} />
                    </AuthIconBtn>
                  </AuthField>

                  <AuthField>
                    <AuthIconLeft>
                      <LockIcon />
                    </AuthIconLeft>
                    <AuthInputWithToggle
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      autoComplete="new-password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(ev) => setConfirmPassword(ev.target.value)}
                      required
                    />
                    <AuthIconBtn
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={
                        showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                      }
                    >
                      <EyeIcon passwordVisible={showConfirmPassword} />
                    </AuthIconBtn>
                  </AuthField>

                  <AuthPrimaryButton type="submit" disabled={updateLoading}>
                    {updateLoading ? "Updating…" : "Update Password"}
                  </AuthPrimaryButton>
                  <AuthBackButton type="button" onClick={goBack} disabled={updateLoading}>
                    Back
                  </AuthBackButton>
                </AuthFormStack>
              </form>
            ) : null}

            {step === "done" ? (
              <AuthFormStack>
                {info ? (
                  <AuthMessageBox $variant="success" role="status">
                    {info}
                  </AuthMessageBox>
                ) : null}
                <p style={{ margin: 0, textAlign: "center", fontSize: "0.94rem", color: "#556575" }}>
                  Redirecting to {loginLabel} in a moment…
                </p>
              </AuthFormStack>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {step === "email" ? <AuthTextLink to={loginPath}>Back to Login</AuthTextLink> : null}
      </AuthCard>
    </CustomerAuthShell>
  );
}
