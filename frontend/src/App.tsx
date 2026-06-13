import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/dashboard/Dashboard";
import Products from "@/pages/products/Products";
import WarehouseMapping from "@/pages/warehouse-mapping/WarehouseMapping";
import Sales from "@/pages/sales/Sales";
import Purchase from "@/pages/purchase/Purchase";
import Manufacturing from "@/pages/manufacturing/Manufacturing";
import Bom from "@/pages/bom/Bom";
import ActivityTimeline from "@/pages/audit-logs/AuditLogs";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/warehouse-mapping" element={<WarehouseMapping />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/manufacturing" element={<Manufacturing />} />
            <Route path="/bom" element={<Bom />} />
            <Route path="/audit-logs" element={<ActivityTimeline />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
