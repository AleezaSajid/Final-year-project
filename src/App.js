import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import SewServeLandingPage from "./SewServeLandingPage";
import OrderTrackingPage from "./OrderTrackingPage";
import OrdersPage from "./OrdersPage";
import LoginPage from "./LoginPage";
import TailorLoginPage from "./TailorLoginPage";
import SignUpPage from "./SignUpPage";
import TailorSignUpPage from "./TailorSignUpPage";
import TailorCompleteProfilePage from "./pages/TailorCompleteProfilePage.jsx";
import TailorDashboard from "./TailorDashboard";
import CustomerDashboard from "./CustomerDashboard";
import CustomerMessagesPage from "./pages/CustomerMessagesPage.jsx";
import TailorMessagesPage from "./pages/TailorMessagesPage.jsx";
import TailorOrdersPage from "./pages/TailorOrdersPage.jsx";
import LastReviewPage from "./LastReviewPage";
import CustomerReviewPage from "./CustomerReviewPage";
import MeasurementWizard from "./MeasurementWizard";
import OrderTracking from "./OrderTracking";
import WorkspaceSelect from "./WorkspaceSelect";
import EmpowerHer from "./pages/EmpowerHer";
import BrowseTailors from "./pages/BrowseTailors";
import TailorPublicProfile from "./pages/TailorPublicProfile";
import NearbyTailorsMap from "./pages/map/NearbyTailorsMap";
import LocationStep from "./LocationStep.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { RoleProvider } from "./context/RoleContext";
import { CustomerChatProvider } from "./context/CustomerChatContext.jsx";
import { TailorChatProvider } from "./context/TailorChatContext.jsx";
import { PageBackground } from "./components/PageBackground.jsx";
import PageTransition from "./components/PageTransition.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><SewServeLandingPage /></PageTransition>} />
        <Route path="/orders" element={<PageTransition><OrdersPage /></PageTransition>} />
        <Route path="/track-orders" element={<PageTransition><OrderTrackingPage /></PageTransition>} />
        <Route path="/select-workspace" element={<PageTransition><WorkspaceSelect /></PageTransition>} />
        <Route path="/workspace" element={<PageTransition><WorkspaceSelect /></PageTransition>} />
        <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
        <Route path="/tailor-login" element={<PageTransition><TailorLoginPage /></PageTransition>} />
        <Route path="/forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
        <Route path="/signup" element={<PageTransition><SignUpPage /></PageTransition>} />
        <Route path="/tailor-signup" element={<PageTransition><TailorSignUpPage /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><TailorDashboard /></PageTransition>} />
        <Route path="/profile" element={<Navigate to="/tailor/dashboard" replace />} />
        <Route
          path="/tailor/complete-profile"
          element={
            <PageTransition>
              <ProtectedRoute
                redirectPath="/tailor-login"
                allowedRoles={["tailor"]}
                tailorOnboardingGate="require-incomplete"
              >
                <TailorCompleteProfilePage />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route
          path="/tailor/dashboard"
          element={
            <PageTransition>
              <ProtectedRoute
                redirectPath="/tailor-login"
                allowedRoles={["tailor"]}
                tailorOnboardingGate="require-complete"
              >
                <TailorDashboard />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route path="/tailor-dashboard" element={<Navigate to="/tailor/dashboard" replace />} />
        <Route
          path="/customer/dashboard"
          element={
            <PageTransition>
              <ProtectedRoute redirectPath="/login" allowedRoles={["customer"]}>
                <CustomerDashboard />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route
          path="/customer/messages"
          element={
            <PageTransition>
              <ProtectedRoute redirectPath="/login" allowedRoles={["customer"]}>
                <CustomerMessagesPage />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route
          path="/tailor/messages"
          element={
            <PageTransition>
              <ProtectedRoute
                redirectPath="/tailor-login"
                allowedRoles={["tailor"]}
                tailorOnboardingGate="require-complete"
              >
                <TailorMessagesPage />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route
          path="/tailor/orders"
          element={
            <PageTransition>
              <ProtectedRoute
                redirectPath="/tailor-login"
                allowedRoles={["tailor"]}
                tailorOnboardingGate="require-complete"
              >
                <TailorOrdersPage />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route path="/tailor/last-review/:orderId" element={<PageTransition><LastReviewPage /></PageTransition>} />
        <Route path="/customer/review/:orderId" element={<PageTransition><CustomerReviewPage /></PageTransition>} />
        <Route
          path="/measurement-wizard"
          element={
            <PageTransition>
              <ProtectedRoute redirectPath="/login" allowedRoles={["customer"]}>
                <MeasurementWizard />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route
          path="/features/measurement-wizard"
          element={
            <PageTransition>
              <ProtectedRoute redirectPath="/login" allowedRoles={["customer"]}>
                <MeasurementWizard />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route path="/features/order-tracking" element={<PageTransition><OrderTracking /></PageTransition>} />
        <Route path="/tailors/:tailorId" element={<PageTransition><TailorPublicProfile /></PageTransition>} />
        <Route path="/browse-tailors" element={<PageTransition><BrowseTailors /></PageTransition>} />
        <Route path="/empower-her" element={<PageTransition><EmpowerHer /></PageTransition>} />
        <Route path="/for-women" element={<Navigate to="/empower-her" replace />} />
        <Route path="/map" element={<PageTransition><NearbyTailorsMap /></PageTransition>} />
        <Route path="/nearby-tailors" element={<Navigate to="/map" replace />} />
        <Route path="/location-step" element={<PageTransition><LocationStep /></PageTransition>} />
        <Route
          path="/measurements/new"
          element={
            <PageTransition>
              <ProtectedRoute redirectPath="/login" allowedRoles={["customer"]}>
                <MeasurementWizard />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route
          path="/measurements/style"
          element={
            <PageTransition>
              <div className="relative isolate flex min-h-screen items-center justify-center bg-transparent p-8 font-sans text-slate-600">
                <PageBackground />
                <span className="relative z-10">Style options — next step (placeholder)</span>
              </div>
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <RoleProvider>
      <Router>
      <ToastProvider>
        <CustomerChatProvider>
        <TailorChatProvider>
        <AnimatedRoutes />
        </TailorChatProvider>
        </CustomerChatProvider>
      </ToastProvider>
      </Router>
    </RoleProvider>
  );
}

export default App;