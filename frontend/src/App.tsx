import { Routes, Route, Navigate } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<div className="flex items-center justify-center h-screen text-2xl font-bold">Login — Coming Soon</div>} />
      <Route path="/dashboard" element={<div className="p-8 text-2xl font-bold">Dashboard — Coming Soon</div>} />
      <Route path="/products/*" element={<div className="p-8">Products — Coming Soon</div>} />
      <Route path="/sales/*" element={<div className="p-8">Sales Orders — Coming Soon</div>} />
      <Route path="/purchase/*" element={<div className="p-8">Purchase Orders — Coming Soon</div>} />
      <Route path="/manufacturing/*" element={<div className="p-8">Manufacturing — Coming Soon</div>} />
      <Route path="/bom/*" element={<div className="p-8">Bill of Materials — Coming Soon</div>} />
      <Route path="/audit-logs" element={<div className="p-8">Audit Logs — Coming Soon</div>} />
    </Routes>
  );
}
