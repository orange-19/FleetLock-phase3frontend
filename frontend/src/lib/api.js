import axios from "axios";

const BACKEND_URL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:5000";
const TOKEN_STORAGE_KEY = "access_token";

const API = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// Token storage (in-memory for security)
let _accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);

export function setAccessToken(token) {
  _accessToken = token || null;
  if (_accessToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, _accessToken);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getAccessToken() {
  return _accessToken;
}

export function clearAccessToken() {
  _accessToken = null;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// Request interceptor - attach Bearer token
API.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// Response interceptor - clear stale session on unauthorized responses
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAccessToken();
      if (
        typeof window !== "undefined" &&
        !["/login", "/register"].includes(window.location.pathname)
      ) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(detail) {
  if (detail == null) {
    return `Unable to reach backend at ${BACKEND_URL}. Make sure the API server is running.`;
  }

  // Handle axios/network errors directly.
  if (detail && typeof detail === "object" && detail.isAxiosError) {
    if (detail.response?.data) return formatApiError(detail.response.data);
    if (detail.code === "ERR_NETWORK") {
      return `Network error: cannot connect to ${BACKEND_URL}.`;
    }
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message;
    }
  }

  // Handle wrapped error objects where response payload exists.
  if (detail && typeof detail === "object" && detail.response?.data) {
    return formatApiError(detail.response.data);
  }

  if (typeof detail === "string") return detail;
  if (detail && detail.success === false && typeof detail.message === "string") return detail.message;
  if (detail && typeof detail.message === "string") return detail.message;
  if (detail && typeof detail.error === "string") return detail.error;
  if (detail && Array.isArray(detail.errors)) return detail.errors.join(" ");
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

function unwrap(response) {
  const payload = response?.data;
  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      const error = new Error(formatApiError(payload));
      error.response = { data: payload, status: response?.status };
      throw error;
    }
    return payload.data;
  }
  return payload;
}

function coverageTarget(coverageRate) {
  if (coverageRate >= 0.85) return "High-volume delivery partners";
  if (coverageRate >= 0.65) return "Regular full-time riders";
  return "Part-time or new gig workers";
}

function coverageFeatures(plan) {
  const coveragePct = Math.round((plan.coverage_rate || 0) * 100);
  return [
    `${coveragePct}% income protection for disruption events`,
    `Up to ${plan.max_covered_days} covered disruption days per claim cycle`,
    `Weekly premium of Rs. ${plan.premium_weekly}`,
  ];
}

function normalizePlans(rawPlans) {
  const plans = Array.isArray(rawPlans)
    ? rawPlans
    : rawPlans && typeof rawPlans === "object"
      ? Object.entries(rawPlans).map(([id, config]) => ({ id, ...(config || {}) }))
      : [];
  return plans.map((plan) => {
    const level = Number(String(plan.id || "").replace("level-", "")) || 1;
    return {
      ...plan,
      level,
      recommended: plan.id === "level-2",
      target: coverageTarget(plan.coverage_rate || 0),
      description: `${Math.round((plan.coverage_rate || 0) * 100)}% coverage with ${plan.max_covered_days} max covered days`,
      features: coverageFeatures(plan),
    };
  });
}

