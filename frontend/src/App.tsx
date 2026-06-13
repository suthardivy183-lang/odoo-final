import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { homePath } from "@/lib/permissions";
import Login from "@/pages/Login";
import Unauthorized from "@/pages/Unauthorized";
import Dashboard from "@/pages/dashboard/Dashboard";
import Products from "@/pages/products/Products";
import WarehouseMapping from "@/pages/warehouse-mapping/WarehouseMapping";
import DigitalTwin from "@/pages/digital-twin/DigitalTwin";
import Sales from "@/pages/sales/Sales";
import Purchase from "@/pages/purchase/Purchase";
import Manufacturing from "@/pages/manufacturing/Manufacturing";
import Bom from "@/pages/bom/Bom";
import ActivityTimeline from "@/pages/audit-logs/AuditLogs";

/** Sends the user to the landing route for their role (or login if signed out). */
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePath(user?.role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/warehouse-mapping" element={<WarehouseMapping />} />
            <Route path="/digital-twin" element={<DigitalTwin />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/manufacturing" element={<Manufacturing />} />
            <Route path="/bom" element={<Bom />} />
            <Route path="/audit-logs" element={<ActivityTimeline />} />
          </Route>
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </AuthProvider>
  );
}
