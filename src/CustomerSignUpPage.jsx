import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

import signupTailorBg from "./assets/images/signup-tailor-bg.png";
import EmailOtpGate from "./components/EmailOtpGate.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useSignupOtpFlow } from "./hooks/useSignupOtpFlow.js";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";
import { customerPostAuthPath } from "./utils/customerOnboarding.js";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const FEATURES = [
  {
    title: "Nearby Tailors",
    desc: "Connect with verified tailors near you.",
  },
  {
    title: "Smart Measurements",
    desc: "Save and manage your measurements easily.",
  },
  {
    title: "Live Order Chat",
    desc: "Chat in real time and track your orders.",
  },
];

const Page = styled.div`
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  color: #1f3d66;
  background: #e8f1fa;
  overflow: hidden;
`;

const PageBackdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: #e8f1fa;
  background-image: url(${signupTailorBg});
  background-repeat: no-repeat;
  background-size: auto min(108%, 960px);
  background-position: left bottom;

  @media (max-width: 980px) {
    background-size: cover;
    background-position: left center;
  }
`;

const PageOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      transparent 0%,
      rgba(241, 247, 255, 0.14) 42%,
      rgba(248, 250, 252, 0.52) 56%,
      rgba(252, 253, 255, 0.82) 68%,
      rgba(255, 255, 255, 0.9) 80%
    ),
    radial-gradient(ellipse 88% 52% at 10% 8%, rgba(236, 245, 255, 0.72) 0%, rgba(236, 245, 255, 0.26) 46%, transparent 72%),
    linear-gradient(108deg, rgba(238, 246, 255, 0.48) 0%, rgba(244, 249, 255, 0.12) 28%, transparent 48%);
`;

const SplitLayout = styled.div`
  position: relative;
  z-index: 2;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  min-height: 100vh;
  min-height: 100dvh;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    min-height: 0;
  }
`;

const HeroPanel = styled.aside`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: min(100vh, 100dvh);
  padding: clamp(1rem, 2.2vw, 1.6rem) clamp(0.75rem, 1.4vw, 1.15rem) clamp(1rem, 2.2vw, 1.6rem)
    clamp(1.25rem, 2.5vw, 2rem);

  @media (max-width: 980px) {
    min-height: clamp(22rem, 52vh, 28rem);
    padding: 1.25rem 1rem 1rem;
  }
`;

const HeroOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 72% 46% at 12% 10%, rgba(236, 245, 255, 0.38) 0%, transparent 68%);
  pointer-events: none;
`;

const HeroInner = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  max-width: 36rem;
  min-height: 0;

  @media (max-width: 980px) {
    max-width: 100%;
    align-items: center;
    text-align: center;
  }
`;

const BrandLogoLink = styled(Link)`
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
  margin-bottom: clamp(0.85rem, 2vh, 1.25rem);
  align-self: flex-start;

  @media (max-width: 980px) {
    align-self: center;
    margin-bottom: 1rem;
  }
`;

const BrandLogoImg = styled.img`
  display: block;
  max-height: 50px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 6px 16px rgba(26, 53, 88, 0.16));
  transition: transform 0.25s ease, filter 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 10px 22px rgba(26, 53, 88, 0.22));
  }
`;

const BrandHeading = styled.h1`
  margin: 0 0 0.65rem;
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(2rem, 3.6vw, 2.85rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #1a3558;
  max-width: 13ch;

  @media (max-width: 980px) {
    max-width: 18ch;
  }
`;

const BrandSubtitle = styled.p`
  margin: 0 0 clamp(0.9rem, 2vh, 1.35rem);
  font-size: clamp(0.95rem, 1.5vw, 1.08rem);
  line-height: 1.55;
  color: #4a5d70;
  max-width: 30rem;
`;

const FeatureList = styled.ul`
  list-style: none;
  margin: auto 0 clamp(1rem, 3vh, 1.75rem);
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  width: 100%;
  max-width: 100%;

  @media (max-width: 980px) {
    margin: 1rem 0 1.25rem;
    grid-template-columns: 1fr;
    max-width: 24rem;
    gap: 0.5rem;
  }
`;

const FeatureCard = styled.li`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.42rem;
  padding: 0.65rem 0.62rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.88);
  background: linear-gradient(
    160deg,
    rgba(255, 255, 255, 0.38) 0%,
    rgba(255, 255, 255, 0.22) 100%
  );
  box-shadow:
    0 3px 14px -6px rgba(26, 53, 88, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  text-align: left;

  @media (max-width: 980px) {
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0.85rem;
  }
`;

const FeatureIcon = styled.span`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.95rem;
  height: 1.95rem;
  border-radius: 0.65rem;
  background: rgba(255, 255, 255, 0.45);
  color: #264a38;
  box-shadow: 0 1px 5px rgba(26, 53, 88, 0.04);
`;

