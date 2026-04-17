import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { publicApi, workerApi, formatApiError } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Slider } from "../components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Shield, Check, ArrowLeft, ArrowRight, Calculator, Loader2 } from "lucide-react";

export default function InsurancePlans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [calcIncome, setCalcIncome] = useState(700);
  const [calcPlan, setCalcPlan] = useState("level-2");
  const [calcSeverity, setCalcSeverity] = useState("medium");
  const [calcResult, setCalcResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    publicApi.plans().then(r => setPlans(r.data.plans)).catch(() => {});
  }, []);

  const handleSubscribe = async (planId) => {
    setError("");
    if (!user || user === false) {
      navigate("/register");
      return;
    }
    setSubscribing(planId);
    try {
      await workerApi.subscribe({ plan: planId });
      navigate("/dashboard");
    } catch (e) {
      setError(formatApiError(e.response?.data));
    }
    setSubscribing(null);
  };

  const handleCalc = async () => {
    setLoading(true);
    try {
      const { data } = await publicApi.payoutCalculator({ daily_income: calcIncome, plan: calcPlan, severity: calcSeverity, tenure_days: 180 });
      setCalcResult(data);
    } catch { /* pass */ }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] app-page-scale" data-testid="insurance-plans-page">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-emerald-600" />
          <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Outfit' }}>FleetLock</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-emerald-600 mb-3">Choose Your Protection</p>
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-[#022C22] mb-4" style={{ fontFamily: 'Outfit' }}>
            Insurance <span className="font-bold">Plans</span>
          </h1>
          <p className="text-base text-gray-500 max-w-xl mx-auto">
            Weekly premiums matched to gig worker income cycles. Coverage starts immediately.
          </p>
          {error && (
            <div className="mt-4 inline-flex bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16" data-testid="plans-grid">
          {plans.map((p) => (
            <div key={p.id} className={`bg-white rounded-xl p-8 ${p.recommended ? 'plan-recommended' : 'border border-gray-200'} card-hover`} data-testid={`plan-card-${p.id}`}>
              {p.recommended && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 mb-4 text-xs">Most Popular</Badge>
              )}
              <h2 className="text-2xl font-bold text-[#022C22] mb-1" style={{ fontFamily: 'Outfit' }}>{p.name}</h2>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Level {p.level}</p>
              <p className="text-sm text-gray-500 mb-6">{p.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-[#022C22]" style={{ fontFamily: 'Outfit' }}>Rs. {p.premium_weekly}</span>
                <span className="text-sm text-gray-400">/week</span>
                <p className="text-xs text-gray-400 mt-1">Auto-deducted every Monday from platform payout</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Coverage Rate</span><span className="font-bold text-[#022C22]">{p.coverage_rate * 100}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Max Covered Days</span><span className="font-bold text-[#022C22]">{p.max_covered_days} days</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Target</span><span className="text-[#022C22]">{p.target}</span></div>
              </div>

              <ul className="space-y-2 mb-8">
                {p.features?.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full ${p.recommended ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                onClick={() => handleSubscribe(p.id)}
                disabled={subscribing === p.id}
                data-testid={`subscribe-${p.id}`}
              >
                {subscribing === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Subscribe to {p.name}
              </Button>
            </div>
          ))}
        </div>

        {/* Payout Calculator */}
        <Card className="border-gray-200 shadow-sm max-w-2xl mx-auto" data-testid="payout-calculator">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
              <Calculator className="w-5 h-5 text-emerald-600" /> Payout Calculator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Daily Income: Rs. {calcIncome}</label>
                <Slider value={[calcIncome]} onValueChange={(v) => setCalcIncome(v[0])} min={300} max={1500} step={50} className="mt-2" data-testid="calc-income-slider" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Plan</label>
                  <Select value={calcPlan} onValueChange={setCalcPlan}>
                    <SelectTrigger data-testid="calc-plan-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="level-1">Level 1 (40%)</SelectItem>
                      <SelectItem value="level-2">Level 2 (60%)</SelectItem>
                      <SelectItem value="level-3">Level 3 (80%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Severity</label>
                  <Select value={calcSeverity} onValueChange={setCalcSeverity}>
                    <SelectTrigger data-testid="calc-severity-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (0.75x)</SelectItem>
                      <SelectItem value="medium">Medium (1.0x)</SelectItem>
                      <SelectItem value="high">High (1.25x)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCalc} disabled={loading} data-testid="calc-btn">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Calculate Payout
              </Button>
              {calcResult && (
                <div className="bg-emerald-50 rounded-xl p-6 space-y-3" data-testid="calc-result">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Estimated Payout</p>
                    <p className="text-4xl font-bold text-emerald-700 mt-1" style={{ fontFamily: 'Outfit' }}>Rs. {calcResult.final_payout?.toFixed(0)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Base Income</span><span>Rs. {calcResult.base_daily_income}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Coverage</span><span>{(calcResult.coverage_rate * 100).toFixed(0)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Severity</span><span>{calcResult.severity_multiplier}x</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Loyalty Bonus</span><span>+{(calcResult.loyalty_bonus_pct * 100).toFixed(0)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Audit Flag</span><span>{calcResult.audit_flag ? "Yes" : "No"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">AI Predicted</span><span>Rs. {calcResult.ai_predicted_payout?.toFixed(0)}</span></div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coverage Exclusions */}
        <div className="max-w-2xl mx-auto mt-16">
          <h3 className="text-xl font-bold text-[#022C22] mb-4" style={{ fontFamily: 'Outfit' }}>Coverage Exclusions</h3>
          <div className="space-y-3">
            {[
              "Health, life, and accident claims",
              "Vehicle and equipment damage",
              "Catastrophic systemic events (war, pandemic)",
              "Voluntary inactivity or personal leave",
              "Platform conduct suspensions",
              "Platform commercial policy changes",
            ].map((ex, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-gray-500">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {ex}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
