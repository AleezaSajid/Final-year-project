import styled from "styled-components";

/** Same base gradient as the fixed page layer — reuse behind logos so they match the site background. */
export const PAGE_BACKGROUND_BASE_GRADIENT =
  "linear-gradient(175deg, #fcfeff 0%, #f6fbff 38%, #eaf4fd 68%, #ffffff 100%)";

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: ${PAGE_BACKGROUND_BASE_GRADIENT};
`;

const Blob = styled.div`
  position: absolute;
  border-radius: 50%;
  filter: blur(0px);
  opacity: ${(p) => p.$opacity ?? 0.55};
  background: ${(p) => p.$bg};
  width: ${(p) => p.$w};
  height: ${(p) => p.$h};
  top: ${(p) => p.$top};
  left: ${(p) => p.$left};
  transform: rotate(${(p) => p.$rotate ?? "0deg"});
`;

const Wave = styled.svg`
  position: absolute;
  width: 132%;
  min-width: 980px;
  height: auto;
  opacity: 0.28;
  left: -16%;
  bottom: -8%;
  color: #8fc9ef;
`;

const Wave2 = styled(Wave)`
  opacity: 0.2;
  bottom: -1%;
  left: -12%;
  color: #b7ddf6;
  transform: scaleX(-1);
`;

/** Layer 1: soft gradient + abstract wave shapes */
export function PageBackground() {
  return (
    <Layer aria-hidden="true">
      <Blob
        $bg="radial-gradient(circle at 30% 30%, rgba(213, 238, 252, 0.88), rgba(239, 248, 255, 0.15))"
        $w="min(85vw, 720px)"
        $h="min(85vw, 720px)"
        $top="-14%"
        $left="-14%"
        $rotate="-8deg"
      />
      <Blob
        $bg="radial-gradient(circle at 70% 40%, rgba(188, 223, 246, 0.8), rgba(245, 250, 255, 0))"
        $w="min(95vw, 880px)"
        $h="min(70vw, 560px)"
        $top="38%"
        $left="42%"
        $opacity={0.5}
        $rotate="12deg"
      />
      <Blob
        $bg="radial-gradient(circle at 50% 50%, rgba(192, 224, 243, 0.5), rgba(255, 255, 255, 0))"
        $w="min(70vw, 520px)"
        $h="min(70vw, 520px)"
        $top="8%"
        $left="55%"
        $opacity={0.35}
      />
      <Wave viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="currentColor"
          d="M0,160L60,154.7C120,149,240,139,360,154.7C480,171,600,213,720,213.3C840,213,960,171,1080,154.7C1200,139,1320,149,1380,154.7L1440,160L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
        />
      </Wave>
      <Wave2 viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="currentColor"
          d="M0,224L80,213.3C160,203,320,181,480,181.3C640,181,800,203,960,218.7C1120,235,1280,245,1360,250.7L1440,256L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
        />
      </Wave2>
    </Layer>
  );
}
