import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { publicApi } from "../lib/api";
import { Shield, ChevronRight, Zap, TrendingUp, CloudRain, Users, Lock, BarChart3, ArrowRight, Check, Menu, X } from "lucide-react";

const HERO_IMG = "https://static.prod-images.emergentagent.com/jobs/18a26aff-e818-4e89-b6f8-37be1997a1f5/images/7009f239c57d3a84fe765ab9ecf090f36ba13ff036509fdd5806a61c59ae8514.png";
const LOGO_IMG = "https://static.prod-images.emergentagent.com/jobs/18a26aff-e818-4e89-b6f8-37be1997a1f5/images/6165b836f96ac14ef93cf840e7bb887300ced62a71761eb48581f4adc978bed5.png";

const stats = [
  { label: "Gig Workers in India", value: "12M+" },
  { label: "Avg Daily Income", value: "Rs. 600" },
  { label: "Claim Processing", value: "<4 hrs" },
  { label: "Fraud Detection", value: "99.5%" },
];

const features = [
  { icon: Zap, title: "Parametric Triggers", desc: "Claims auto-trigger from weather APIs, platform data, and verified earnings drops. No manual filing needed." },
  { icon: TrendingUp, title: "Earnings Floor Protection", desc: "We protect your actual income baseline, not a flat rate. Your 60-day trimmed mean earnings are your safety net." },
  { icon: CloudRain, title: "Real-time Weather Integration", desc: "OpenWeatherMap and IMD data feeds trigger claims when rainfall, AQI, or temperature cross thresholds." },
  { icon: Lock, title: "Anti-Fraud ML Engine", desc: "XGBoost + Random Forest ensemble with GPS, device, and behavioral signals. 99.5% detection rate." },
  { icon: Users, title: "Built for Gig Workers", desc: "Weekly premiums from Rs. 29/week. Auto-deducted from platform payout. UPI payouts within 4 hours." },
  { icon: BarChart3, title: "ML-Powered Insights", desc: "Fraud scoring, disruption severity classification, and payout audit — all powered by trained models." },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    publicApi.plans().then(r => setPlans(r.data.plans)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF9] app-page-scale" data-testid="landing-page">
      {/* Nav */}
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 px-6 lg:px-12" data-testid="landing-nav">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={LOGO_IMG} alt="FleetLock" className="w-8 h-8 rounded" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Outfit' }}>FleetLock</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Features</a>
            <a href="#plans" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Plans</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">How It Works</a>
            {user && user.role ? (
              <Button onClick={() => navigate(user.role === "admin" ? "/admin" : "/dashboard")} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="nav-dashboard-btn">
                Dashboard <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => navigate("/login")} data-testid="nav-login-btn">Sign In</Button>
                <Button onClick={() => navigate("/register")} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="nav-register-btn">Get Started</Button>
              </div>
            )}
          </div>
          <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-white border-t py-4 px-6 space-y-3">
            <a href="#features" className="block text-sm text-gray-600" onClick={() => setMobileMenu(false)}>Features</a>
            <a href="#plans" className="block text-sm text-gray-600" onClick={() => setMobileMenu(false)}>Plans</a>
            <Button onClick={() => { navigate("/login"); setMobileMenu(false); }} className="w-full bg-emerald-600 text-white">Sign In</Button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center pt-16" data-testid="hero-section">
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 hero-gradient" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-20">
          <div className="max-w-2xl">
            <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 mb-6 text-xs tracking-[0.15em] uppercase font-bold">
              AI-Powered Parametric Insurance
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-white tracking-tight leading-[1.1] mb-6" style={{ fontFamily: 'Outfit' }}>
              Lock in your <span className="font-bold text-emerald-400">earnings floor</span>
            </h1>
            <p className="text-base lg:text-lg text-gray-200 leading-relaxed mb-8 max-w-xl">
              When monsoons, curfews, or platform outages kill your income — FleetLock pays you automatically. No claims to file. No paperwork. Just protection.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={() => navigate("/register")} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 rounded-full" data-testid="hero-cta">
                Start Protection <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/plans")} className="border-white/30 text-white hover:bg-white/10 rounded-full" data-testid="hero-plans-btn">
                View Plans
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Ribbon */}
      <section className="bg-white border-y border-gray-100 py-6 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl lg:text-3xl font-bold text-[#022C22] tracking-tight" style={{ fontFamily: 'Outfit' }}>{s.value}</div>
                <div className="text-xs text-gray-500 tracking-[0.1em] uppercase mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28 px-6 lg:px-12" data-testid="features-section">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-emerald-600 mb-3">Why FleetLock</p>
            <h2 className="text-3xl lg:text-4xl font-medium tracking-tight text-[#022C22] mb-4" style={{ fontFamily: 'Outfit' }}>
              Insurance that works like <br />the gig economy works
            </h2>
            <p className="text-base text-gray-500 leading-relaxed">
              Traditional insurance takes weeks to process claims. FleetLock uses real-time data to protect you in hours.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 card-hover" data-testid={`feature-card-${i}`}>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-[#022C22] mb-2" style={{ fontFamily: 'Outfit' }}>{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-white border-y border-gray-100 px-6 lg:px-12" data-testid="how-it-works-section">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-emerald-600 mb-3">Process</p>
            <h2 className="text-3xl lg:text-4xl font-medium tracking-tight text-[#022C22]" style={{ fontFamily: 'Outfit' }}>How FleetLock Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Subscribe", desc: "Choose a plan starting at Rs. 29/week. Auto-deducted every Monday." },
              { step: "02", title: "We Monitor", desc: "Our ML models track weather, platform outages, and your earnings in real-time." },
              { step: "03", title: "Auto-Trigger", desc: "When a disruption is detected, claims are created automatically — zero paperwork." },
              { step: "04", title: "Get Paid", desc: "Verified payouts disbursed to your UPI within 4 hours." },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-bold text-lg flex items-center justify-center mx-auto mb-4" style={{ fontFamily: 'JetBrains Mono' }}>
                  {s.step}
                </div>
                <h3 className="font-semibold text-[#022C22] mb-2" style={{ fontFamily: 'Outfit' }}>{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Preview */}
      <section id="plans" className="py-20 lg:py-28 px-6 lg:px-12" data-testid="plans-section">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.2em] uppercase font-bold text-emerald-600 mb-3">Pricing</p>
            <h2 className="text-3xl lg:text-4xl font-medium tracking-tight text-[#022C22]" style={{ fontFamily: 'Outfit' }}>Simple, transparent plans</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((p) => (
              <div key={p.id} className={`bg-white rounded-xl p-6 ${p.recommended ? 'plan-recommended' : 'border border-gray-200'}`} data-testid={`plan-${p.id}`}>
                {p.recommended && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 mb-4 text-xs">Recommended</Badge>
                )}
                <h3 className="text-xl font-bold text-[#022C22] mb-1" style={{ fontFamily: 'Outfit' }}>{p.name}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Level {p.level} &middot; {p.target}</p>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-[#022C22]" style={{ fontFamily: 'Outfit' }}>Rs. {p.premium_weekly}</span>
                  <span className="text-sm text-gray-400">/week</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${p.recommended ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                  onClick={() => navigate("/register")}
                  data-testid={`plan-${p.id}-cta`}
                >
                  Get {p.name}
                </Button>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button variant="link" onClick={() => navigate("/plans")} className="text-emerald-600" data-testid="view-all-plans">
              View detailed plan comparison <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 bg-[#022C22] text-white px-6 lg:px-12" data-testid="cta-section">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-emerald-400 mb-3">Get Started Today</p>
          <h2 className="text-3xl lg:text-4xl font-medium tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>Ready to protect your earnings?</h2>
          <p className="text-gray-400 text-base max-w-xl mx-auto mb-8">
            Join thousands of delivery partners who never worry about missed income from disruptions they can't control.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/register")} className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 rounded-full" data-testid="cta-register">
              Create Free Account <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/plans")} className="border-white/30 text-white hover:bg-white/10 rounded-full" data-testid="cta-plans">
              Compare Plans
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12 px-6 lg:px-12" data-testid="footer">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <span className="font-bold" style={{ fontFamily: 'Outfit' }}>FleetLock</span>
            <span className="text-sm text-gray-400 ml-2">Parametric Income Insurance</span>
          </div>
          <p className="text-sm text-gray-400">Guidewire DEVTrails 2026 &middot; University Hackathon</p>
        </div>
      </footer>
    </div>
  );
}
