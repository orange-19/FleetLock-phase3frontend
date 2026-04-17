import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { workerApi, formatApiError } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Shield,
  Loader2,
  ArrowRight,
  FileCheck,
  CheckCircle2,
  Circle,
  Clock3,
  ClipboardCheck,
  UserRound,
  RefreshCw,
  LogOut,
} from "lucide-react";

function WorkflowStep({ title, subtitle, state }) {
  const isDone = state === "done";
  const isActive = state === "active";
  const icon = isDone ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
  ) : isActive ? (
    <Clock3 className="w-4 h-4 text-amber-600" />
  ) : (
    <Circle className="w-4 h-4 text-gray-400" />
  );

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        isDone
          ? "border-emerald-200 bg-emerald-50"
          : isActive
            ? "border-amber-200 bg-amber-50"
            : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-[#062d28]" style={{ fontFamily: "Outfit" }}>
            {title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export default function WorkerKycVerification() {
  const navigate = useNavigate();
  const { user, refreshKycStatus, logout } = useAuth();

  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [otp, setOtp] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const { data } = await workerApi.kycStatus();
      setStatusData(data || null);
      setError("");
      if (data?.setu_transaction_id && !transactionId) {
        setTransactionId(data.setu_transaction_id);
      }
    } catch (e) {
      if (e?.response?.status === 404) {
        setStatusData(null);
        setError("");
      } else {
        setError(formatApiError(e));
      }
    } finally {
      setStatusLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const kycStatus = String(statusData?.kyc_status || "not_started").toLowerCase();
  const isVerified = kycStatus === "verified";
  const isOtpStage = kycStatus === "otp_sent" || kycStatus === "otp_verified";

  const statusBadgeClass = useMemo(() => {
    if (kycStatus === "verified") return "bg-emerald-100 text-emerald-700";
    if (kycStatus === "otp_sent" || kycStatus === "otp_verified") return "bg-amber-100 text-amber-700";
    if (kycStatus === "failed" || kycStatus === "rejected") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }, [kycStatus]);

  const handleInitiate = async () => {
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      setError("Enter a valid 12-digit Aadhaar number");
      return;
    }
    if (!consentGiven) {
      setError("Consent is required to start KYC");
      return;
    }

    setActionLoading(true);
    setMessage("");
    setError("");

    try {
      const { data } = await workerApi.kycInitiate({
        aadhaar_number: aadhaarNumber,
        consent: consentGiven,
      });

      setMessage(data?.message || "OTP sent successfully");
      setTransactionId(data?.transaction_id || "");
      if (data?.mock_otp) {
        setOtp(String(data.mock_otp));
      }
      await loadStatus();
      await refreshKycStatus();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!transactionId.trim()) {
      setError("Transaction ID is required");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter a valid 6-digit OTP");
      return;
    }

    setActionLoading(true);
    setMessage("");
    setError("");

    try {
      await workerApi.kycVerify({
        transaction_id: transactionId.trim(),
        otp,
      });

      setMessage("KYC verified successfully");
      await loadStatus();
      await refreshKycStatus();
      navigate("/dashboard");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen worker-portal-shell app-page-scale" data-testid="worker-kyc-page">
      <header className="bg-white/95 backdrop-blur border-b border-[#dbe0e5] px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f3a36] text-white">
            <Shield className="w-5 h-5" />
          </span>
          <div>
            <p className="font-bold text-base text-[#042824] tracking-tight" style={{ fontFamily: "Outfit" }}>
              FleetLock Assurance
            </p>
            <p className="text-xs text-gray-500">Identity Verification</p>
          </div>
        </div>
        <Badge className={`capitalize border-0 ${statusBadgeClass}`}>{kycStatus.replace("_", " ")}</Badge>
      </header>

      <main className="layout-container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] gap-6">
          <aside className="space-y-4">
            <Card className="border-[#dce2e8] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                  Verification Flow
                </CardTitle>
                <p className="text-xs text-gray-500">One-time KYC is required for claims and payouts.</p>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <WorkflowStep
                  title="Identity Details"
                  subtitle="Aadhaar input and consent"
                  state={isOtpStage || isVerified ? "done" : "active"}
                />
                <WorkflowStep
                  title="OTP Verification"
                  subtitle="Validate transaction and OTP"
                  state={isVerified ? "done" : isOtpStage ? "active" : "pending"}
                />
                <WorkflowStep
                  title="Access Activation"
                  subtitle="Unlock full worker dashboard"
                  state={isVerified ? "done" : "pending"}
                />

                <div className="mt-3 rounded-xl border border-[#d6ebe4] bg-[#eef6f3] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#24745f]">Profile</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#0f3f35]">
                    <UserRound className="w-4 h-4" />
                    <span>{user?.name || user?.email}</span>
                  </div>
                  {statusData?.aadhaar_masked && (
                    <p className="text-xs text-gray-600 mt-2">Aadhaar: {statusData.aadhaar_masked}</p>
                  )}
                  {statusData?.verification_timestamp && (
                    <p className="text-xs text-gray-600">Verified: {new Date(statusData.verification_timestamp).toLocaleString()}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section>
            <Card className="border-[#dce2e8] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl text-[#052d28]" style={{ fontFamily: "Outfit" }}>
                  Complete KYC Verification
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Finish this compliance step once to continue with subscriptions, claims, and payout settlement.
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                {statusLoading && (
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking current KYC status...
                  </div>
                )}

                {isVerified && (
                  <div className="bg-emerald-50 text-emerald-700 rounded-lg p-3 text-sm flex items-start gap-2" data-testid="kyc-verified-banner">
                    <ClipboardCheck className="w-4 h-4 mt-0.5" />
                    <span>KYC already verified. You can continue to dashboard.</span>
                  </div>
                )}

                {!isVerified && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="aadhaar-number">Aadhaar Number</Label>
                        <Input
                          id="aadhaar-number"
                          inputMode="numeric"
                          maxLength={12}
                          value={aadhaarNumber}
                          onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                          placeholder="Enter 12-digit Aadhaar"
                          className="mt-1"
                          data-testid="kyc-aadhaar-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="worker-transaction-id">Transaction ID</Label>
                        <Input
                          id="worker-transaction-id"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="Paste transaction ID"
                          className="mt-1"
                          data-testid="worker-kyc-transaction-id"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="worker-otp">OTP</Label>
                      <Input
                        id="worker-otp"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        className="mt-1"
                        data-testid="worker-kyc-otp"
                      />
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <Checkbox
                        id="worker-kyc-consent"
                        checked={consentGiven}
                        onCheckedChange={(checked) => setConsentGiven(Boolean(checked))}
                        data-testid="worker-kyc-consent"
                      />
                      <Label htmlFor="worker-kyc-consent" className="text-sm text-gray-600 leading-relaxed">
                        I agree to share my Aadhaar data for KYC verification.
                      </Label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleInitiate}
                        disabled={actionLoading}
                        data-testid="worker-kyc-initiate-btn"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />} Send OTP
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={handleVerify}
                        disabled={actionLoading}
                        data-testid="worker-kyc-verify-btn"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Verify OTP
                      </Button>
                    </div>
                  </>
                )}

                {message && (
                  <div className="bg-emerald-50 text-emerald-700 rounded-lg p-3 text-sm" data-testid="worker-kyc-message">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm" data-testid="worker-kyc-error">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button variant="ghost" onClick={loadStatus} disabled={statusLoading} data-testid="worker-kyc-refresh-btn">
                    {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh Status
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => navigate("/dashboard")}
                    disabled={!isVerified}
                    data-testid="worker-kyc-continue-btn"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                <Button variant="ghost" className="w-full text-gray-500" onClick={logout} data-testid="worker-kyc-logout-btn">
                  <LogOut className="w-4 h-4" /> Logout
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
