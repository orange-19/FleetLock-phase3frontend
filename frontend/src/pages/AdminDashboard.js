import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { adminApi, formatApiError } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Shield,
  LogOut,
  Users,
  FileCheck,
  Wallet,
  Brain,
  CloudRain,
  Loader2,
  Check,
  Clock,
  Zap,
  Thermometer,
  Wind,
  Droplets,
  RefreshCw,
  Activity,
} from "lucide-react";

const COLORS = ["#1f8a70", "#f59e0b", "#ef4444", "#2563eb", "#0ea5e9"];

const SECTIONS = {
  overview: "overview",
  claims: "claims",
  workers: "workers",
  weather: "weather",
  simulator: "simulator",
  ml: "ml",
};

const SECTION_META = [
  {
    key: SECTIONS.overview,
    title: "Overview",
    subtitle: "Portfolio and risk snapshot",
    icon: Activity,
  },
  {
    key: SECTIONS.claims,
    title: "Claims Desk",
    subtitle: "Review and adjudication",
    icon: FileCheck,
  },
  {
    key: SECTIONS.workers,
    title: "Workers",
    subtitle: "Enrollment and KYC coverage",
    icon: Users,
  },
  {
    key: SECTIONS.weather,
    title: "Weather",
    subtitle: "Zone-level disruption feed",
    icon: CloudRain,
  },
  {
    key: SECTIONS.simulator,
    title: "Simulator",
    subtitle: "Stress test disruption events",
    icon: Zap,
  },
  {
    key: SECTIONS.ml,
    title: "ML Insights",
    subtitle: "Fraud and payout analytics",
    icon: Brain,
  },
];

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

