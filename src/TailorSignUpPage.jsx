import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

import tailorSignupBg from "./assets/images/tailorsignup.png";
import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import EmailOtpGate from "./components/EmailOtpGate.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useSignupOtpFlow } from "./hooks/useSignupOtpFlow.js";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";
import { setUserRole } from "./utils/userRole";
import { tailorPostAuthPath } from "./utils/tailorOnboarding.js";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const FEATURES = [
  { title: "Secure & Private", desc: "Your data and orders stay protected." },
  { title: "Trusted Platform", desc: "Connect with customers you can rely on." },
  { title: "24/7 Support", desc: "Help is here whenever you need it." },
];

/** Full-page shell — soft pastel base like landing hero */
const Page = styled.div`
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  color: #1a3558;
  background: linear-gradient(180deg, #eef2f7 0%, #e8f0f8 40%, #f4f7fb 72%, #f8fafc 100%);
  overflow: hidden;
`;

/** Studio photo — left ~62% of viewport, fades into right background */
const HeroImageLayer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 62.5%;
  height: 100%;
  z-index: 1;
  background-image: url(${tailorSignupBg});
  background-size: cover;
  background-position: left center;
  background-repeat: no-repeat;
  -webkit-mask-image: linear-gradient(
    90deg,
    #000 0%,
    #000 52%,
    rgba(0, 0, 0, 0.92) 58%,
    rgba(0, 0, 0, 0.55) 72%,
    rgba(0, 0, 0, 0.12) 86%,
    transparent 95%
  );
  mask-image: linear-gradient(
    90deg,
    #000 0%,
    #000 52%,
    rgba(0, 0, 0, 0.92) 58%,
    rgba(0, 0, 0, 0.55) 72%,
    rgba(0, 0, 0, 0.12) 86%,
    transparent 95%
  );

  @media (max-width: 980px) {
    width: 100%;
    height: min(52vh, 28rem);
    -webkit-mask-image: linear-gradient(
      180deg,
      #000 0%,
      #000 70%,
      rgba(0, 0, 0, 0.4) 88%,
      transparent 100%
    );
    mask-image: linear-gradient(
      180deg,
      #000 0%,
      #000 70%,
      rgba(0, 0, 0, 0.4) 88%,
      transparent 100%
    );
  }
`;

/** Layered homepage-style glows — blend with image, no heavy fog */
const PageGradients = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(ellipse 75% 58% at 8% 6%, rgba(210, 240, 226, 0.38) 0%, transparent 55%),
    radial-gradient(ellipse 60% 55% at 40% 42%, rgba(232, 243, 248, 0.32) 0%, transparent 62%),
    radial-gradient(ellipse 70% 48% at 6% 94%, rgba(244, 235, 220, 0.2) 0%, transparent 55%),
    linear-gradient(
      90deg,
      transparent 0%,
      transparent 58%,
      rgba(241, 245, 249, 0.45) 70%,
      rgba(248, 250, 252, 0.85) 82%,
      #f8fafc 100%
    );
`;

const MainGrid = styled.div`
  position: relative;
  z-index: 10;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  min-height: 100vh;
  min-height: 100dvh;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    min-height: 0;
  }
`;

/** Left hero stage — absolute placement for logo, copy, trust bar */
const HeroStage = styled.aside`
  position: relative;
  min-height: min(100vh, 100dvh);

  @media (max-width: 980px) {
    min-height: auto;
    padding: 0 0 1rem;
  }
`;

/** Logo + headline — upper-center of left hero (between corner and signup card) */
const HeroCopyStack = styled.div`
  position: absolute;
  top: clamp(1.75rem, 5.5vh, 3rem);
  left: clamp(11.5rem, 36vw, 20rem);
  z-index: 3;
  width: min(28rem, calc(62.5vw - 22rem));
  max-width: 28rem;
  text-align: left;

  @media (max-width: 980px) {
    position: relative;
    top: auto;
    left: auto;
    transform: none;
    width: auto;
    max-width: 100%;
    padding: 1.15rem 1.15rem 0;
  }
`;

