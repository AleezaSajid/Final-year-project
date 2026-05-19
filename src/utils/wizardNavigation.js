import { api } from "../api/client.js";
import { startWizardFresh } from "./measurementWizardOrderSync.js";

const WIZARD_PATH = "/features/measurement-wizard";

/**
 * Intentional new booking: clear draft state and open the wizard empty.
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {object | null} [knownUser]
 */
export async function openFreshMeasurementWizard(navigate, knownUser = null) {
  let user = knownUser;
  if (!user) {
    try {
      const data = await api("/api/auth/me");
      user = data?.user ?? null;
    } catch {
      user = null;
    }
  }
  const role = user?.role ? String(user.role).trim() : "";
  if (user && role === "customer") {
    startWizardFresh({ user });
    navigate(WIZARD_PATH, { state: { fresh: true } });
    return;
  }
  navigate("/login", { state: { from: WIZARD_PATH, fresh: true } });
}