function prettyLabel(value) {
  if (!value) return "-";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusBadgeClass(status) {
  if (status === "approved" || status === "paid") return "border-emerald-300 text-emerald-700";
  if (status === "pending" || status === "flagged") return "border-amber-300 text-amber-700";
  return "border-red-300 text-red-700";
}

function severityClass(severity) {
  if (severity === "high") return "border-red-300 text-red-700";
  if (severity === "medium") return "border-amber-300 text-amber-700";
  return "border-emerald-300 text-emerald-700";
}

function kycClass(status, verified) {
  if (verified) return "bg-emerald-100 text-emerald-700";
  if (status === "otp_sent" || status === "otp_verified") return "bg-amber-100 text-amber-700";
  if (status === "failed" || status === "rejected") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function WorkflowRailItem({ active, title, subtitle, completed, onClick, Icon, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`w-full rounded-xl border p-3 text-left transition-all ${
        active
          ? "border-emerald-300 bg-emerald-50"
          : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-gray-200 text-[#0f6a57]">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#052e2b]" style={{ fontFamily: "Outfit" }}>
              {title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {completed ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </button>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState(SECTIONS.overview);
  const [data, setData] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [mlInsights, setMlInsights] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherPolling, setWeatherPolling] = useState(false);
  const [claimActionLoading, setClaimActionLoading] = useState({});
  const [claimActionError, setClaimActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simForm, setSimForm] = useState({
    zone: "Mumbai_Central",
    disruption_type: "weather",
    rainfall_mm: 80,
    temperature_celsius: 35,
    aqi_index: 150,
    wind_speed_kmh: 40,
    flood_alert: false,
    platform_outage: false,
  });

  const loadData = useCallback(async () => {
    try {
      const [dash, wk, ml, wx] = await Promise.all([
        adminApi.dashboard(),
        adminApi.workers(),
        adminApi.mlInsights(),
        adminApi.weatherAll().catch(() => ({ data: { zones: {} } })),
      ]);
      setData(dash.data);
      setWorkers(wk.data.workers || []);
      setMlInsights(ml.data);
      setWeatherData(wx.data);
      setClaimActionError("");
    } catch {
      // pass
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSimulate = async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      const { data: res } = await adminApi.simulateDisruption(simForm);
      setSimResult(res);
      await loadData();
    } catch (e) {
      setSimResult({ error: formatApiError(e) || "Simulation failed" });
    } finally {
      setSimLoading(false);
    }
  };

  const handleWeatherPoll = async () => {
    setWeatherPolling(true);
    try {
      const zones = Object.keys(weatherData?.zones || {});
      await adminApi.weatherPoll(zones.length ? { zones } : {});
      const wx = await adminApi.weatherAll();
      setWeatherData(wx.data);
    } catch {
      // pass
    } finally {
      setWeatherPolling(false);
    }
  };

  const handleClaimAction = async (claimId, action) => {
    setClaimActionError("");
    setClaimActionLoading((prev) => ({ ...prev, [claimId]: action }));
    try {
      await adminApi.claimAction(claimId, { action });
      await loadData();
    } catch (e) {
      setClaimActionError(formatApiError(e) || "Failed to process claim action");
    } finally {
      setClaimActionLoading((prev) => {
        const next = { ...prev };
        delete next[claimId];
        return next;
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const stats = data?.stats || {};
  const distributions = data?.distributions || {};
  const recentClaims = useMemo(() => data?.recent_claims || [], [data?.recent_claims]);

  const planData = useMemo(
    () => Object.entries(distributions.plans || {}).map(([name, value]) => ({ name, value })),
    [distributions.plans]
  );
  const severityData = useMemo(
    () => Object.entries(distributions.severity || {}).map(([name, value]) => ({ name, value })),
    [distributions.severity]
  );
  const fraudData = useMemo(
    () => Object.entries(distributions.fraud_tiers || {}).map(([name, value]) => ({ name: prettyLabel(name), value })),
    [distributions.fraud_tiers]
  );

  const claimQueue = useMemo(
    () => recentClaims.filter((c) => c.status === "pending" || c.status === "flagged"),
    [recentClaims]
  );

  const workerSummary = useMemo(() => {
    let verified = 0;
    let partial = 0;
    let plans = 0;

    workers.forEach((w) => {
      const status = String(w.kyc?.status || w.kyc_status || "not_started").toLowerCase();
      const isVerified = Boolean(w.kyc?.is_verified || w.is_kyc_verified);
      if (isVerified) verified += 1;
      if (status === "otp_sent" || status === "otp_verified") partial += 1;
      if (w.active_plan) plans += 1;
    });

    const total = workers.length || 1;
    return {
      verified,
      partial,
      plans,
      verifiedPct: Math.round((verified / total) * 100),
      planPct: Math.round((plans / total) * 100),
    };
  }, [workers]);

  const weatherZoneEntries = useMemo(() => Object.entries(weatherData?.zones || {}), [weatherData?.zones]);
  const weatherAlertCount = useMemo(
    () =>
      weatherZoneEntries.filter(
        ([, wx]) => Number(wx.flood_alert_flag || 0) > 0 || Number(wx.rainfall_mm || 0) >= 80 || Number(wx.aqi_index || 0) >= 200
      ).length,
    [weatherZoneEntries]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f7]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen worker-portal-shell app-page-scale" data-testid="admin-dashboard">
      <header className="bg-white/95 backdrop-blur border-b border-[#dbe0e5] px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f3a36] text-white">
            <Shield className="w-5 h-5" />
          </span>
          <div>
            <p className="font-bold text-base text-[#042824] tracking-tight" style={{ fontFamily: "Outfit" }}>
              FleetLock Assurance
            </p>
            <p className="text-xs text-gray-500">Admin Command Center</p>
          </div>
          <Badge className="ml-3 bg-[#ffe7db] text-[#9f3412] border-0 text-xs">Admin</Badge>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:inline">{user?.name || user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="admin-logout-btn">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="layout-container py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {[
            { icon: Users, label: "Workers", value: stats.total_workers || 0 },
            { icon: Shield, label: "Active Subs", value: stats.active_subscriptions || 0 },
            { icon: FileCheck, label: "Total Claims", value: stats.total_claims || 0 },
            { icon: Clock, label: "Action Queue", value: claimQueue.length },
            { icon: Check, label: "Approved", value: stats.approved_claims || 0 },
            { icon: Wallet, label: "Payouts", value: `Rs. ${(stats.total_payout_amount || 0).toFixed(0)}` },
          ].map((item, idx) => (
            <Card key={item.label} className="insurance-stat-card" data-testid={`admin-stat-${idx}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500">{item.label}</p>
                    <p className="mt-1 text-xl lg:text-2xl font-bold text-[#0f2d2a]" style={{ fontFamily: "Outfit" }}>
                      {item.value}
                    </p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff7f3] text-[#0f6a57]">
                    <item.icon className="w-5 h-5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(17rem,19rem)_minmax(0,1fr)] gap-6">
          <aside>
            <Card className="border-[#dce2e8] shadow-sm sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                  Operations Workflow
                </CardTitle>
                <p className="text-xs text-gray-500">Move from monitoring to intervention quickly.</p>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {SECTION_META.map((entry) => (
                  <WorkflowRailItem
                    key={entry.key}
                    active={section === entry.key}
                    title={entry.title}
                    subtitle={entry.subtitle}
                    Icon={entry.icon}
                    completed={entry.key === SECTIONS.claims ? claimQueue.length === 0 : true}
                    onClick={() => setSection(entry.key)}
                    testId={`tab-${entry.key}`}
                  />
                ))}

                <div className="mt-4 rounded-xl bg-[#eef6f3] p-3.5 border border-[#d6ebe4]">
                  <p className="text-xs uppercase tracking-wide text-[#24745f]">Risk Pulse</p>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Claims Awaiting Action</span>
                      <span className="font-semibold text-[#0f3f35]">{claimQueue.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Weather Alerts</span>
                      <span className="font-semibold text-[#0f3f35]">{weatherAlertCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">KYC Verified</span>
                      <span className="font-semibold text-[#0f3f35]">{workerSummary.verifiedPct}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-6">
            {section === SECTIONS.overview && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-[#dce2e8] shadow-sm" data-testid="plan-distribution">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                        Plan Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-52 min-h-52">
                        {planData.length > 0 && (
                          <ResponsiveContainer width="100%" height={208}>
                            <PieChart>
                              <Pie data={planData} cx="50%" cy="50%" innerRadius={42} outerRadius={74} paddingAngle={5} dataKey="value">
                                {planData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#dce2e8] shadow-sm" data-testid="severity-distribution">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                        Severity Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-52 min-h-52">
                        {severityData.length > 0 && (
                          <ResponsiveContainer width="100%" height={208}>
                            <BarChart data={severityData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf0" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {severityData.map((entry, i) => (
                                  <Cell key={i} fill={entry.name === "high" ? "#ef4444" : entry.name === "medium" ? "#f59e0b" : "#10b981"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#dce2e8] shadow-sm" data-testid="fraud-distribution">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                        Fraud Tier Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-52 min-h-52">
                        {fraudData.length > 0 && (
                          <ResponsiveContainer width="100%" height={208}>
                            <PieChart>
                              <Pie data={fraudData} cx="50%" cy="50%" innerRadius={42} outerRadius={74} paddingAngle={5} dataKey="value">
                                {fraudData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-[#dce2e8] shadow-sm" data-testid="recent-claims-table">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                      Recent Claims
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Worker</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Zone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Fraud Score</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead className="text-right">Payout</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentClaims.slice(0, 10).map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{c.worker_name || String(c.worker_id || "-").slice(0, 8)}</TableCell>
                            <TableCell className="capitalize">{prettyLabel(c.disruption_type)}</TableCell>
                            <TableCell className="text-sm text-gray-500">{c.zone}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`capitalize ${statusBadgeClass(c.status)}`}>
                                {c.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-sm font-mono ${
                                  c.fraud_score < 0.35 ? "text-emerald-600" : c.fraud_score <= 0.7 ? "text-amber-600" : "text-red-600"
                                }`}
                              >
                                {(c.fraud_score * 100).toFixed(0)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`capitalize text-xs ${severityClass(c.severity)}`}>
                                {c.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">Rs. {c.payout_amount?.toFixed(0) || 0}</TableCell>
                          </TableRow>
                        ))}
                        {recentClaims.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                              No recent claims
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}

            {section === SECTIONS.claims && (
              <Card className="border-[#dce2e8] shadow-sm" data-testid="all-claims">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                    Claims Adjudication Queue
                  </CardTitle>
                  <p className="text-sm text-gray-500">Approve or reject pending and flagged claims.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="rounded-lg border border-[#dbe5e2] bg-[#f6fbf9] p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Pending / Flagged</p>
                      <p className="text-2xl font-bold text-[#0f3f35]" style={{ fontFamily: "Outfit" }}>{claimQueue.length}</p>
                    </div>
                    <div className="rounded-lg border border-[#dbe5e2] bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Approved</p>
                      <p className="text-2xl font-bold text-emerald-700" style={{ fontFamily: "Outfit" }}>{stats.approved_claims || 0}</p>
                    </div>
                    <div className="rounded-lg border border-[#dbe5e2] bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Rejected</p>
                      <p className="text-2xl font-bold text-red-700" style={{ fontFamily: "Outfit" }}>
                        {Math.max((stats.total_claims || 0) - (stats.pending_claims || 0) - (stats.approved_claims || 0), 0)}
                      </p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fraud</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead className="text-right">Payout</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentClaims.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.worker_name || String(c.worker_id || "-").slice(0, 8)}</TableCell>
                          <TableCell className="capitalize">{prettyLabel(c.disruption_type)}</TableCell>
                          <TableCell className="text-sm text-gray-500">{c.zone}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`capitalize text-xs ${statusBadgeClass(c.status)}`}>
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{(c.fraud_score * 100).toFixed(0)}%</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {prettyLabel(c.fraud_tier)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`capitalize text-xs ${severityClass(c.severity)}`}>
                              {c.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">Rs. {c.payout_amount?.toFixed(0) || 0}</TableCell>
                          <TableCell className="text-xs text-gray-400">{formatDate(c.created_at)}</TableCell>
                          <TableCell>
                            {c.status === "pending" || c.status === "flagged" ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleClaimAction(c.id, "approve")}
                                  disabled={Boolean(claimActionLoading[c.id])}
                                >
                                  {claimActionLoading[c.id] === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Approve"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-300 text-red-700 hover:bg-red-50"
                                  onClick={() => handleClaimAction(c.id, "reject")}
                                  disabled={Boolean(claimActionLoading[c.id])}
                                >
                                  {claimActionLoading[c.id] === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reject"}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">No actions</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {recentClaims.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-gray-400 py-8">
                            No claims available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {claimActionError && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{claimActionError}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {section === SECTIONS.workers && (
              <Card className="border-[#dce2e8] shadow-sm" data-testid="workers-table">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                    Worker Portfolio
                  </CardTitle>
                  <p className="text-sm text-gray-500">Enrollment quality, KYC completion, and plan adoption.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="rounded-lg border border-[#dbe5e2] bg-[#f6fbf9] p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">KYC Progress</p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-gray-600">Verified</span>
                        <span className="font-semibold text-[#0f3f35]">{workerSummary.verified}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">In Progress</span>
                        <span className="font-semibold text-amber-700">{workerSummary.partial}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#dbe5e2] bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Plan Adoption</p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-gray-600">Active Plans</span>
                        <span className="font-semibold text-[#0f3f35]">{workerSummary.plans}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Coverage Rate</span>
                        <span className="font-semibold text-emerald-700">{workerSummary.planPct}%</span>
                      </div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>KYC</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Avg Income</TableHead>
                        <TableHead>Tenure</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Claims</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workers.map((w, i) => {
                        const kycStatus = String(w.kyc?.status || w.kyc_status || "not_started").toLowerCase();
                        const isKycVerified = Boolean(w.kyc?.is_verified || w.is_kyc_verified);
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{w.user_info?.name || String(w.user_id || "-").slice(0, 8)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {w.platform}
                              </Badge>
                            </TableCell>
                            <TableCell>{w.city}</TableCell>
                            <TableCell className="text-sm text-gray-500">{w.zone}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs border-0 capitalize ${kycClass(kycStatus, isKycVerified)}`}>
                                {prettyLabel(kycStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs border-0 capitalize ${w.active_plan ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                {w.active_plan || "None"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">Rs. {Number(w.daily_income_avg || 0).toFixed(0)}</TableCell>
                            <TableCell>{w.tenure_days}d</TableCell>
                            <TableCell>{w.platform_rating}/5</TableCell>
                            <TableCell>{w.total_claims}</TableCell>
                          </TableRow>
                        );
                      })}
                      {workers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-gray-400 py-8">
                            No workers available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {section === SECTIONS.weather && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                      Zone Weather Feed
                    </h3>
                    <p className="text-sm text-gray-500">
                      Live environmental data for disruption monitoring.
                      {weatherData?.weather_api_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 ml-2 text-xs">API Active</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-0 ml-2 text-xs">Fallback Mode</Badge>
                      )}
                    </p>
                  </div>

                  <Button variant="outline" size="sm" onClick={handleWeatherPoll} disabled={weatherPolling} data-testid="weather-poll-btn">
                    {weatherPolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh All Zones
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {weatherZoneEntries.map(([zoneId, wx]) => (
                    <Card key={zoneId} className="border-[#dce2e8] shadow-sm" data-testid={`weather-zone-${zoneId}`}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-[#022C22] text-sm" style={{ fontFamily: "Outfit" }}>
                            {prettyLabel(zoneId)}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`text-xs ${wx.source === "openweathermap_live" ? "border-emerald-300 text-emerald-700" : "border-gray-300 text-gray-500"}`}
                          >
                            {wx.source === "openweathermap_live" ? "Live" : "Simulated"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <Thermometer className="w-4 h-4 text-red-400" />
                            <div>
                              <p className="text-xs text-gray-500">Temp</p>
                              <p className="text-sm font-bold">{wx.temperature_celsius}&deg;C</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Droplets className="w-4 h-4 text-blue-400" />
                            <div>
                              <p className="text-xs text-gray-500">Rain</p>
                              <p className="text-sm font-bold">{wx.rainfall_mm}mm</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Wind className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Wind</p>
                              <p className="text-sm font-bold">{wx.wind_speed_kmh} km/h</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <CloudRain className="w-4 h-4 text-amber-400" />
                            <div>
                              <p className="text-xs text-gray-500">AQI</p>
                              <p
                                className={`text-sm font-bold ${
                                  wx.aqi_index > 200 ? "text-red-600" : wx.aqi_index > 100 ? "text-amber-600" : "text-emerald-600"
                                }`}
                              >
                                {wx.aqi_index}
                              </p>
                            </div>
                          </div>
                        </div>

                        {wx.weather_condition && (
                          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                            {wx.weather_condition}
                            {wx.flood_alert_flag ? <Badge className="bg-red-100 text-red-700 border-0 ml-1">Flood Alert</Badge> : null}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {weatherZoneEntries.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400">
                      <CloudRain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No weather data yet. Click "Refresh All Zones" to fetch.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === SECTIONS.simulator && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-[#dce2e8] shadow-sm" data-testid="disruption-simulator">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                      <CloudRain className="w-5 h-5 text-emerald-600" /> Disruption Simulator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Zone</Label>
                        <Select value={simForm.zone} onValueChange={(v) => setSimForm((f) => ({ ...f, zone: v }))}>
                          <SelectTrigger data-testid="sim-zone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Mumbai_Central",
                              "Mumbai_South",
                              "Chennai_North",
                              "Chennai_South",
                              "Bengaluru_East",
                              "Bengaluru_West",
                              "Hyderabad_Central",
                              "Delhi_North",
                            ].map((z) => (
                              <SelectItem key={z} value={z}>
                                {prettyLabel(z)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select value={simForm.disruption_type} onValueChange={(v) => setSimForm((f) => ({ ...f, disruption_type: v }))}>
                          <SelectTrigger data-testid="sim-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weather">Weather</SelectItem>
                            <SelectItem value="platform_outage">Platform Outage</SelectItem>
                            <SelectItem value="civic_event">Civic Event</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Rainfall: {simForm.rainfall_mm}mm</Label>
                      <Slider
                        value={[simForm.rainfall_mm]}
                        onValueChange={(v) => setSimForm((f) => ({ ...f, rainfall_mm: v[0] }))}
                        min={0}
                        max={200}
                        step={5}
                        data-testid="sim-rainfall"
                      />
                    </div>
                    <div>
                      <Label>Temperature: {simForm.temperature_celsius}&deg;C</Label>
                      <Slider
                        value={[simForm.temperature_celsius]}
                        onValueChange={(v) => setSimForm((f) => ({ ...f, temperature_celsius: v[0] }))}
                        min={15}
                        max={50}
                        step={1}
                      />
                    </div>
                    <div>
                      <Label>AQI: {simForm.aqi_index}</Label>
                      <Slider
                        value={[simForm.aqi_index]}
                        onValueChange={(v) => setSimForm((f) => ({ ...f, aqi_index: v[0] }))}
                        min={0}
                        max={500}
                        step={10}
                      />
                    </div>
                    <div>
                      <Label>Wind Speed: {simForm.wind_speed_kmh} km/h</Label>
                      <Slider
                        value={[simForm.wind_speed_kmh]}
                        onValueChange={(v) => setSimForm((f) => ({ ...f, wind_speed_kmh: v[0] }))}
                        min={0}
                        max={120}
                        step={5}
                      />
                    </div>

                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSimulate} disabled={simLoading} data-testid="sim-run-btn">
                      {simLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Run Simulation
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-[#dce2e8] shadow-sm" data-testid="sim-results">
                  <CardHeader>
                    <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                      Simulation Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {simResult && !simResult.error ? (
                      <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Zone</span>
                              <p className="font-medium">{prettyLabel(simResult.disruption?.zone)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Type</span>
                              <p className="font-medium capitalize">{prettyLabel(simResult.disruption?.type)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Severity</span>
                              <p
                                className={`font-bold capitalize ${
                                  simResult.disruption?.severity === "high"
                                    ? "text-red-600"
                                    : simResult.disruption?.severity === "medium"
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                }`}
                              >
                                {simResult.disruption?.severity} ({simResult.disruption?.severity_multiplier}x)
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Affected Workers</span>
                              <p className="font-bold text-[#022C22]">{simResult.affected_workers}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-emerald-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">Approved</p>
                            <p className="text-2xl font-bold text-emerald-700">{simResult.claims_summary?.approved}</p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">Pending</p>
                            <p className="text-2xl font-bold text-amber-700">{simResult.claims_summary?.pending}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">Rejected</p>
                            <p className="text-2xl font-bold text-red-700">{simResult.claims_summary?.rejected}</p>
                          </div>
                        </div>

                        <div className="bg-emerald-50 rounded-lg p-4 text-center">
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Payout</p>
                          <p className="text-3xl font-bold text-emerald-700" style={{ fontFamily: "Outfit" }}>
                            Rs. {simResult.claims_summary?.total_payout?.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    ) : simResult?.error ? (
                      <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
                        {typeof simResult.error === "string" ? simResult.error : JSON.stringify(simResult.error)}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-400">
                        <CloudRain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Run a simulation to see results</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {section === SECTIONS.ml && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {mlInsights &&
                    Object.values(mlInsights.models || {}).map((model, i) => (
                      <Card key={i} className="border-[#dce2e8] shadow-sm" data-testid={`ml-model-${i}`}>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-3">
                            <Brain className="w-5 h-5 text-emerald-600" />
                            <Badge variant="outline" className="text-xs">
                              {model.version}
                            </Badge>
                          </div>
                          <h3 className="font-bold text-[#022C22] mb-1" style={{ fontFamily: "Outfit" }}>
                            {model.name}
                          </h3>
                          <p className="text-xs text-gray-500 mb-4">{model.type}</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">{model.accuracy ? "Accuracy" : model.rmse ? "RMSE" : "F1 Score"}</span>
                              <span className="font-mono font-bold text-emerald-600">{model.accuracy || model.rmse || model.f1_score}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Features</span>
                              <span className="font-mono">{model.features}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>

                <Card className="border-[#dce2e8] shadow-sm" data-testid="fraud-over-time">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                      Fraud Score and Payout Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 min-h-64">
                      {(mlInsights?.fraud_over_time || []).length > 0 && (
                        <ResponsiveContainer width="100%" height={256}>
                          <LineChart data={mlInsights?.fraud_over_time || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf0" />
                            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="avg_fraud_score" stroke="#ef4444" name="Avg Fraud Score" dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="total_payout" stroke="#1f8a70" name="Total Payout (Rs.)" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
