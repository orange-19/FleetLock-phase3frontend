import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Shield, ArrowLeft, Loader2 } from "lucide-react";

export default function AuthPage({ mode = "login" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(mode === "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "worker", phone: "", city: "", platform: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (isLogin) {
      const res = await login(form.email, form.password);
      if (res.success) {
        navigate(res.data.role === "admin" ? "/admin" : "/dashboard");
      } else {
        setError(res.error);
      }
    } else {
      const res = await register(form);
      if (res.success) {
        navigate(res.data.role === "admin" ? "/admin" : "/dashboard");
      } else {
        setError(res.error);
      }
    }
    setLoading(false);
  };

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-4" data-testid="auth-page">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 mb-8 transition-colors" data-testid="back-to-home">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Shield className="w-7 h-7 text-emerald-600" />
              <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Outfit' }}>FleetLock</span>
            </div>
            <CardTitle className="text-2xl" style={{ fontFamily: 'Outfit' }}>{isLogin ? "Welcome back" : "Create account"}</CardTitle>
            <CardDescription>{isLogin ? "Sign in to your account" : "Join FleetLock today"}</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4" data-testid="auth-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" data-testid="register-name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ravi Kumar" required />
                  </div>
                  <div>
                    <Label htmlFor="role">Account Type</Label>
                    <Select value={form.role} onValueChange={(v) => update("role", v)}>
                      <SelectTrigger data-testid="register-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="worker">Delivery Worker</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" data-testid="auth-email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="ravi@example.com" required />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" data-testid="auth-password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Enter password" required />
              </div>

              {!isLogin && form.role === "worker" && (
                <>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" data-testid="register-phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+91 9876543210" />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Select value={form.city} onValueChange={(v) => update("city", v)}>
                      <SelectTrigger data-testid="register-city">
                        <SelectValue placeholder="Select city" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Mumbai", "Chennai", "Bengaluru", "Hyderabad", "Delhi", "Pune", "Kolkata", "Ahmedabad"].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="platform">Platform</Label>
                    <Select value={form.platform} onValueChange={(v) => update("platform", v)}>
                      <SelectTrigger data-testid="register-platform">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Zomato", "Swiggy", "Blinkit", "Zepto", "Amazon", "Dunzo"].map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading} data-testid="auth-submit">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
                data-testid="auth-toggle"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
