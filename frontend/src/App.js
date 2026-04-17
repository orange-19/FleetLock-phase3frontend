import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/sonner";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import WorkerDashboard from "./pages/WorkerDashboard";
import WorkerKycVerification from "./pages/WorkerKycVerification";
import AdminDashboard from "./pages/AdminDashboard";
import InsurancePlans from "./pages/InsurancePlans";
import { Loader2 } from "lucide-react";

function userDefaultRoute(user, kycVerified) {
  if (!user || user === false) return "/login";
  if (user.role === "admin") return "/admin";
  return kycVerified ? "/dashboard" : "/kyc-verification";
}

function ProtectedRoute({ children, requiredRole, allowUnverifiedWorker = false }) {
  const { user, loading, kycVerified } = useAuth();

  if (loading || (user?.role === "worker" && kycVerified === null)) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  if (!user || user === false) return <Navigate to="/login" />;

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={userDefaultRoute(user, kycVerified)} />;
  }

  if (user.role === "worker" && !allowUnverifiedWorker && !kycVerified) {
    return <Navigate to="/kyc-verification" />;
  }

  if (user.role === "worker" && allowUnverifiedWorker && kycVerified) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

function AppRoutes() {
  const { user, kycVerified } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user && user.role ? <Navigate to={userDefaultRoute(user, kycVerified)} /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user && user.role ? <Navigate to={userDefaultRoute(user, kycVerified)} /> : <AuthPage mode="register" />} />
      <Route path="/plans" element={<InsurancePlans />} />
      <Route path="/dashboard" element={<ProtectedRoute requiredRole="worker"><WorkerDashboard /></ProtectedRoute>} />
      <Route path="/kyc-verification" element={<ProtectedRoute requiredRole="worker" allowUnverifiedWorker><WorkerKycVerification /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
