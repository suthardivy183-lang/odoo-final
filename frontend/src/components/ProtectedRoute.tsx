import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const hasToken = !!localStorage.getItem("token");

  if (!hasToken) return <Navigate to="/login" replace />;
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
