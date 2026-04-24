import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";

import { LandingStylePageBackground } from "./components/LandingStylePageBackground.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useSewServeLogoProcessedSrc } from "./hooks/useSewServeLogoProcessedSrc";
import { setUserRole } from "./utils/userRole";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/images/hero/sewserve-logo.png`;

const Page = styled.div`
  min-height: 100vh;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  position: relative;
  isolation: isolate;
  color: #1f3d66;
`;

const Main = styled.main`
  position: relative;
  z-index: 10;
  flex: 1;
  width: 100%;
  max-width: 1160px;
  margin: 0 auto;
  padding: 1.55rem 1rem 0.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const HeaderBlock = styled.header`
  text-align: center;
  margin-bottom: 1.15rem;
`;

const LogoRow = styled.div`
  margin-bottom: 0.6rem;
`;

const LogoHomeLink = styled(Link)`
  display: inline-block;
  line-height: 0;
  text-decoration: none;
  color: inherit;
`;

const HeaderLogoImg = styled.img`
  display: block;
  margin: 0 auto;
  max-height: 44px;
  width: auto;
  object-fit: contain;
  border: none;
  outline: none;
  background: transparent;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.18));
  transition: filter 0.25s ease, transform 0.25s ease;

  &:hover {
    transform: translateY(-2px) scale(1.02);
    filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.28));
  }
`;

const CardLogoImg = styled.img`
  display: block;
  margin: 0 auto;
  max-height: 36px;
  width: auto;
  object-fit: contain;
  border: none;
  outline: none;
  background: transparent;
  filter: drop-shadow(0 4px 12px rgba(26, 53, 88, 0.18));
  transition: filter 0.25s ease, transform 0.25s ease;

  &:hover {
    transform: scale(1.05);
    filter: drop-shadow(0 6px 16px rgba(26, 53, 88, 0.26));
  }
`;

const PageTitle = styled.h1`
  margin: 0 0 0.46rem;
  font-size: clamp(2.05rem, 3.4vw, 2.8rem);
  font-family: "Playfair Display", Georgia, serif;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #1a3558;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: clamp(0.95rem, 1.5vw, 1.05rem);
  color: #9ca3af;
  max-width: 32rem;
  line-height: 1.3;
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.9fr);
  gap: 1.15rem;
  align-items: center;
  width: 100%;
  max-width: 1080px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const ImageCol = styled.div`
  position: relative;
  border-radius: 0;
  border: none;
  outline: none;
  overflow: visible;
  box-shadow: none;
  aspect-ratio: 16 / 9;
  background: transparent;
  width: 76%;
  max-width: 520px;
  justify-self: start;

  @media (max-width: 980px) {
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
  }

  @media (max-width: 620px) {
    display: block;
    max-width: 100%;
    aspect-ratio: 16 / 9;
  }
`;

const HeroImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  display: block;
  filter: drop-shadow(0 20px 36px rgba(60, 95, 130, 0.24));
  -webkit-mask-image: linear-gradient(
      to right,
      transparent 0%,
      rgba(0, 0, 0, 0.95) 10%,
      rgba(0, 0, 0, 0.95) 82%,
      transparent 100%
    ),
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0, 0, 0, 0.96) 8%,
      rgba(0, 0, 0, 0.96) 90%,
      transparent 100%
    );
  -webkit-mask-composite: source-in;
  mask-image: linear-gradient(
      to right,
      transparent 0%,
      rgba(0, 0, 0, 0.95) 10%,
      rgba(0, 0, 0, 0.95) 82%,
      transparent 100%
    ),
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0, 0, 0, 0.96) 8%,
      rgba(0, 0, 0, 0.96) 90%,
      transparent 100%
    );
  mask-composite: intersect;
`;

const Card = styled.div.attrs({ className: "ss-auth-form-card" })`
  padding: 1.02rem 1rem 0.86rem;
  width: 100%;
  max-width: 412px;
  margin-left: auto;

  @media (max-width: 980px) {
    margin: 0 auto;
    max-width: 700px;
  }

  @media (max-width: 620px) {
    max-width: 100%;
    padding: 0.95rem 0.85rem 0.85rem;
  }
`;

const CardLogo = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 0.8rem;
`;

const Field = styled.div`
  position: relative;
  margin-bottom: 0.62rem;