const BrandLogoLink = styled(Link)`
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
  margin-bottom: clamp(0.85rem, 2vh, 1.15rem);
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
  margin: 0 0 0.5rem;
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(1.85rem, 2.8vw, 2.65rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #142d4a;
  text-shadow:
    0 1px 16px rgba(255, 255, 255, 0.5),
    0 1px 3px rgba(255, 255, 255, 0.35);
`;

const HeadingDecor = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: min(100%, 11.5rem);
  margin: 0 0 0.7rem;
  color: #4a7c59;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 0;
    border-top: 1.5px dashed rgba(74, 124, 89, 0.42);
  }
`;

const BrandSubtitle = styled.p`
  margin: 0;
  font-size: clamp(0.92rem, 1.35vw, 1.04rem);
  line-height: 1.55;
  color: #2d4058;
  max-width: 28rem;
  text-shadow:
    0 1px 12px rgba(255, 255, 255, 0.45),
    0 1px 2px rgba(255, 255, 255, 0.28);
`;

/** Single horizontal glass trust bar — mockup style */
const TrustBar = styled.div`
  position: absolute;
  bottom: clamp(3.25rem, 8.5vh, 5rem);
  left: clamp(1.35rem, 4.2vw, 3.25rem);
  z-index: 3;
  display: flex;
  align-items: stretch;
  width: min(calc(62.5vw - 3.5rem), 36rem);
  max-width: calc(100% - 2.5rem);
  min-height: 4.25rem;
  padding: 0.72rem 0.65rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: linear-gradient(
    165deg,
    rgba(255, 255, 255, 0.58) 0%,
    rgba(255, 255, 255, 0.4) 100%
  );
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow:
    0 4px 18px -6px rgba(26, 53, 88, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);

  @media (max-width: 980px) {
    position: relative;
    bottom: auto;
    left: auto;
    width: auto;
    max-width: none;
    margin: 0.65rem 1.15rem 0;
    flex-direction: column;
    gap: 0.35rem;
    min-height: auto;
    padding: 0.7rem 0.75rem;
  }
`;

const TrustItem = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.15rem 0.5rem;
  min-width: 0;

  &:not(:last-child) {
    border-right: 1px solid rgba(255, 255, 255, 0.55);
  }

  @media (max-width: 980px) {
    padding: 0.15rem 0;
    border-right: none !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.45);

    &:last-child {
      border-bottom: none;
    }
  }
`;

const TrustIcon = styled.span`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  color: #3d6b4a;
`;

const TrustCopy = styled.div`
  min-width: 0;
`;

const TrustTitle = styled.p`
  margin: 0 0 0.12rem;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.25;
  color: #142d4a;
`;

const TrustDesc = styled.p`
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.35;
  color: #4a5d70;
`;

const FormColumn = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(0.85rem, 1.6vw, 1.25rem) clamp(1rem, 2.2vw, 1.75rem);

  @media (max-width: 980px) {
    padding: 0.5rem 1rem 1.25rem;
  }
