import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { workerApi, formatApiError } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Shield,
  LogOut,
  TrendingUp,
  Wallet,
  FileCheck,
  Star,
  CloudRain,
  Zap,
  Check,
  Clock,
  XCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  UserRound,
  ClipboardCheck,
  CircleAlert,
  CircleDot,
  BadgeIndianRupee,
  Building2,
  CalendarClock,
} from "lucide-react";

const SECTIONS = {
  overview: "overview",
  compliance: "compliance",
  policy: "policy",
  claimCenter: "claim-center",
  ledger: "ledger",
  profile: "profile",
};

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

function prettyDisruptionType(value) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function SectionRailItem({ active, title, subtitle, completed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-5 text-left transition-all ${
        active
          ? "border-emerald-300 bg-emerald-50"
          : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-[#052e2b]" style={{ fontFamily: "Outfit" }}>{title}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div>
          {completed ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Clock className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function WorkerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState(SECTIONS.overview);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [claimLoading, setClaimLoading] = useState(false);
  const [claimResult, setClaimResult] = useState(null);
  const [claimType, setClaimType] = useState("weather");

  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [otp, setOtp] = useState("");
  const [transactionIdInput, setTransactionIdInput] = useState("");
  const [kycStatusData, setKycStatusData] = useState(null);
  const [kycMessage, setKycMessage] = useState("");
  const [kycError, setKycError] = useState("");
  const [kycActionLoading, setKycActionLoading] = useState(false);
  const [kycStatusLoading, setKycStatusLoading] = useState(false);

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

  const loadKycStatus = useCallback(async () => {
    setKycStatusLoading(true);
    try {
      const { data: status } = await workerApi.kycStatus();
      setKycStatusData(status || null);
      setKycError("");
    } catch (e) {
      if (e?.response?.status === 404) {
        setKycStatusData(null);
        setKycError("");
      } else {
        setKycError(formatApiError(e));
      }
    } finally {
      setKycStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadKycStatus();
  }, [loadDashboard, loadKycStatus]);

  const handleClaim = async () => {
    setClaimLoading(true);
    setClaimResult(null);
    try {
      const { data: res } = await workerApi.createClaim({ disruption_type: claimType });
      setClaimResult(res);
      await loadDashboard();
      setSection(SECTIONS.ledger);
    } catch (e) {
      setClaimResult({ error: formatApiError(e.response?.data) || "Failed to create claim" });
    }
    setClaimLoading(false);
  };

  const handleInitiateKyc = async () => {
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      setKycError("Enter a valid 12-digit Aadhaar number");
      return;
    }
    if (!consentGiven) {
      setKycError("Consent is required to start KYC verification");
      return;
    }

    setKycActionLoading(true);
    setKycMessage("");
    setKycError("");

    try {
      const { data: response } = await workerApi.kycInitiate({
        aadhaar_number: aadhaarNumber,
        consent: consentGiven,
      });
      setTransactionIdInput(response?.transaction_id || "");
      setKycMessage(response?.message || "OTP sent successfully");
      if (response?.mock_otp) {
        setOtp(String(response.mock_otp));
      }
      await loadKycStatus();
    } catch (e) {
      setKycError(formatApiError(e));
    } finally {
      setKycActionLoading(false);
    }
  };

  const handleVerifyKyc = async () => {
    const transactionId = String(transactionIdInput || "").trim();
    if (!transactionId) {
      setKycError("Transaction ID is required for OTP verification");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setKycError("Enter a valid 6-digit OTP");
      return;
    }

    setKycActionLoading(true);
    setKycMessage("");
    setKycError("");

    try {
      const { data: response } = await workerApi.kycVerify({
        transaction_id: transactionId,
        otp,
      });
      setKycMessage(
        response?.kyc_status === "verified"
          ? "KYC verified successfully"
          : "KYC verification completed"
      );
      setOtp("");
      await loadKycStatus();
      await loadDashboard();
      setSection(SECTIONS.policy);
    } catch (e) {
      setKycError(formatApiError(e));
    } finally {
      setKycActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const claimSummary = useMemo(() => {
    const claimsList = data?.claims || [];
    const approved = claimsList.filter((c) => c.status === "approved" || c.status === "paid").length;
    const pending = claimsList.filter((c) => c.status === "pending" || c.status === "flagged").length;
    const rejected = claimsList.filter((c) => c.status === "rejected").length;
    return { approved, pending, rejected };
  }, [data?.claims]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f7]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const w = data?.worker || {};
  const loyalty = data?.loyalty || { loyalty_score: 0, loyalty_bonus: 1, breakdown: {} };
  const sub = data?.subscription;
  const claims = data?.claims || [];
  const payouts = data?.payouts || [];
  const earnings = (data?.earnings || []).slice(0, 14).reverse();
  const stats = data?.stats || {};

  const kycStatus = String(kycStatusData?.kyc_status || "not_started").toLowerCase();
  const isKycVerified = kycStatus === "verified";
  const canFileClaim = Boolean(sub) && isKycVerified;

  const kycBadgeClass =
    kycStatus === "verified"
      ? "bg-emerald-100 text-emerald-700"
      : kycStatus === "otp_sent" || kycStatus === "otp_verified"
        ? "bg-amber-100 text-amber-700"
        : kycStatus === "failed" || kycStatus === "rejected"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600";

  const nextAction = !isKycVerified
    ? "Complete KYC verification"
    : !sub
      ? "Subscribe to a protection plan"
      : "You are ready to file claims";

  const readinessScore = (() => {
    let score = 25;
    if (isKycVerified) score += 35;
    if (sub) score += 25;
    if (Number(loyalty.loyalty_score || 0) >= 0.5) score += 15;
    return Math.min(score, 100);
  })();

  const statusIcon = (s) => {
    if (s === "approved" || s === "paid") return <Check className="w-4 h-4 text-emerald-600" />;
    if (s === "pending" || s === "flagged") return <Clock className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen worker-portal-shell worker-dashboard-scale text-base" data-testid="worker-dashboard">
      <header className="bg-white/95 backdrop-blur border-b border-[#dbe0e5] px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f3a36] text-white">
            <Shield className="w-5.5 h-5.5" />
          </span>
          <div>
            <p className="font-bold text-lg text-[#042824] tracking-tight" style={{ fontFamily: "Outfit" }}>
              FleetLock Assurance
            </p>
            <p className="text-sm text-gray-500">Policyholder Workspace</p>
          </div>
          <Badge className="ml-3 bg-[#d9f3ea] text-[#086a53] border-0">Worker</Badge>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:inline">{user?.name || user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-btn">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="layout-container py-8 min-h-[calc(100vh-5rem)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-6 mb-8">
          {[
            {
              icon: TrendingUp,
              label: "Avg Daily Earnings",
              value: `Rs. ${w.daily_income_avg?.toFixed(0) || 0}`,
            },
            {
              icon: Wallet,
              label: "Total Payouts",
              value: `Rs. ${stats.total_payouts?.toFixed(0) || 0}`,
            },
            {
              icon: ClipboardCheck,
              label: "Claims Processed",
              value: stats.total_claims || 0,
            },
            {
              icon: Star,
              label: "Loyalty Score",
              value: `${((loyalty.loyalty_score || 0) * 100).toFixed(0)}%`,
            },
          ].map((item, idx) => (
            <Card key={item.label} className="insurance-stat-card border-[#dbe2e8] shadow-sm min-h-36" data-testid={`stat-${idx}`}>
              <CardContent className="p-6 h-full flex items-start">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500">{item.label}</p>
                    <p className="mt-2 text-4xl font-bold text-[#0f2d2a] leading-none" style={{ fontFamily: "Outfit" }}>{item.value}</p>
                  </div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#eff7f3] text-[#0f6a57] mt-1">
                    <item.icon className="w-6 h-6" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] gap-8 items-start">
          <aside>
            <Card className="border-[#dce2e8] shadow-sm sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                  Claim Lifecycle
                </CardTitle>
                <p className="text-sm text-gray-500">Follow the required insurance workflow.</p>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <SectionRailItem
                  active={section === SECTIONS.overview}
                  title="Overview"
                  subtitle="Health, readiness, and activity"
                  completed
                  onClick={() => setSection(SECTIONS.overview)}
                />
                <SectionRailItem
                  active={section === SECTIONS.compliance}
                  title="Compliance"
                  subtitle="KYC and identity verification"
                  completed={isKycVerified}
                  onClick={() => setSection(SECTIONS.compliance)}
                />
                <SectionRailItem
                  active={section === SECTIONS.policy}
                  title="Policy"
                  subtitle="Plan details and coverage"
                  completed={Boolean(sub)}
                  onClick={() => setSection(SECTIONS.policy)}
                />
                <SectionRailItem
                  active={section === SECTIONS.claimCenter}
                  title="Claim Center"
                  subtitle="Submit a disruption claim"
                  completed={canFileClaim}
                  onClick={() => setSection(SECTIONS.claimCenter)}
                />
                <SectionRailItem
                  active={section === SECTIONS.ledger}
                  title="Claim Ledger"
                  subtitle="Claims and payouts history"
                  completed={claims.length > 0 || payouts.length > 0}
                  onClick={() => setSection(SECTIONS.ledger)}
                />
                <SectionRailItem
                  active={section === SECTIONS.profile}
                  title="Account"
                  subtitle="Worker profile and score"
                  completed
                  onClick={() => setSection(SECTIONS.profile)}
                />

                <div className="mt-4 rounded-xl bg-[#eef6f3] p-5 border border-[#d6ebe4]">
                  <p className="text-xs uppercase tracking-wide text-[#24745f]">Next Action</p>
                  <p className="text-base font-semibold text-[#0f3f35] mt-1">{nextAction}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm text-[#246b5b] mb-1">
                      <span>Readiness Score</span>
                      <span>{readinessScore}%</span>
                    </div>
                    <Progress value={readinessScore} className="h-2 bg-[#d8ebe4]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-7">
            {section === SECTIONS.overview && (
              <>
                <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)] gap-5">
                  <Card className="border-[#dce2e8] shadow-sm" data-testid="earnings-chart">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                        Earnings Trend (Last 14 Days)
                      </CardTitle>
                      <p className="text-sm text-gray-500">Daily earnings footprint used for disruption coverage calculations.</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[min(55vh,28rem)]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={earnings}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf0" />
                            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v) => [`Rs. ${Number(v || 0).toFixed(0)}`, "Earnings"]} />
                            <Bar dataKey="amount" fill="#1f8a70" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-5">
                    <Card className="border-[#dce2e8] shadow-sm min-h-56">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg text-[#052d28]" style={{ fontFamily: "Outfit" }}>Portfolio Snapshot</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">KYC Status</span>
                          <Badge className={`capitalize border-0 ${kycBadgeClass}`}>{kycStatus.replace("_", " ")}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Plan</span>
                          <span className="font-semibold text-[#0f312d] capitalize">{sub?.plan || "Not subscribed"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Approved Claims</span>
                          <span className="font-semibold text-emerald-700">{claimSummary.approved}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Pending Claims</span>
                          <span className="font-semibold text-amber-700">{claimSummary.pending}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Readiness</span>
                          <span className="font-semibold text-[#0f3f35]">{readinessScore}%</span>
                        </div>
                        <Progress value={readinessScore} className="h-2 bg-[#d8ebe4]" />
                      </CardContent>
                    </Card>

                    <Card className="border-[#dce2e8] shadow-sm min-h-56">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg text-[#052d28]" style={{ fontFamily: "Outfit" }}>Operational Alerts</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {!isKycVerified && (
                          <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-700">
                            <CircleAlert className="w-4 h-4 mt-0.5" />
                            <p>KYC incomplete. Claim submission is blocked.</p>
                          </div>
                        )}
                        {!sub && (
                          <div className="flex gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-sky-700">
                            <BadgeIndianRupee className="w-4 h-4 mt-0.5" />
                            <p>No active policy. Subscribe before claiming disruptions.</p>
                          </div>
                        )}
                        {canFileClaim && (
                          <div className="flex gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-700">
                            <Check className="w-4 h-4 mt-0.5" />
                            <p>Claim center is active and ready for submission.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-[#dce2e8] shadow-sm min-h-56">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-[#052d28]" style={{ fontFamily: "Outfit" }}>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3.5">
                      <Button variant="outline" className="w-full justify-start h-12 text-base" onClick={() => setSection(SECTIONS.compliance)}>
                        <FileCheck className="w-4 h-4" /> Verify KYC
                      </Button>
                      <Button variant="outline" className="w-full justify-start h-12 text-base" onClick={() => setSection(SECTIONS.policy)}>
                        <Building2 className="w-4 h-4" /> Manage Policy
                      </Button>
                      <Button
                        className="w-full justify-start h-12 text-base bg-[#0f7560] hover:bg-[#0c5b4b] text-white"
                        disabled={!canFileClaim}
                        onClick={() => setSection(SECTIONS.claimCenter)}
                      >
                        <CloudRain className="w-4 h-4" /> Start Claim
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-[#dce2e8] shadow-sm min-h-56">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-[#052d28]" style={{ fontFamily: "Outfit" }}>Coverage Readiness</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Next Action</span>
                        <span className="font-semibold text-[#0f3f35]">{nextAction}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-[#dbe5e2] bg-[#f6fbf9] p-3 text-center">
                          <p className="text-xs text-gray-500">Approved</p>
                          <p className="text-xl font-bold text-emerald-700" style={{ fontFamily: "Outfit" }}>{claimSummary.approved}</p>
                        </div>
                        <div className="rounded-lg border border-[#dbe5e2] bg-white p-3 text-center">
                          <p className="text-xs text-gray-500">Pending</p>
                          <p className="text-xl font-bold text-amber-700" style={{ fontFamily: "Outfit" }}>{claimSummary.pending}</p>
                        </div>
                        <div className="rounded-lg border border-[#dbe5e2] bg-white p-3 text-center">
                          <p className="text-xs text-gray-500">Rejected</p>
                          <p className="text-xl font-bold text-red-700" style={{ fontFamily: "Outfit" }}>{claimSummary.rejected}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {section === SECTIONS.compliance && (
              <Card className="border-[#dce2e8] shadow-sm" data-testid="kyc-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                    <FileCheck className="w-5 h-5 text-[#0f7560]" /> KYC & Compliance Center
                  </CardTitle>
                  <p className="text-sm text-gray-500">Mandatory identity verification for policy compliance.</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Current Status</span>
                    <Badge className={`capitalize border-0 ${kycBadgeClass}`}>{kycStatus.replace("_", " ")}</Badge>
                  </div>

                  {kycStatusLoading && (
                    <div className="text-xs text-gray-500 flex items-center gap-2 mb-3">
                      <Loader2 className="w-3 h-3 animate-spin" /> Refreshing verification status...
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      {kycStatusData?.aadhaar_masked && (
                        <div className="text-sm text-gray-600">Aadhaar: {kycStatusData.aadhaar_masked}</div>
                      )}
                      {kycStatusData?.verification_timestamp && (
                        <div className="text-sm text-gray-600">Verified On: {formatDate(kycStatusData.verification_timestamp)}</div>
                      )}

                      {!isKycVerified && (
                        <>
                          <div>
                            <Label htmlFor="aadhaar-input">Aadhaar Number</Label>
                            <Input
                              id="aadhaar-input"
                              inputMode="numeric"
                              maxLength={12}
                              value={aadhaarNumber}
                              onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                              placeholder="Enter 12-digit Aadhaar"
                              className="mt-1"
                              data-testid="aadhaar-input"
                            />
                          </div>

                          <div className="flex items-start gap-2">
                            <Checkbox
                              id="kyc-consent"
                              checked={consentGiven}
                              onCheckedChange={(checked) => setConsentGiven(Boolean(checked))}
                              data-testid="kyc-consent-checkbox"
                            />
                            <Label htmlFor="kyc-consent" className="text-xs text-gray-600 leading-relaxed">
                              I agree to share Aadhaar data for insurance KYC verification.
                            </Label>
                          </div>

                          <Button
                            className="w-full bg-[#0f7560] hover:bg-[#0c5b4b] text-white"
                            onClick={handleInitiateKyc}
                            disabled={kycActionLoading}
                            data-testid="kyc-initiate-btn"
                          >
                            {kycActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Send OTP
                          </Button>

                          <div>
                            <Label htmlFor="transaction-id-input">Transaction ID</Label>
                            <Input
                              id="transaction-id-input"
                              value={transactionIdInput}
                              onChange={(e) => setTransactionIdInput(e.target.value)}
                              placeholder="Paste transaction ID"
                              className="mt-1"
                              data-testid="transaction-id-input"
                            />
                          </div>

                          <div>
                            <Label htmlFor="otp-input">OTP</Label>
                            <Input
                              id="otp-input"
                              inputMode="numeric"
                              maxLength={6}
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              placeholder="Enter 6-digit OTP"
                              className="mt-1"
                              data-testid="otp-input"
                            />
                          </div>

                          <Button
                            variant="outline"
                            className="w-full border-[#8ecfbb] text-[#0f7560] hover:bg-emerald-50"
                            onClick={handleVerifyKyc}
                            disabled={kycActionLoading}
                            data-testid="kyc-verify-btn"
                          >
                            {kycActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Verify OTP
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="rounded-xl border border-[#dbe5e2] bg-[#f6fbf9] p-4">
                      <p className="text-sm font-semibold text-[#0f3f35] mb-3" style={{ fontFamily: "Outfit" }}>Compliance Checklist</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Identity Consent</span>
                          {consentGiven || isKycVerified ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">Completed</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 border-0">Pending</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">OTP Validation</span>
                          {kycStatus === "otp_sent" || kycStatus === "otp_verified" || isKycVerified ? (
                            <Badge className="bg-amber-100 text-amber-700 border-0">In Progress</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 border-0">Not Started</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Final Verification</span>
                          {isKycVerified ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">Verified</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 border-0">Pending</Badge>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-4 text-gray-700"
                        onClick={loadKycStatus}
                        disabled={kycStatusLoading}
                        data-testid="kyc-refresh-btn"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${kycStatusLoading ? "animate-spin" : ""}`} />
                        Refresh KYC Status
                      </Button>
                    </div>
                  </div>

                  {kycMessage && (
                    <div className="mt-4 bg-emerald-50 text-emerald-700 rounded-lg p-3 text-sm" data-testid="kyc-message">
                      {kycMessage}
                    </div>
                  )}
                  {kycError && (
                    <div className="mt-3 bg-red-50 text-red-700 rounded-lg p-3 text-sm" data-testid="kyc-error">
                      {kycError}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {section === SECTIONS.policy && (
              <Card className="border-[#dce2e8] shadow-sm" data-testid="active-plan">
                <CardHeader>
                  <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                    Policy & Coverage
                  </CardTitle>
                  <p className="text-sm text-gray-500">View and manage your active insurance plan.</p>
                </CardHeader>
                <CardContent>
                  {sub ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 rounded-xl border border-[#dce5ea] p-4 bg-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">Active Policy</p>
                            <p className="text-2xl font-bold text-[#0f2f2a] capitalize" style={{ fontFamily: "Outfit" }}>{sub.plan}</p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-700 border-0">In Force</Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="rounded-lg bg-[#f4f8fa] p-3">
                            <p className="text-xs text-gray-500">Weekly Premium</p>
                            <p className="text-lg font-semibold text-[#0d3f38]">Rs. {sub.premium_weekly}</p>
                          </div>
                          <div className="rounded-lg bg-[#f4f8fa] p-3">
                            <p className="text-xs text-gray-500">Coverage Rate</p>
                            <p className="text-lg font-semibold text-[#0d3f38]">{Math.round((sub.coverage_rate || 0) * 100)}%</p>
                          </div>
                          <div className="rounded-lg bg-[#f4f8fa] p-3">
                            <p className="text-xs text-gray-500">Policy End Date</p>
                            <p className="text-lg font-semibold text-[#0d3f38]">{formatDate(sub.end_date)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#dbe5e2] bg-[#f6fbf9] p-4">
                        <p className="text-sm font-semibold text-[#0f3f35] mb-2" style={{ fontFamily: "Outfit" }}>Coverage Notes</p>
                        <ul className="space-y-2 text-sm text-gray-600">
                          <li className="flex gap-2"><CircleDot className="w-4 h-4 mt-0.5 text-emerald-600" /> Parametric disruption payouts</li>
                          <li className="flex gap-2"><CircleDot className="w-4 h-4 mt-0.5 text-emerald-600" /> Weather and outage claim events</li>
                          <li className="flex gap-2"><CircleDot className="w-4 h-4 mt-0.5 text-emerald-600" /> Weekly renewal cycle</li>
                        </ul>
                        <Button
                          variant="outline"
                          className="w-full mt-4 border-[#8ecfbb] text-[#0f7560] hover:bg-emerald-50"
                          onClick={() => navigate("/plans")}
                          data-testid="change-plan-btn"
                        >
                          Manage Plan <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#cfd9df] p-8 text-center">
                      <p className="text-lg font-semibold text-[#103732]" style={{ fontFamily: "Outfit" }}>No Active Policy</p>
                      <p className="text-sm text-gray-500 mt-1">You need an active plan before claims can be filed.</p>
                      <Button
                        className="mt-4 bg-[#0f7560] hover:bg-[#0c5b4b] text-white"
                        onClick={() => navigate("/plans")}
                        data-testid="subscribe-btn"
                      >
                        Subscribe Now
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {section === SECTIONS.claimCenter && (
              <Card className="border-[#dce2e8] shadow-sm" data-testid="file-claim">
                <CardHeader>
                  <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                    Claim Intake Desk
                  </CardTitle>
                  <p className="text-sm text-gray-500">Submit disruption events for automated claim assessment.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
                    <div className="space-y-3">
                      <Label>Disruption Type</Label>
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

                      <Button
                        className="w-full bg-[#0f7560] hover:bg-[#0c5b4b] text-white"
                        onClick={handleClaim}
                        disabled={claimLoading || !canFileClaim}
                        data-testid="submit-claim-btn"
                      >
                        {claimLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudRain className="w-4 h-4" />}
                        Submit Claim
                      </Button>

                      {!sub && <p className="text-xs text-amber-600">Subscribe to a plan first.</p>}
                      {sub && !isKycVerified && <p className="text-xs text-amber-600">Complete KYC verification to file claims.</p>}

                      {claimResult && !claimResult.error && (
                        <div
                          className={`rounded-lg p-3 text-sm ${
                            claimResult.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : claimResult.status === "pending" || claimResult.status === "flagged"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                          }`}
                          data-testid="claim-result"
                        >
                          <p className="font-medium">{claimResult.message}</p>
                          {claimResult.payout_amount > 0 && (
                            <p className="mt-1">Estimated Payout: Rs. {claimResult.payout_amount.toFixed(0)}</p>
                          )}
                        </div>
                      )}
                      {claimResult?.error && (
                        <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm" data-testid="claim-error">
                          {typeof claimResult.error === "string" ? claimResult.error : JSON.stringify(claimResult.error)}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-[#dbe5e2] bg-[#f6fbf9] p-4">
                      <p className="text-sm font-semibold text-[#0f3f35] mb-3" style={{ fontFamily: "Outfit" }}>Eligibility Checks</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">KYC Verified</span>
                          {isKycVerified ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">Pass</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border-0">Pending</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Policy In Force</span>
                          {sub ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">Pass</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border-0">Missing</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Submission Window</span>
                          <Badge className="bg-emerald-100 text-emerald-700 border-0">Open</Badge>
                        </div>
                      </div>
                      <div className="mt-4 rounded-lg bg-white border border-[#d9e6e1] p-3 text-xs text-gray-600">
                        Claims are automatically risk-scored and routed to approved, pending review, or rejection queues.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {section === SECTIONS.ledger && (
              <Card className="border-[#dce2e8] shadow-sm" data-testid="claims-section">
                <CardHeader>
                  <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                    Claims & Payout Ledger
                  </CardTitle>
                  <p className="text-sm text-gray-500">Track outcomes and payout settlements.</p>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="claims">
                    <TabsList>
                      <TabsTrigger value="claims">Claims</TabsTrigger>
                      <TabsTrigger value="payouts">Payouts</TabsTrigger>
                    </TabsList>

                    <TabsContent value="claims" className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Disruption</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Fraud Score</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead className="text-right">Payout</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {claims.slice(0, 12).map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{prettyDisruptionType(c.disruption_type)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {statusIcon(c.status)}
                                  <span className="capitalize text-sm">{c.status}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`text-sm font-mono ${c.fraud_score < 0.35 ? "text-emerald-600" : c.fraud_score <= 0.7 ? "text-amber-600" : "text-red-600"}`}>
                                  {(c.fraud_score * 100).toFixed(0)}%
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">{c.severity}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">Rs. {c.payout_amount?.toFixed(0) || 0}</TableCell>
                            </TableRow>
                          ))}
                          {claims.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-gray-400 py-8">No claims yet</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="payouts" className="mt-4">
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
                          {payouts.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell>{formatDate(p.created_at)}</TableCell>
                              <TableCell className="capitalize">{p.plan}</TableCell>
                              <TableCell><Badge variant="outline" className="capitalize">{p.status?.replace("_", " ")}</Badge></TableCell>
                              <TableCell className="text-right font-mono font-medium">Rs. {p.amount?.toFixed(0)}</TableCell>
                            </TableRow>
                          ))}
                          {payouts.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-gray-400 py-8">No payouts yet</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {section === SECTIONS.profile && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-[#dce2e8] shadow-sm" data-testid="worker-info">
                  <CardHeader>
                    <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                      Account Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <UserRound className="w-4 h-4 text-[#0f7560]" />
                      <span className="font-medium text-[#103732]">{user?.name || "Worker"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-gray-500">Platform</span><span className="font-medium">{w.platform}</span>
                      <span className="text-gray-500">City</span><span className="font-medium">{w.city}</span>
                      <span className="text-gray-500">Zone</span><span className="font-medium">{w.zone}</span>
                      <span className="text-gray-500">Tenure</span><span className="font-medium">{w.tenure_days} days</span>
                      <span className="text-gray-500">Rating</span><span className="font-medium">{w.platform_rating}/5</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#dce2e8] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                      Loyalty Composition
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Active Days", value: loyalty.breakdown?.active_days_weight, icon: CalendarClock },
                      { label: "Renewal Streak", value: loyalty.breakdown?.renewal_streak_weight, icon: RefreshCw },
                      { label: "Claim Accuracy", value: loyalty.breakdown?.claim_accuracy_weight, icon: ClipboardCheck },
                      { label: "Platform Rating", value: loyalty.breakdown?.platform_rating_weight, icon: Star },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600 flex items-center gap-1.5"><item.icon className="w-3.5 h-3.5" /> {item.label}</span>
                          <span className="font-mono text-[#103732]">{((item.value || 0) * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={(item.value || 0) * 100} className="h-2" />
                      </div>
                    ))}
                    <div className="mt-3 rounded-lg bg-[#f2faf7] border border-[#d8ebe4] p-3 text-sm">
                      Current Loyalty Bonus: <span className="font-semibold text-[#0f6a57]">+{((loyalty.loyalty_bonus || 1) - 1) * 100}%</span>
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
