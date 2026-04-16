import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/sonner";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import WorkerDashboard from "./pages/WorkerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import InsurancePlans from "./pages/InsurancePlans";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );
  if (!user || user === false) return <Navigate to="/login" />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} />;
  }
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user && user.role ? <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user && user.role ? <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} /> : <AuthPage mode="register" />} />
      <Route path="/plans" element={<InsurancePlans />} />
      <Route path="/dashboard" element={<ProtectedRoute requiredRole="worker"><WorkerDashboard /></ProtectedRoute>} />
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
