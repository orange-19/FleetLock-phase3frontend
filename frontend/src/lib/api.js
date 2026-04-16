import axios from "axios";

const API = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// Token storage (in-memory for security)
let _accessToken = null;

export function setAccessToken(token) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function clearAccessToken() {
  _accessToken = null;
}

// Request interceptor - attach Bearer token
API.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const authApi = {
  login: (data) => API.post("/auth/login", data),
  register: (data) => API.post("/auth/register", data),
  logout: () => API.post("/auth/logout"),
  me: () => API.get("/auth/me"),
  refresh: () => API.post("/auth/refresh"),
};

export const workerApi = {
  dashboard: () => API.get("/worker/dashboard"),
  subscribe: (data) => API.post("/worker/subscribe", data),
  createClaim: (data) => API.post("/worker/claim", data),
  earnings: () => API.get("/worker/earnings"),
};

export const adminApi = {
  dashboard: () => API.get("/admin/dashboard"),
  workers: () => API.get("/admin/workers"),
  claims: (status) => API.get("/admin/claims", { params: status ? { status } : {} }),
  claimAction: (claimId, data) => API.post(`/admin/claims/${claimId}/action`, data),
  simulateDisruption: (data) => API.post("/admin/simulate-disruption", data),
  mlInsights: () => API.get("/admin/ml-insights"),
  weatherAll: () => API.get("/weather/all"),
  weatherZone: (zoneId) => API.get(`/weather/zone/${zoneId}`),
  weatherPoll: () => API.post("/weather/poll"),
  weatherZones: () => API.get("/weather/zones"),
};

export const publicApi = {
  plans: () => API.get("/plans"),
  payoutCalculator: (params) => API.get("/payout-calculator", { params }),
};

export default API;
