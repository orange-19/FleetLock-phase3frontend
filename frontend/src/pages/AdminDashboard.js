import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { adminApi } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Shield, LogOut, Users, FileCheck, Wallet, AlertTriangle, Activity, Brain, CloudRain, Loader2, Check, XCircle, Clock, Zap, Thermometer, Wind, Droplets, RefreshCw } from "lucide-react";

const COLORS = ["#10B981", "#F59E0B", "#E11D48", "#6366F1", "#06B6D4"];
const TEXTURE_IMG = "https://static.prod-images.emergentagent.com/jobs/18a26aff-e818-4e89-b6f8-37be1997a1f5/images/37a5bbb88980b4232e3a67899e052194b571b5824cfa630060dbe6db318caee4.png";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [mlInsights, setMlInsights] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherPolling, setWeatherPolling] = useState(false);
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
    } catch { /* pass */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSimulate = async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      const { data: res } = await adminApi.simulateDisruption(simForm);
      setSimResult(res);
      loadData();
    } catch (e) {
      setSimResult({ error: e.response?.data?.detail || "Simulation failed" });
    }
    setSimLoading(false);
  };

  const handleWeatherPoll = async () => {
    setWeatherPolling(true);
    try {
      await adminApi.weatherPoll();
      const wx = await adminApi.weatherAll();
      setWeatherData(wx.data);
    } catch { /* pass */ }
    setWeatherPolling(false);
  };

  const handleLogout = async () => { await logout(); navigate("/"); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  const stats = data?.stats || {};
  const dists = data?.distributions || {};
  const planData = Object.entries(dists.plans || {}).map(([k, v]) => ({ name: k, value: v }));
  const severityData = Object.entries(dists.severity || {}).map(([k, v]) => ({ name: k, value: v }));
  const fraudData = Object.entries(dists.fraud_tiers || {}).map(([k, v]) => ({ name: k.replace("_", " "), value: v }));

  return (
    <div className="min-h-screen bg-[#FAFAF9]" data-testid="admin-dashboard">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-emerald-600" />
          <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Outfit' }}>FleetLock</span>
          <Badge className="bg-red-100 text-red-700 border-0 ml-2 text-xs">Admin</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:inline">{user?.name || user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="admin-logout-btn">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Users, label: "Workers", value: stats.total_workers, color: "text-emerald-600" },
            { icon: Shield, label: "Active Subs", value: stats.active_subscriptions, color: "text-blue-600" },
            { icon: FileCheck, label: "Total Claims", value: stats.total_claims, color: "text-amber-600" },
            { icon: Clock, label: "Pending", value: stats.pending_claims, color: "text-orange-600" },
            { icon: Check, label: "Approved", value: stats.approved_claims, color: "text-emerald-600" },
            { icon: Wallet, label: "Total Payouts", value: `Rs. ${(stats.total_payout_amount || 0).toFixed(0)}`, color: "text-purple-600" },
          ].map((s, i) => (
            <Card key={i} className="border-gray-200 shadow-sm" data-testid={`admin-stat-${i}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <s.icon className={`w-5 h-5 ${s.color} opacity-50`} />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
                    <p className="text-xl font-bold text-[#022C22]" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white border border-gray-200">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="claims" data-testid="tab-claims">Claims</TabsTrigger>
            <TabsTrigger value="workers" data-testid="tab-workers">Workers</TabsTrigger>
            <TabsTrigger value="weather" data-testid="tab-weather">Weather</TabsTrigger>
            <TabsTrigger value="simulator" data-testid="tab-simulator">Simulator</TabsTrigger>
            <TabsTrigger value="ml" data-testid="tab-ml">ML Insights</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-gray-200 shadow-sm" data-testid="plan-distribution">
                <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ fontFamily: 'Outfit' }}>Plan Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-48 min-h-[192px]">
                    {planData.length > 0 && (
                    <ResponsiveContainer width="100%" height={192}>
                      <PieChart>
                        <Pie data={planData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    )}</div>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm" data-testid="severity-distribution">
                <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ fontFamily: 'Outfit' }}>Severity Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-48 min-h-[192px]">
                    {severityData.length > 0 && (
                    <ResponsiveContainer width="100%" height={192}>
                      <BarChart data={severityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {severityData.map((entry, i) => (
                            <Cell key={i} fill={entry.name === "high" ? "#E11D48" : entry.name === "medium" ? "#F59E0B" : "#10B981"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    )}</div>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm" data-testid="fraud-distribution">
                <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ fontFamily: 'Outfit' }}>Fraud Tier Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-48 min-h-[192px]">
                    {fraudData.length > 0 && (
                    <ResponsiveContainer width="100%" height={192}>
                      <PieChart>
                        <Pie data={fraudData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={({ name, value }) => `${value}`}>
                          {fraudData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    )}</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Claims */}
            <Card className="border-gray-200 shadow-sm mt-6" data-testid="recent-claims-table">
              <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ fontFamily: 'Outfit' }}>Recent Claims</CardTitle></CardHeader>
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
                    {(data?.recent_claims || []).slice(0, 10).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.worker_name || c.worker_id?.slice(0, 8)}</TableCell>
                        <TableCell className="capitalize">{c.disruption_type?.replace("_", " ")}</TableCell>
                        <TableCell className="text-sm text-gray-500">{c.zone}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${c.status === 'approved' || c.status === 'paid' ? 'border-emerald-300 text-emerald-700' : c.status === 'pending' ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}`}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-mono ${c.fraud_score < 0.35 ? 'text-emerald-600' : c.fraud_score <= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                            {(c.fraud_score * 100).toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize text-xs ${c.severity === 'high' ? 'border-red-300 text-red-700' : c.severity === 'medium' ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700'}`}>
                            {c.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">Rs. {c.payout_amount?.toFixed(0) || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Claims Tab */}
          <TabsContent value="claims">
            <Card className="border-gray-200 shadow-sm" data-testid="all-claims">
              <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ fontFamily: 'Outfit' }}>All Claims</CardTitle></CardHeader>
              <CardContent>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.recent_claims || []).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.worker_name || c.worker_id?.slice(0, 8)}</TableCell>
                        <TableCell className="capitalize">{c.disruption_type?.replace("_", " ")}</TableCell>
                        <TableCell className="text-sm text-gray-500">{c.zone}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize text-xs ${c.status === 'approved' || c.status === 'paid' ? 'border-emerald-300 text-emerald-700' : c.status === 'pending' ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}`}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell><span className="font-mono text-sm">{(c.fraud_score * 100).toFixed(0)}%</span></TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded ${c.fraud_tier === 'auto_approve' ? 'fraud-auto-approve' : c.fraud_tier === 'flag_review' ? 'fraud-flag-review' : 'fraud-auto-reject'}`}>
                            {c.fraud_tier?.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={c.severity === 'high' ? 'severity-high' : c.severity === 'medium' ? 'severity-medium' : 'severity-low'}>
                            {c.severity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">Rs. {c.payout_amount?.toFixed(0) || 0}</TableCell>
                        <TableCell className="text-xs text-gray-400">{c.created_at?.slice(0, 10)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workers Tab */}
          <TabsContent value="workers">
            <Card className="border-gray-200 shadow-sm" data-testid="workers-table">
              <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ fontFamily: 'Outfit' }}>All Workers</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Avg Income</TableHead>
                      <TableHead>Tenure</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Claims</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workers.map((w, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{w.user_info?.name || w.user_id?.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{w.platform}</Badge></TableCell>
                        <TableCell>{w.city}</TableCell>
                        <TableCell className="text-sm text-gray-500">{w.zone}</TableCell>
                        <TableCell><Badge className={`text-xs border-0 capitalize ${w.active_plan ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{w.active_plan || "None"}</Badge></TableCell>
                        <TableCell className="font-mono">Rs. {w.daily_income_avg?.toFixed(0)}</TableCell>
                        <TableCell>{w.tenure_days}d</TableCell>
                        <TableCell>{w.platform_rating}/5</TableCell>
                        <TableCell>{w.total_claims}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Weather Tab */}
          <TabsContent value="weather">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#022C22]" style={{ fontFamily: 'Outfit' }}>Live Weather Data</h3>
                  <p className="text-sm text-gray-500">Real-time weather monitoring across all zones {weatherData?.weather_api_active ? <Badge className="bg-emerald-100 text-emerald-700 border-0 ml-2 text-xs">API Active</Badge> : <Badge className="bg-amber-100 text-amber-700 border-0 ml-2 text-xs">Fallback Mode</Badge>}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleWeatherPoll} disabled={weatherPolling} data-testid="weather-poll-btn">
                  {weatherPolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh All Zones
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(weatherData?.zones || {}).map(([zoneId, wx]) => (
                  <Card key={zoneId} className="border-gray-200 shadow-sm card-hover" data-testid={`weather-zone-${zoneId}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-[#022C22] text-sm" style={{ fontFamily: 'Outfit' }}>{zoneId.replace("_", " ")}</h4>
                        <Badge variant="outline" className={`text-xs ${wx.source === 'openweathermap_live' ? 'border-emerald-300 text-emerald-700' : 'border-gray-300 text-gray-500'}`}>
                          {wx.source === 'openweathermap_live' ? 'Live' : 'Simulated'}
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
                            <p className={`text-sm font-bold ${wx.aqi_index > 200 ? 'text-red-600' : wx.aqi_index > 100 ? 'text-amber-600' : 'text-emerald-600'}`}>{wx.aqi_index}</p>
                          </div>
                        </div>
                      </div>
                      {wx.weather_condition && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                          {wx.weather_condition} {wx.flood_alert_flag ? <Badge className="bg-red-100 text-red-700 border-0 ml-1">Flood Alert</Badge> : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {Object.keys(weatherData?.zones || {}).length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-400">
                    <CloudRain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No weather data yet. Click "Refresh All Zones" to fetch.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Simulator Tab */}
          <TabsContent value="simulator">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-gray-200 shadow-sm relative overflow-hidden" data-testid="disruption-simulator">
                <div className="absolute inset-0 opacity-5">
                  <img src={TEXTURE_IMG} alt="" className="w-full h-full object-cover" />
                </div>
                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                    <CloudRain className="w-5 h-5 text-emerald-600" /> Disruption Simulator
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Zone</Label>
                      <Select value={simForm.zone} onValueChange={(v) => setSimForm(f => ({...f, zone: v}))}>
                        <SelectTrigger data-testid="sim-zone"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Mumbai_Central", "Mumbai_South", "Chennai_North", "Chennai_South", "Bengaluru_East", "Bengaluru_West", "Hyderabad_Central", "Delhi_North"].map(z => (
                            <SelectItem key={z} value={z}>{z.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={simForm.disruption_type} onValueChange={(v) => setSimForm(f => ({...f, disruption_type: v}))}>
                        <SelectTrigger data-testid="sim-type"><SelectValue /></SelectTrigger>
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
                    <Slider value={[simForm.rainfall_mm]} onValueChange={(v) => setSimForm(f => ({...f, rainfall_mm: v[0]}))} min={0} max={200} step={5} data-testid="sim-rainfall" />
                  </div>
                  <div>
                    <Label>Temperature: {simForm.temperature_celsius}&deg;C</Label>
                    <Slider value={[simForm.temperature_celsius]} onValueChange={(v) => setSimForm(f => ({...f, temperature_celsius: v[0]}))} min={15} max={50} step={1} />
                  </div>
                  <div>
                    <Label>AQI: {simForm.aqi_index}</Label>
                    <Slider value={[simForm.aqi_index]} onValueChange={(v) => setSimForm(f => ({...f, aqi_index: v[0]}))} min={0} max={500} step={10} />
                  </div>
                  <div>
                    <Label>Wind Speed: {simForm.wind_speed_kmh} km/h</Label>
                    <Slider value={[simForm.wind_speed_kmh]} onValueChange={(v) => setSimForm(f => ({...f, wind_speed_kmh: v[0]}))} min={0} max={120} step={5} />
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSimulate} disabled={simLoading} data-testid="sim-run-btn">
                    {simLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Run Simulation
                  </Button>
                </CardContent>
              </Card>

              {/* Sim Results */}
              <Card className="border-gray-200 shadow-sm" data-testid="sim-results">
                <CardHeader>
                  <CardTitle className="text-sm" style={{ fontFamily: 'Outfit' }}>Simulation Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {simResult && !simResult.error ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Zone</span>
                            <p className="font-medium">{simResult.disruption?.zone}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Type</span>
                            <p className="font-medium capitalize">{simResult.disruption?.type?.replace("_", " ")}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Severity</span>
                            <p className={`font-bold capitalize ${simResult.disruption?.severity === 'high' ? 'text-red-600' : simResult.disruption?.severity === 'medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
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
                        <p className="text-3xl font-bold text-emerald-700" style={{ fontFamily: 'Outfit' }}>Rs. {simResult.claims_summary?.total_payout?.toFixed(0)}</p>
                      </div>
                    </div>
                  ) : simResult?.error ? (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{typeof simResult.error === 'string' ? simResult.error : JSON.stringify(simResult.error)}</div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <CloudRain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Run a simulation to see results</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ML Insights Tab */}
          <TabsContent value="ml">
            <div className="space-y-6">
              {/* ML Models */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {mlInsights && Object.values(mlInsights.models || {}).map((m, i) => (
                  <Card key={i} className="border-gray-200 shadow-sm" data-testid={`ml-model-${i}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-5 h-5 text-emerald-600" />
                        <Badge variant="outline" className="text-xs">{m.version}</Badge>
                      </div>
                      <h3 className="font-bold text-[#022C22] mb-1" style={{ fontFamily: 'Outfit' }}>{m.name}</h3>
                      <p className="text-xs text-gray-500 mb-4">{m.type}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{m.accuracy ? "Accuracy" : m.rmse ? "RMSE" : "F1 Score"}</span>
                          <span className="font-mono font-bold text-emerald-600">{m.accuracy || m.rmse || m.f1_score}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Features</span>
                          <span className="font-mono">{m.features}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Fraud Over Time Chart */}
              <Card className="border-gray-200 shadow-sm" data-testid="fraud-over-time">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm" style={{ fontFamily: 'Outfit' }}>Fraud Score & Payouts Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 min-h-[256px]">
                    {(mlInsights?.fraud_over_time || []).length > 0 && (
                    <ResponsiveContainer width="100%" height={256}>
                      <LineChart data={mlInsights?.fraud_over_time || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="avg_fraud_score" stroke="#E11D48" name="Avg Fraud Score" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="total_payout" stroke="#10B981" name="Total Payout (Rs.)" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                    )}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
