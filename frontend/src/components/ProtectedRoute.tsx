import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ROLE_HOME: Record<string, string> = {
  administrator: "/admin/dashboard",
  editor: "/admin/content",
  author: "/admin/content",
  contributor: "/admin/content",
  seo_manager: "/admin/content",
  seo_editor: "/admin/content",
  web_designer: "/admin/appearance/page-builder",
  customer: "/my-account",
  subscriber: "/my-account",
};

const canAccessPath = (role: string, path: string): boolean => {
  if (role === "administrator") return true;
  if (path === "/admin/profile" || path.startsWith("/admin/profile/")) return true;

  if (path === "/admin/dashboard" || path === "/admin") return false;
  if (path.startsWith("/admin/users") || path.startsWith("/admin/settings")) return false;

  if (path.startsWith("/admin/products") || path.startsWith("/admin/orders")) {
    return role === "editor";
  }
  if (path.startsWith("/admin/media")) {
    return ["editor", "author", "web_designer"].includes(role);
  }
  if (path.startsWith("/admin/content")) {
    return ["editor", "author", "contributor", "seo_manager", "seo_editor", "web_designer"].includes(role);
  }
  if (path.startsWith("/admin/appearance")) {
    return role === "web_designer";
  }

  return false;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div role="status" aria-live="polite">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  const role = String(user.role || "subscriber").toLowerCase();

  if (role === "customer" || role === "subscriber") {
    return <Navigate to="/my-account" replace />;
  }

  if (!canAccessPath(role, location.pathname)) {
    return <Navigate to={ROLE_HOME[role] || "/admin/profile"} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;