`;

const signupCardFloat = keyframes`
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
`;

const Card = styled.div`
  width: 100%;
  max-width: 420px;
  padding: clamp(1rem, 1.7vw, 1.25rem) clamp(1.15rem, 1.9vw, 1.45rem);
  border-radius: 32px;
  background-color: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow:
    0 20px 44px -20px rgba(26, 53, 88, 0.09),
    0 6px 18px -8px rgba(15, 23, 42, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  animation: ${signupCardFloat} 7.5s ease-in-out infinite;
  will-change: transform;

  @media (max-width: 620px) {
    border-radius: 24px;
    max-width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CardHeader = styled.div`
  text-align: center;
  margin-bottom: 0.55rem;
`;

const AvatarCircle = styled.div`
  width: 2.65rem;
  height: 2.65rem;
  margin: 0 auto 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: linear-gradient(145deg, #4a7c59 0%, #2f5a42 100%);
  color: #fff;
`;

const CardTitle = styled.h2`
  margin: 0 0 0.2rem;
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(1.22rem, 2vw, 1.4rem);
  font-weight: 700;
  color: #1a3558;
`;

const CardSubtitle = styled.p`
  margin: 0;
  font-size: 0.94rem;
  color: #556575;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem 0.48rem;
  @media (max-width: 620px) {
    grid-template-columns: 1fr;
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
  background: rgba(255, 255, 255, 0.98);
  color: #274c7b;
  font-weight: 500;
  &:focus {
    border-color: #6eb58a;
    box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.14);
    background: #fff;
  }
`;

const Input = styled.input`
  ${inputBase}
  padding: 0.6rem 0.82rem 0.6rem 2.42rem;
`;

const InputPlain = styled.input`
  ${inputBase}
  padding: 0.6rem 0.82rem;
`;

const InputWithToggle = styled(Input)`
  padding-right: 2.5rem;
`;

const SubmitBtn = styled.button`
  width: 100%;
  margin-top: 0.1rem;
  padding: 0.7rem 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: linear-gradient(180deg, #4a7c59 0%, #355542 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 4px 12px rgba(47, 90, 66, 0.28);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.24),
      0 8px 22px rgba(47, 90, 66, 0.32);
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
  font-size: 0.95rem;
  color: #5a6a7d;
`;

const SignInLink = styled(Link)`
  color: #2f7a4f;
  font-weight: 700;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const ErrorBox = styled.div`
  grid-column: 1 / -1;
  margin-bottom: 0.1rem;
  padding: 0.6rem 0.8rem;
  font-size: 0.88rem;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
  border-radius: 10px;
`;

const PageFooter = styled.footer`
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  text-align: center;
  padding: 0.4rem 1rem 0.55rem;
  font-size: 0.8rem;
  color: #64748b;
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

function ScissorDecorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 8.5L20 4M8.5 15.5L20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FeatureGlyph({ index }) {
  if (index === 0) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3l7 4v5c0 4.2-3.1 7.9-7 9-3.9-1.1-7-4.8-7-9V7l7-4z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="9.5" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11a8 8 0 0116 0M12 11v6M9 20h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
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

export default function TailorSignUpPage() {
  const { register, refreshUser } = useAuth();
  const navigate = useNavigate();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);
  const { otpOpen, otpEmail, dismissOtpGate, completeOtpGate, handleRegisterResponse } = useSignupOtpFlow();
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "SewServe | Tailor sign up";
  }, []);

  function finishTailorAuth(user) {
    setUserRole("tailor");
    navigate(tailorPostAuthPath(user), { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!shopName.trim() || !city.trim() || !specialty.trim()) {
      setError("Shop name, city, and specialty are required.");
      return;
    }
    setLoading(true);
    try {
      const data = await register({
        role: "tailor",
        name: name.trim(),
        shopName: shopName.trim(),
        city: city.trim(),
        specialty: specialty.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: city.trim(),
        password,
        lat: 0,
        lng: 0,
        locationStatus: "pending",
        profileComplete: false,
        published: false,
      });
      if (handleRegisterResponse(data, email)) return;
      finishTailorAuth(data?.user);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page>
      <LandingStylePageBackground />
      <HeroImageLayer aria-hidden />
      <PageGradients aria-hidden />
      <MainGrid>
        <HeroStage>
          <HeroCopyStack>
            <BrandLogoLink to="/" aria-label="SewServe — Home">
              <BrandLogoImg src={logoDisplaySrc} alt="SewServe" />
            </BrandLogoLink>
            <BrandHeading>
              Join SewServe
              <br />
              Grow Your Tailoring
              <br />
              Business
            </BrandHeading>
            <HeadingDecor aria-hidden>
              <ScissorDecorIcon />
            </HeadingDecor>
            <BrandSubtitle>
              Create your tailor account and start connecting with customers near you.
            </BrandSubtitle>
          </HeroCopyStack>

          <TrustBar>
            {FEATURES.map((item, index) => (
              <TrustItem key={item.title}>
                <TrustIcon>
                  <FeatureGlyph index={index} />
                </TrustIcon>
                <TrustCopy>
                  <TrustTitle>{item.title}</TrustTitle>
                  <TrustDesc>{item.desc}</TrustDesc>
                </TrustCopy>
              </TrustItem>
            ))}
          </TrustBar>
        </HeroStage>

        <FormColumn>
          <Card>
            <CardHeader>
              <AvatarCircle aria-hidden>
                <AvatarUserIcon />
              </AvatarCircle>
              <CardTitle>Tailor Sign Up</CardTitle>
              <CardSubtitle>Create your account to get started</CardSubtitle>
            </CardHeader>

            <form onSubmit={handleSubmit} noValidate>
              <FormGrid>
                {error ? <ErrorBox role="alert">{error}</ErrorBox> : null}

                <FullWidth>
                  <Field>
                    <InputPlain type="text" name="name" autoComplete="name" placeholder="Full name" value={name} onChange={(ev) => setName(ev.target.value)} required />
                  </Field>
                </FullWidth>

                <FullWidth>
                  <Field>
                    <InputPlain type="text" name="shopName" autoComplete="organization" placeholder="Shop / business name" value={shopName} onChange={(ev) => setShopName(ev.target.value)} required />
                  </Field>
                </FullWidth>

                <Field>
                  <InputPlain type="text" name="city" autoComplete="address-level2" placeholder="City" value={city} onChange={(ev) => setCity(ev.target.value)} required />
                </Field>

                <Field>
                  <InputPlain type="text" name="specialty" autoComplete="off" placeholder="Main specialty" value={specialty} onChange={(ev) => setSpecialty(ev.target.value)} required />
                </Field>

                <Field>
                  <IconLeft>
                    <PhoneIcon />
                  </IconLeft>
                  <Input type="tel" name="phone" autoComplete="tel" placeholder="Phone number" value={phone} onChange={(ev) => setPhone(ev.target.value)} required />
                </Field>

                <Field>
                  <IconLeft>
                    <MailIcon />
                  </IconLeft>
                  <Input type="email" name="email" autoComplete="email" placeholder="Email address" value={email} onChange={(ev) => setEmail(ev.target.value)} required />
                </Field>

                <FullWidth>
                  <Field>
                    <IconLeft>
                      <LockIcon />
                    </IconLeft>
                    <InputWithToggle type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" placeholder="Password" value={password} onChange={(ev) => setPassword(ev.target.value)} required />
                    <IconBtn type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      <EyeIcon passwordVisible={showPassword} />
                    </IconBtn>
                  </Field>
                </FullWidth>

                <FullWidth>
                  <Field>
                    <IconLeft>
                      <LockIcon />
                    </IconLeft>
                    <InputWithToggle type={showConfirmPassword ? "text" : "password"} name="confirmPassword" autoComplete="new-password" placeholder="Confirm password" value={confirmPassword} onChange={(ev) => setConfirmPassword(ev.target.value)} required />
                    <IconBtn type="button" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
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
              Already have an account? <SignInLink to="/tailor-login">Sign in</SignInLink>
            </CardFooter>
          </Card>
        </FormColumn>
      </MainGrid>

      <PageFooter>Fast · Reliable · Professional Tailoring Platform</PageFooter>

      {otpOpen ? (
        <EmailOtpGate
          email={otpEmail}
          onDismiss={dismissOtpGate}
          onVerified={async (verifyResult) => {
            await refreshUser();
            completeOtpGate();
            setUserRole("tailor");
            navigate(verifyResult?.redirectPath || "/tailor/complete-profile", { replace: true });
          }}
        />
      ) : null}
    </Page>
  );
}
