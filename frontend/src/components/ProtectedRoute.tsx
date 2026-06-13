import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  // Role-based route guard — also catches manually entered restricted URLs.
  if (!canAccess(user.role, location.pathname)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