const FeatureTitle = styled.p`
  margin: 0 0 0.2rem;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.25;
  color: #142d4a;
`;

const FeatureDesc = styled.p`
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.4;
  color: #3a4f63;
`;

const FormPanel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(0.85rem, 1.6vw, 1.25rem) clamp(1.25rem, 2.5vw, 2rem) clamp(0.85rem, 1.6vw, 1.25rem)
    clamp(0.75rem, 1.4vw, 1.15rem);
  background: transparent;
`;

const Card = styled.div`
  width: 100%;
  max-width: 500px;
  padding: clamp(1.05rem, 1.8vw, 1.35rem) clamp(1.25rem, 2vw, 1.55rem);
  border-radius: 32px;
  background-color: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow:
    0 18px 40px -14px rgba(26, 53, 88, 0.1),
    0 6px 16px -6px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);

  @media (max-width: 620px) {
    border-radius: 24px;
    max-width: 100%;
  }
`;

const CardHeader = styled.div`
  text-align: center;
  margin-bottom: 0.75rem;
`;

const AvatarCircle = styled.div`
  width: 2.65rem;
  height: 2.65rem;
  margin: 0 auto 0.55rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: linear-gradient(145deg, #4a7c59 0%, #2f5a42 100%);
  color: #fff;
  box-shadow: 0 8px 22px -4px rgba(47, 90, 66, 0.45);
`;

const CardTitle = styled.h2`
  margin: 0 0 0.3rem;
  font-size: clamp(1.28rem, 2.2vw, 1.48rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #1a3558;
`;

const CardSubtitle = styled.p`
  margin: 0;
  font-size: clamp(0.94rem, 1.5vw, 1.02rem);
  line-height: 1.5;
  color: #556575;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.52rem 0.55rem;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
`;

const FullWidth = styled.div`
  grid-column: 1 / -1;
`;

const Field = styled.div`
  position: relative;
`;

const IconLeft = styled.span`
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3d6b8a;
  pointer-events: none;
  z-index: 1;
`;

const IconBtn = styled.button`
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3d6b8a;
  border-radius: 8px;

  &:hover {
    color: #1a3558;
    background: rgba(26, 53, 88, 0.06);
  }
`;

const inputBase = `
  width: 100%;
  font-size: 0.92rem;
  border: 1.5px solid rgba(216, 231, 248, 0.95);
  border-radius: 11px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  background: rgba(255, 255, 255, 0.98);
  color: #274c7b;
  font-weight: 500;

  &::placeholder {
    color: #94a3b8;
    font-weight: 400;
  }

  &:focus {
    border-color: #6eb58a;
    box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.14);
    background: #ffffff;
  }
`;

const Input = styled.input`
  ${inputBase}
  padding: 0.62rem 0.85rem 0.62rem 2.45rem;
`;

const InputWithToggle = styled(Input)`
  padding-right: 2.55rem;
`;

const TextAreaField = styled.textarea`
  ${inputBase}
  min-height: 2.85rem;
  padding: 0.62rem 0.85rem;
  font-family: inherit;
  line-height: 1.45;
  resize: vertical;
`;

const SubmitBtn = styled.button`
  width: 100%;
  margin-top: 0.15rem;
  padding: 0.72rem 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: linear-gradient(180deg, #4a7c59 0%, #2f5a42 48%, #264a38 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 4px 14px rgba(38, 74, 56, 0.32);
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.05);
    transform: translateY(-2px);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.28),
      0 10px 28px rgba(47, 90, 66, 0.38);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const CardFooter = styled.p`
  margin: 0.65rem 0 0;
  text-align: center;
  font-size: 0.98rem;
  color: #5a6a7d;
`;

const SignInLink = styled(Link)`
  color: #2f7a4f;
  font-weight: 700;
  text-decoration: none;

  &:hover {
    color: #1f5c38;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const TrustRow = styled.p`
  margin: 0.4rem 0 0;
  text-align: center;
  font-size: 0.76rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #94a3b8;
`;

const ErrorBox = styled.div`
  grid-column: 1 / -1;
  margin-bottom: 0.15rem;
  padding: 0.65rem 0.85rem;
  font-size: 0.88rem;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
  border-radius: 10px;
`;

const PageFooter = styled.footer`
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  text-align: center;
  padding: 0.4rem 1rem 0.55rem;
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
  background: transparent;
