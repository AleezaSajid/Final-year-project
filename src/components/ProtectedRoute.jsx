import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "40vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#5a6578",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
