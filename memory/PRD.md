# FleetLock — AI-Powered Parametric Income Insurance

## Original Problem Statement
Build FleetLock platform for parametric income insurance targeting India's gig workers. Full-stack with JWT auth, ML models, 3 insurance tiers, claim lifecycle, disruption simulator, worker & admin dashboards. Integrate weather_client.py, telematics_client.py, weather_poller.py from user artifacts.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor) with integrations/ and scheduler/ modules
- **Frontend**: React 19 + TailwindCSS + Shadcn UI + Recharts
- **Auth**: JWT Bearer tokens (localStorage), admin+worker roles
- **ML Models**: Simulated rule-based (Fraud, Payout, Disruption Severity)
- **Integrations**: WeatherClient (OpenWeatherMap/fallback), TelematicsClient (GPS features), WeatherPoller (cache)

## What's Been Implemented (April 2026)
- [x] Full backend with 20+ API endpoints including weather/telematics
- [x] 6 frontend pages with professional light-green trust theme
- [x] JWT Bearer token auth (register/login/me/logout)
- [x] Plans: Level-1 (Rs.29), Level-2 (Rs.59), Level-3 (Rs.99)
- [x] WeatherClient with OpenWeatherMap + fallback
- [x] TelematicsClient for GPS fraud features
- [x] WeatherPoller with in-memory cache
- [x] Admin Weather tab with zone monitoring
- [x] Disruption Simulator with auto-claim creation
- [x] ML Insights panel with model cards
- [x] Payout Calculator with deterministic formula
- [x] 12 demo workers with 60-day earnings data

## Prioritized Backlog
### P0: Add OPENWEATHER_API_KEY for live weather data
### P1: Admin claim approve/reject buttons, WebSocket notifications
### P2: Worker profile editing, Stripe payments, email notifications
### P3: Localization, PWA, rate limiting, monitoring