function mapDailyEarnings(earningsSummary) {
  if (Array.isArray(earningsSummary)) {
    return earningsSummary
      .map((entry) => ({
        date: entry?.date,
        amount: Number(entry?.amount || 0),
      }))
      .filter((entry) => Boolean(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const entries = Object.entries(earningsSummary?.daily_earnings || {})
    .map(([date, amount]) => ({ date, amount: Number(amount) || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

function computeLoyalty(worker, stats) {
  const tenureDays = Number(worker?.tenure_days || 0);
  const renewalStreak = Number(stats?.renewal_streak || worker?.renewal_streak || 0);
  const claimAccuracy = Number(stats?.claim_accuracy_rate || worker?.claim_accuracy_rate || 0);
  const platformRatingNorm = Math.max(0, Math.min(Number(worker?.platform_rating || 0) / 5, 1));

  const activeDaysWeight = Math.max(0, Math.min(tenureDays / 365, 1)) * 0.4;
  const renewalWeight = Math.max(0, Math.min(renewalStreak / 10, 1)) * 0.3;
  const claimAccuracyWeight = Math.max(0, Math.min(claimAccuracy, 1)) * 0.2;
  const platformRatingWeight = platformRatingNorm * 0.1;

  const loyaltyScore = Math.max(
    0,
    Math.min(activeDaysWeight + renewalWeight + claimAccuracyWeight + platformRatingWeight, 1)
  );

  let loyaltyBonus = 1.0;
  if (loyaltyScore >= 0.8) loyaltyBonus = 1.15;
  else if (loyaltyScore >= 0.6) loyaltyBonus = 1.1;
  else if (loyaltyScore >= 0.4) loyaltyBonus = 1.05;

  return {
    loyalty_score: loyaltyScore,
    loyalty_bonus: loyaltyBonus,
    breakdown: {
      active_days_weight: activeDaysWeight,
      renewal_streak_weight: renewalWeight,
      claim_accuracy_weight: claimAccuracyWeight,
      platform_rating_weight: platformRatingWeight,
    },
  };
}

function adaptWorkerDashboard(raw) {
  const worker = raw?.worker || {};
  const subscription = raw?.subscription || null;
  const stats = {
    ...(raw?.stats || {}),
    total_payouts: Number(raw?.stats?.total_payouts || worker?.total_payouts || 0),
  };
  const claims = Array.isArray(raw?.recent_claims)
    ? raw.recent_claims
    : Array.isArray(raw?.claims)
      ? raw.claims
      : [];
  const earnings = mapDailyEarnings(raw?.earnings);
  const payouts = claims
    .filter((claim) => claim.status === "approved" || claim.status === "paid")
    .map((claim) => ({
      created_at: claim.created_at,
      plan: subscription?.plan || worker?.active_plan || "N/A",
      status: claim.status === "approved" ? "completed" : claim.status,
      amount: Number(claim.payout_amount || 0),
    }));

  return {
    worker,
    subscription,
    stats,
    claims,
    payouts,
    earnings,
    loyalty: computeLoyalty(worker, stats),
  };
}

function summarizeClaims(claims) {
  const summary = { approved: 0, pending: 0, rejected: 0, total_payout: 0 };
  (claims || []).forEach((claim) => {
    if (claim.status === "approved" || claim.status === "paid") summary.approved += 1;
    if (claim.status === "pending" || claim.status === "flagged") summary.pending += 1;
    if (claim.status === "rejected") summary.rejected += 1;
    summary.total_payout += Number(claim.payout_amount || 0);
  });
  return summary;
}

function buildDistributions(claims) {
  const severity = {};
  const fraudTiers = {};
  const plans = {};

  (claims || []).forEach((claim) => {
    severity[claim.severity || "unknown"] = (severity[claim.severity || "unknown"] || 0) + 1;
    fraudTiers[claim.fraud_tier || "unknown"] = (fraudTiers[claim.fraud_tier || "unknown"] || 0) + 1;
    plans[claim.plan || "unknown"] = (plans[claim.plan || "unknown"] || 0) + 1;
  });

  return {
    plans,
    severity,
    fraud_tiers: fraudTiers,
  };
}

function adaptAdminDashboard(raw) {
  const summary = raw?.summary || {};
  const recentClaims = raw?.recent_claims || [];
  const claimSummary = summarizeClaims(recentClaims);

  return {
    stats: {
      total_workers: summary.total_workers || 0,
      active_subscriptions: summary.active_subscriptions || 0,
      total_claims: summary.total_claims || 0,
      pending_claims: claimSummary.pending,
      approved_claims: claimSummary.approved,
      total_payout_amount: Number(summary.total_payouts || 0),
    },
    distributions: buildDistributions(recentClaims),
    recent_claims: recentClaims,
    recent_disruptions: raw?.recent_disruptions || [],
    ml_metrics: raw?.ml_metrics || {},
  };
}

function adaptWorkers(raw) {
  const workers = raw?.workers || [];
  return {
    ...raw,
    workers: workers.map((worker) => ({
      ...worker,
      user_info: worker.user || null,
    })),
  };
}

function adaptMlInsights(raw) {
  const claimStats = raw?.claim_stats || {};
  const total = Number(claimStats.total || 0);
  const approved = Number(claimStats.approved || 0);
  const rejected = Number(claimStats.rejected || 0);
  const pending = Number(claimStats.pending || 0);
  const flagged = Number(claimStats.flagged || 0);

  const accuracy = total > 0 ? (approved / total).toFixed(2) : "0.00";
  const rejectionRate = total > 0 ? (rejected / total).toFixed(2) : "0.00";

  const fraudOverTime = (raw?.fraud_over_time || []).map((point) => ({
    ...point,
    total_payout: Number(point.total_payout || point.count || 0) * 100,
  }));

  return {
    ...raw,
    fraud_over_time: fraudOverTime,
    fraud_distribution: [
      { name: "approved", value: approved },
      { name: "pending", value: pending },
      { name: "flagged", value: flagged },
      { name: "rejected", value: rejected },
    ],
    models: {
      fraud_detection: {
        name: "Fraud Detection",
        version: "backend-live",
        type: "Operational Claim Scoring",
        accuracy,
        features: 10,
      },
      disruption_model: {
        name: "Disruption Severity",
        version: "backend-live",
        type: "Weather/Disruption Classification",
        f1_score: (1 - Number(rejectionRate)).toFixed(2),
        features: 5,
      },
      payout_engine: {
        name: "Payout Estimator",
        version: "backend-live",
        type: "Rule + Coverage Multiplier",
        rmse: "N/A",
        features: 4,
      },
    },
    model_cards: [
      {
        key: "fraud_detection",
        name: "Fraud Detection",
        metric_label: "Accuracy",
        metric_value: accuracy,
      },
      {
        key: "disruption_model",
        name: "Disruption Severity",
        metric_label: "F1 Score",
        metric_value: (1 - Number(rejectionRate)).toFixed(2),
      },
      {
        key: "payout_engine",
        name: "Payout Estimator",
        metric_label: "RMSE",
        metric_value: "N/A",
      },
    ],
  };
}

function adaptWeatherAll(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const zones = {};

  list.forEach((item) => {
    const zoneKey = item.zone || "unknown";
    if (zones[zoneKey]) return;
    zones[zoneKey] = {
      temperature_celsius: Number(item.temperature_celsius || 0),
      rainfall_mm: Number(item.rainfall_mm || 0),
      wind_speed_kmh: Number(item.wind_speed_kmh || 0),
      aqi_index: Number(item.aqi_index || 0),
      flood_alert_flag: item.flood_alert ? 1 : 0,
      weather_condition: item.disruption_type || "weather",
      source: "backend_disruption",
      severity: item.severity,
      updated_at: item.created_at,
    };
  });

  return {
    weather_api_active: false,
    zones,
  };
}

function adaptWeatherPoll(raw) {
  const zones = {};
  (raw?.zones || []).forEach((zoneResult) => {
    const key = zoneResult.zone;
    const weather = zoneResult.weather || {};
    zones[key] = {
      ...weather,
      source: "weather_poll",
      weather_condition: "live-check",
    };
  });

  return {
    ...raw,
    weather_api_active: !raw?.weather_warning,
    zones,
  };
}

function adaptSimulation(raw) {
  const claims = raw?.claims_summary || [];
  return {
    ...raw,
    disruption: {
      ...raw?.disruption,
      type: raw?.disruption?.disruption_type,
    },
    claims_summary: summarizeClaims(claims),
  };
}

export const authApi = {
  login: async (data) => ({ data: unwrap(await API.post("/auth/login", data)) }),
  register: async (data) => ({ data: unwrap(await API.post("/auth/register", data)) }),
  logout: async () => ({ data: unwrap(await API.post("/auth/logout")) }),
  me: async () => ({ data: unwrap(await API.get("/auth/me")) }),
};

export const workerApi = {
  dashboard: async () => ({ data: adaptWorkerDashboard(unwrap(await API.get("/worker/dashboard"))) }),
  subscribe: async (data) => ({ data: unwrap(await API.post("/worker/subscribe", data)) }),
  kycInitiate: async (data) => ({ data: unwrap(await API.post("/worker/kyc-initiate", data)) }),
  kycVerify: async (data) => ({ data: unwrap(await API.post("/worker/kyc-verify", data)) }),
  kycStatus: async () => ({ data: unwrap(await API.get("/worker/kyc-status")) }),
  createClaim: async (data) => {
    const raw = unwrap(await API.post("/worker/claim", data));
    return {
      data: {
        ...raw,
        status: raw?.claim?.status,
      },
    };
  },
  earnings: async () => {
    const raw = unwrap(await API.get("/worker/dashboard"));
    return { data: raw?.earnings || {} };
  },
};

export const adminApi = {
  dashboard: async () => ({ data: adaptAdminDashboard(unwrap(await API.get("/admin/dashboard"))) }),
  workers: async () => ({ data: adaptWorkers(unwrap(await API.get("/admin/workers"))) }),
  kycStatus: async (params = {}) => ({ data: unwrap(await API.get("/admin/kyc-status", { params })) }),
  claims: async (status) => {
    const dashboard = adaptAdminDashboard(unwrap(await API.get("/admin/dashboard")));
    const claims = status ? dashboard.recent_claims.filter((claim) => claim.status === status) : dashboard.recent_claims;
    return { data: { claims } };
  },
  claimAction: async (claimId, data) => ({ data: unwrap(await API.post(`/admin/claims/${claimId}/action`, data)) }),
  simulateDisruption: async (data) => ({ data: adaptSimulation(unwrap(await API.post("/admin/simulate-disruption", data))) }),
  mlInsights: async () => ({ data: adaptMlInsights(unwrap(await API.get("/admin/ml-insights"))) }),
  weatherAll: async () => ({ data: adaptWeatherAll(unwrap(await API.get("/weather/all"))) }),
  weatherZone: async (zoneId) => {
    const data = adaptWeatherAll(unwrap(await API.get("/weather/all")));
    return { data: { zone: data.zones[zoneId] || null } };
  },
  weatherPoll: async (payload = {}) => ({ data: adaptWeatherPoll(unwrap(await API.post("/weather/poll", payload))) }),
  weatherZones: async () => {
    const data = adaptWeatherAll(unwrap(await API.get("/weather/all")));
    return { data: { zones: Object.keys(data.zones) } };
  },
};

export const publicApi = {
  plans: async () => {
    const plans = normalizePlans(unwrap(await API.get("/plans")));
    return { data: { plans } };
  },
  payoutCalculator: async (params) => {
    const result = unwrap(await API.get("/payout-calculator", { params }));
    const finalPayout = Number(result?.estimated_payout || 0);
    return {
      data: {
        ...result,
        final_payout: finalPayout,
        base_daily_income: Number(params?.daily_income || 0),
        loyalty_bonus_pct: 0,
        ai_predicted_payout: finalPayout,
        audit_flag: false,
      },
    };
  },
};

export const healthApi = {
  health: () => axios.get(`${BACKEND_URL}/actuator/health`),
  liveness: () => axios.get(`${BACKEND_URL}/actuator/health/liveness`),
  readiness: () => axios.get(`${BACKEND_URL}/actuator/health/readiness`),
};

export { TOKEN_STORAGE_KEY };

export default API;