`;

const IconLeft = styled.span`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2d507f;
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
  color: #2d507f;
  border-radius: 8px;

  &:hover {
    color: #1f2937;
    background: rgba(0, 0, 0, 0.04);
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.66rem 0.84rem 0.66rem 2.35rem;
  font-size: 0.99rem;
  border: 1.2px solid #d8e7f8;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: #ffffff;
  color: #274c7b;
  font-weight: 500;

  &:focus {
    border-color: #8ecfb0;
    box-shadow: 0 0 0 3px rgba(31, 168, 85, 0.12);
    background: #fff;
  }
`;

const InputWithToggle = styled(Input)`
  padding-right: 2.5rem;
`;

const ForgotRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.56rem;
`;

const TextLink = styled(Link)`
  font-size: 0.95rem;
  color: #4b5563;
  text-decoration: underline;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
`;

const SignInBtn = styled.button`
  width: 100%;
  padding: 0.68rem 1rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  background: linear-gradient(180deg, #4a7c59 0%, #355542 100%);
  box-shadow: inset 0 1px 0 rgba(184, 214, 194, 0.35), 0 2px 10px rgba(32, 58, 44, 0.3);
  transition: transform 0.12s, box-shadow 0.12s, filter 0.12s;

  &:hover:not(:disabled) {
    filter: brightness(1.06);
    box-shadow: 0 6px 20px rgba(31, 168, 85, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.35);
    transform: translateY(-1px);
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
  margin: 0.8rem 0 0.05rem;
  text-align: center;
  font-size: 0.98rem;
  color: #4b5563;
`;

const UnderlineLink = styled(Link)`
  color: #1a3558;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    color: #355542;
  }
`;

const ErrorBox = styled.div`
  margin-bottom: 1rem;
  padding: 0.65rem 0.85rem;
  font-size: 0.88rem;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
  border-radius: 10px;
`;

const PageFooter = styled.footer`
  text-align: center;
  padding: 0.7rem 1rem 0.95rem;
  font-size: 1rem;
  color: #4b5563;
  letter-spacing: 0;
  font-weight: 600;

  @media (max-width: 620px) {
    font-size: 0.88rem;
    padding: 0.45rem 0.8rem 0.7rem;
  }
`;

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16v12H4V6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 10V8a4 4 0 118 0v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Generic eye: no slash when password is hidden (click to reveal); slash when visible (click to hide). */
function EyeIcon({ passwordVisible }) {
  if (passwordVisible) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/** Hero art in the left column (public folder) */
const HERO_IMAGE = `${process.env.PUBLIC_URL || ""}/images/hero/sewing-side.png`;

export default function TailorLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const logoDisplaySrc = useSewServeLogoProcessedSrc(LOGO_SRC);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      setUserRole("tailor");
      navigate("/tailor/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page>
      <LandingStylePageBackground />
      <Main>
        <HeaderBlock>
          <LogoRow>
            <LogoHomeLink to="/" aria-label="SewServe — Home">
              <HeaderLogoImg src={logoDisplaySrc} alt="" />
            </LogoHomeLink>
          </LogoRow>
          <PageTitle>Tailor Account</PageTitle>
          <Subtitle>Sign in to manage orders and tailoring services.</Subtitle>
        </HeaderBlock>

        <TwoCol>
          <ImageCol>
            <HeroImg
              src={HERO_IMAGE}
              alt="Vintage sewing machine on a wooden table with thread spools and sewing accessories"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </ImageCol>

          <Card>
            <CardLogo>
              <LogoHomeLink to="/" aria-label="SewServe — Home">
                <CardLogoImg src={logoDisplaySrc} alt="" />
              </LogoHomeLink>
            </CardLogo>

            <form onSubmit={handleSubmit} noValidate>
              {error ? <ErrorBox role="alert">{error}</ErrorBox> : null}

              <Field>
                <IconLeft>
                  <MailIcon />
                </IconLeft>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <IconLeft>
                  <LockIcon />
                </IconLeft>
                <InputWithToggle
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              <ForgotRow>
                <TextLink to="/forgot-password">Forgot Password?</TextLink>
              </ForgotRow>

              <SignInBtn type="submit" disabled={loading}>
                {loading ? "Signing In…" : "Sign In"}
              </SignInBtn>
            </form>

            <CardFooter>
              Need an account? <UnderlineLink to="/tailor-signup">Register Now</UnderlineLink>
            </CardFooter>
          </Card>
        </TwoCol>
      </Main>

      <PageFooter>Fast • Reliable • Professional Tailoring Platform</PageFooter>
    </Page>
  );
}