`;

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

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 4h3l1.5 4-2 1.5a11 11 0 005 5L15 12.5l4 1.5v3A2 2 0 0117 19C10.4 19 5 13.6 5 7a2 2 0 012-3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AvatarUserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FeatureGlyph({ index }) {
  if (index === 0) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h16v4H4V6zM6 10v8h3v-8H6zm5 0v8h3v-8h-3zm5 0v8h3v-8h-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v10H4V6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 18h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

export default function CustomerSignUpPage() {
  const { register, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);
  const { otpOpen, otpEmail, dismissOtpGate, completeOtpGate, handleRegisterResponse } = useSignupOtpFlow();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "SewServe | Customer sign up";
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await register({
        role: "customer",
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        password,
      });
      if (handleRegisterResponse(data, email)) return;
      const from = location?.state?.from;
      navigate(customerPostAuthPath(data, from), { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page>
      <PageBackdrop aria-hidden />
      <PageOverlay aria-hidden />
      <SplitLayout>
        <HeroPanel>
          <HeroOverlay aria-hidden />
          <HeroInner>
            <BrandLogoLink to="/" aria-label="SewServe — Home">
              <BrandLogoImg src={logoDisplaySrc} alt="SewServe" />
            </BrandLogoLink>

            <BrandHeading>Smart Tailoring Made Simple</BrandHeading>
            <BrandSubtitle>
              Find nearby tailors, save measurements, track orders, and chat in real time.
            </BrandSubtitle>

            <FeatureList>
              {FEATURES.map((item, index) => (
                <FeatureCard key={item.title}>
                  <FeatureIcon>
                    <FeatureGlyph index={index} />
                  </FeatureIcon>
                  <div>
                    <FeatureTitle>{item.title}</FeatureTitle>
                    <FeatureDesc>{item.desc}</FeatureDesc>
                  </div>
                </FeatureCard>
              ))}
            </FeatureList>
          </HeroInner>
        </HeroPanel>

        <FormPanel>
          <Card>
            <CardHeader>
              <AvatarCircle aria-hidden>
                <AvatarUserIcon />
              </AvatarCircle>
              <CardTitle>Create your customer account</CardTitle>
              <CardSubtitle>Fill in your details to get started</CardSubtitle>
            </CardHeader>

            <form onSubmit={handleSubmit} noValidate>
              <FormGrid>
                {error ? <ErrorBox role="alert">{error}</ErrorBox> : null}

                <Field>
                  <IconLeft>
                    <UserIcon />
                  </IconLeft>
                  <Input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Full name"
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    required
                  />
                </Field>

                <Field>
                  <IconLeft>
                    <PhoneIcon />
                  </IconLeft>
                  <Input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    placeholder="Phone number"
                    value={phone}
                    onChange={(ev) => setPhone(ev.target.value)}
                    required
                  />
                </Field>

                <FullWidth>
                  <Field>
                    <IconLeft>
                      <MailIcon />
                    </IconLeft>
                    <Input
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      required
                    />
                  </Field>
                </FullWidth>

                <FullWidth>
                  <Field>
                    <TextAreaField
                      name="address"
                      autoComplete="street-address"
                      placeholder="Address"
                      rows={2}
                      value={address}
                      onChange={(ev) => setAddress(ev.target.value)}
                      required
                    />
                  </Field>
                </FullWidth>

                <FullWidth>
                  <Field>
                    <IconLeft>
                      <LockIcon />
                    </IconLeft>
                    <InputWithToggle
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="new-password"
                      placeholder="Password"
                      value={password}
                      onChange={(ev) => setPassword(ev.target.value)}
                      required
                    />
                    <IconBtn
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon passwordVisible={showPassword} />
                    </IconBtn>
                  </Field>
                </FullWidth>

                <FullWidth>
                  <Field>
                    <IconLeft>
                      <LockIcon />
                    </IconLeft>
                    <InputWithToggle
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      autoComplete="new-password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(ev) => setConfirmPassword(ev.target.value)}
                      required
                    />
                    <IconBtn
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      <EyeIcon passwordVisible={showConfirmPassword} />
                    </IconBtn>
                  </Field>
                </FullWidth>

                <FullWidth>
                  <SubmitBtn type="submit" disabled={loading}>
                    {loading ? "Sending verification code…" : "Create Account"}
                  </SubmitBtn>
                </FullWidth>
              </FormGrid>
            </form>

            <CardFooter>
              Already have an account?{" "}
              <SignInLink to="/login" state={{ from: location?.state?.from }}>
                Sign in
              </SignInLink>
            </CardFooter>

            <TrustRow>Secure &amp; Private · Trusted Tailors · 24/7 Support</TrustRow>
          </Card>
        </FormPanel>
      </SplitLayout>

      <PageFooter>Fast · Reliable · Professional Tailoring Platform</PageFooter>

      {otpOpen ? (
        <EmailOtpGate
          email={otpEmail}
          onDismiss={dismissOtpGate}
          onVerified={async (verifyResult) => {
            await refreshUser();
            completeOtpGate();
            const from = location?.state?.from;
            navigate(customerPostAuthPath(verifyResult, from), { replace: true });
          }}
        />
      ) : null}
    </Page>
  );
}
