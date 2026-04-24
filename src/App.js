import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SewServeLandingPage from "./SewServeLandingPage";
import OrderTrackingPage from "./OrderTrackingPage";
import LoginPage from "./LoginPage";
import TailorLoginPage from "./TailorLoginPage";
import SignUpPage from "./SignUpPage";
import TailorSignUpPage from "./TailorSignUpPage";
import TailorDashboard from "./TailorDashboard";
import CustomerDashboard from "./CustomerDashboard";
import TailorProfile from "./TailorProfile";
import LastReviewPage from "./LastReviewPage";
import CustomerReviewPage from "./CustomerReviewPage";
import MeasurementWizard from "./MeasurementWizard";
import OrderTracking from "./OrderTracking";
import LocalTailors from "./LocalTailors";
import WorkspaceSelect from "./WorkspaceSelect";
import { RoleProvider } from "./context/RoleContext";
import { CustomerChatProvider } from "./context/CustomerChatContext.jsx";
import { PageBackground } from "./components/PageBackground.jsx";

function App() {
  return (
    <RoleProvider>
      <Router>
      <CustomerChatProvider>
      <Routes>
        <Route path="/" element={<SewServeLandingPage />} />
        <Route path="/orders" element={<OrderTrackingPage />} />
        <Route path="/select-workspace" element={<WorkspaceSelect />} />
        <Route path="/workspace" element={<WorkspaceSelect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tailor-login" element={<TailorLoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/tailor-signup" element={<TailorSignUpPage />} />
        <Route path="/dashboard" element={<TailorDashboard />} />
        <Route path="/profile" element={<TailorProfile />} />
        <Route path="/tailor/dashboard" element={<TailorDashboard />} />
        <Route path="/tailor-dashboard" element={<Navigate to="/tailor/dashboard" replace />} />
        <Route path="/customer/dashboard" element={<CustomerDashboard />} />
        <Route path="/tailor/last-review/:orderId" element={<LastReviewPage />} />
        <Route path="/customer/review/:orderId" element={<CustomerReviewPage />} />
        <Route path="/features/measurement-wizard" element={<MeasurementWizard />} />
        <Route path="/features/order-tracking" element={<OrderTracking />} />
        <Route path="/features/local-tailors" element={<LocalTailors />} />
        <Route path="/measurements/new" element={<MeasurementWizard />} />
        <Route
          path="/measurements/style"
          element={
            <div className="relative isolate flex min-h-screen items-center justify-center bg-transparent p-8 font-sans text-slate-600">
              <PageBackground />
              <span className="relative z-10">Style options — next step (placeholder)</span>
            </div>
          }
        />
      </Routes>
      </CustomerChatProvider>
      </Router>
    </RoleProvider>
  );
}

export default App;