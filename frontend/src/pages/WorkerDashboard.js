import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { workerApi, formatApiError } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Shield, LogOut, TrendingUp, Wallet, FileCheck, Star, CloudRain, Zap, Check, Clock, XCircle, ArrowRight, Loader2 } from "lucide-react";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(5);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WorkerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimResult, setClaimResult] = useState(null);
  const [claimType, setClaimType] = useState("weather");

  const loadDashboard = useCallback(async () => {
    try {
      const { data: d } = await workerApi.dashboard();
      setData(d);
    } catch {
      // pass
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleClaim = async () => {
    setClaimLoading(true);
    setClaimResult(null);
    try {
      const { data: res } = await workerApi.createClaim({ disruption_type: claimType });
      setClaimResult(res);
      loadDashboard();
    } catch (e) {
      setClaimResult({ error: formatApiError(e.response?.data) || "Failed to create claim" });
    }
    setClaimLoading(false);
  };

  const handleLogout = async () => { await logout(); navigate("/"); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  const w = data?.worker || {};
  const loyalty = data?.loyalty || { loyalty_score: 0, loyalty_bonus: 1, breakdown: {} };
  const sub = data?.subscription;
  const earnings = (data?.earnings || []).slice(0, 14).reverse();
  const stats = data?.stats || {};

  const statusIcon = (s) => {
    if (s === "approved" || s === "paid") return <Check className="w-4 h-4 text-emerald-600" />;
    if (s === "pending") return <Clock className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9]" data-testid="worker-dashboard">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-emerald-600" />
          <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Outfit' }}>FleetLock</span>
          <Badge variant="secondary" className="ml-2 text-xs">Worker</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:inline">{user?.name || user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-btn">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: TrendingUp, label: "Avg Daily Earnings", value: `Rs. ${w.daily_income_avg?.toFixed(0) || 0}`, color: "text-emerald-600" },
            { icon: Wallet, label: "Total Payouts", value: `Rs. ${stats.total_payouts?.toFixed(0) || 0}`, color: "text-blue-600" },
            { icon: FileCheck, label: "Claims Filed", value: stats.total_claims || 0, color: "text-amber-600" },
            { icon: Star, label: "Loyalty Score", value: `${((loyalty.loyalty_score || 0) * 100).toFixed(0)}%`, color: "text-purple-600" },
          ].map((s, i) => (
            <Card key={i} className="stat-card border-gray-200 shadow-sm" data-testid={`stat-${i}`}>
              <CardContent className="p-4 pl-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
                    <p className="text-2xl font-bold text-[#022C22] mt-1" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
                  </div>
                  <s.icon className={`w-8 h-8 ${s.color} opacity-30`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Earnings Chart */}
            <Card className="border-gray-200 shadow-sm" data-testid="earnings-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Earnings (Last 14 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={earnings}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`Rs. ${Number(v || 0).toFixed(0)}`, "Earnings"]} />
                      <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Claims Tab */}
            <Card className="border-gray-200 shadow-sm" data-testid="claims-section">
              <Tabs defaultValue="claims">
                <CardHeader className="pb-0">
                  <TabsList>
                    <TabsTrigger value="claims">Claims History</TabsTrigger>
                    <TabsTrigger value="payouts">Payouts</TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="pt-4">
                  <TabsContent value="claims">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Fraud Score</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead className="text-right">Payout</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data?.claims || []).slice(0, 10).map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium capitalize">{c.disruption_type?.replace("_", " ")}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {statusIcon(c.status)}
                                <span className="capitalize text-sm">{c.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`text-sm font-mono ${c.fraud_score < 0.35 ? 'text-emerald-600' : c.fraud_score <= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                                {(c.fraud_score * 100).toFixed(0)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`capitalize ${c.severity === 'high' ? 'border-red-300 text-red-700' : c.severity === 'medium' ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700'}`}>
                                {c.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">Rs. {c.payout_amount?.toFixed(0) || 0}</TableCell>
                          </TableRow>
                        ))}
                        {(!data?.claims || data.claims.length === 0) && (
                          <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">No claims yet</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                  <TabsContent value="payouts">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data?.payouts || []).map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{formatDate(p.created_at)}</TableCell>
                            <TableCell className="capitalize">{p.plan}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{p.status?.replace("_", " ")}</Badge></TableCell>
                            <TableCell className="text-right font-mono font-medium">Rs. {p.amount?.toFixed(0)}</TableCell>
                          </TableRow>
                        ))}
                        {(!data?.payouts || data.payouts.length === 0) && (
                          <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">No payouts yet</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Active Plan */}
            <Card className="border-gray-200 shadow-sm" data-testid="active-plan">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                  <Shield className="w-4 h-4 text-emerald-600" /> Active Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sub ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold text-[#022C22] capitalize" style={{ fontFamily: 'Outfit' }}>{sub.plan}</span>
                      <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                    </div>
                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex justify-between"><span>Premium</span><span className="font-medium text-[#022C22]">Rs. {sub.premium_weekly}/week</span></div>
                      <div className="flex justify-between"><span>Coverage</span><span className="font-medium text-[#022C22]">{(sub.coverage_rate || 0.6) * 100}%</span></div>
                      <div className="flex justify-between"><span>Expires</span><span className="font-medium text-[#022C22]">{formatDate(sub.end_date)}</span></div>
                    </div>
                    <Button variant="outline" className="w-full mt-4 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => navigate("/plans")} data-testid="change-plan-btn">
                      Change Plan <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">No active subscription</p>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate("/plans")} data-testid="subscribe-btn">
                      Subscribe Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Loyalty Score */}
            <Card className="border-gray-200 shadow-sm" data-testid="loyalty-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                  <Star className="w-4 h-4 text-amber-500" /> Loyalty Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-[#022C22]" style={{ fontFamily: 'Outfit' }}>{((loyalty.loyalty_score || 0) * 100).toFixed(0)}</span>
                  <span className="text-lg text-gray-400">/100</span>
                </div>
                <Progress value={(loyalty.loyalty_score || 0) * 100} className="h-2 mb-4" />
                <div className="space-y-2">
                  {[
                    { label: "Active Days", value: loyalty.breakdown?.active_days_weight, weight: "40%" },
                    { label: "Renewal Streak", value: loyalty.breakdown?.renewal_streak_weight, weight: "30%" },
                    { label: "Claim Accuracy", value: loyalty.breakdown?.claim_accuracy_weight, weight: "20%" },
                    { label: "Platform Rating", value: loyalty.breakdown?.platform_rating_weight, weight: "10%" },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{b.label} ({b.weight})</span>
                      <span className="font-mono text-[#022C22]">{((b.value || 0) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Loyalty Bonus</p>
                  <p className="text-lg font-bold text-emerald-700">+{((loyalty.loyalty_bonus || 1) - 1) * 100}%</p>
                </div>
              </CardContent>
            </Card>

            {/* File Claim */}
            <Card className="border-gray-200 shadow-sm" data-testid="file-claim">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                  <Zap className="w-4 h-4 text-emerald-600" /> File a Claim
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Select value={claimType} onValueChange={setClaimType}>
                    <SelectTrigger data-testid="claim-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weather">Weather Disruption</SelectItem>
                      <SelectItem value="platform_outage">Platform Outage</SelectItem>
                      <SelectItem value="civic_event">Curfew / Bandh</SelectItem>
                      <SelectItem value="flood">Flood Alert</SelectItem>
                      <SelectItem value="heat">Extreme Heat</SelectItem>
                      <SelectItem value="aqi">Air Pollution</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleClaim} disabled={claimLoading || !sub} data-testid="submit-claim-btn">
                    {claimLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudRain className="w-4 h-4" />}
                    Submit Claim
                  </Button>
                  {!sub && <p className="text-xs text-amber-600 text-center">Subscribe to a plan first</p>}
                  {claimResult && !claimResult.error && (
                    <div className={`rounded-lg p-3 text-sm ${claimResult.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : claimResult.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`} data-testid="claim-result">
                      <p className="font-medium">{claimResult.message}</p>
                      {claimResult.payout_amount > 0 && <p className="mt-1">Payout: Rs. {claimResult.payout_amount.toFixed(0)}</p>}
                    </div>
                  )}
                  {claimResult?.error && (
                    <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm" data-testid="claim-error">
                      {typeof claimResult.error === 'string' ? claimResult.error : JSON.stringify(claimResult.error)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Worker Info */}
            <Card className="border-gray-200 shadow-sm" data-testid="worker-info">
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Zone</span><span className="font-medium">{w.zone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Platform</span><span className="font-medium">{w.platform}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">City</span><span className="font-medium">{w.city}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tenure</span><span className="font-medium">{w.tenure_days} days</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Rating</span><span className="font-medium">{w.platform_rating}/5.0</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
