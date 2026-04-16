# FleetLock — AI-Powered Parametric Income Insurance for India's Gig Economy

## Original Problem Statement
Build a full-stack FleetLock platform for parametric income insurance targeting India's 12M+ gig delivery workers. Features: JWT auth, rule-based ML models (fraud detection, payout audit, disruption severity), 3 insurance plan tiers, claim lifecycle, disruption simulator, worker & admin dashboards.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React 19 + TailwindCSS + Shadcn UI + Recharts
- **Auth**: JWT with httpOnly cookies, admin+worker roles
- **ML Models**: Simulated rule-based (Fraud XGBoost+RF ensemble, Payout audit regressor, Disruption severity classifier)
- **Database**: MongoDB with collections: users, workers, claims, payouts, subscriptions, earnings, disruptions

## User Personas
1. **Worker (Ravi Kumar)**: Delivery partner on Zomato/Swiggy, earns Rs.600-1000/day, needs income protection
2. **Admin**: Platform administrator managing claims, monitoring disruptions, reviewing ML insights

## Core Requirements (Implemented)
- [x] Landing page with hero, features, plans, formula section
- [x] JWT authentication (register, login, logout, refresh)
- [x] Worker dashboard (earnings chart, claims, payouts, loyalty score, plan info)
- [x] Admin dashboard (stats, charts, claims table, workers table)
- [x] Insurance plans page (Sahara Rs.29, Kavach Rs.59, Suraksha Rs.99)
- [x] Payout calculator with deterministic formula
- [x] Fraud detection engine (simulated ensemble scoring)
- [x] Disruption severity classifier (rule-based)
- [x] Disruption simulator (admin)
- [x] ML insights panel (model cards, fraud over time)
- [x] Demo data seeding (12 workers with earnings/claims/subscriptions)
- [x] Claim lifecycle (auto-approve/flag/reject based on fraud score)
- [x] Loyalty score computation (4 weighted inputs)
- [x] Brute force protection

## What's Been Implemented (April 2026)
- Full backend with 15+ API endpoints
- 6 frontend pages (Landing, Auth, Worker Dashboard, Admin Dashboard, Plans, Payout Calculator)
- Light green trust theme with Outfit/Manrope fonts
- Responsive design with glassmorphic nav
- Recharts data visualizations (bar, line, pie)

## Prioritized Backlog
### P0 (Critical)
- Real OpenWeatherMap API integration (user has key)
- Auto-trigger claims from weather data

### P1 (High)
- Worker claim photo upload for medium flag verification
- WebSocket real-time notifications
- Stripe integration for premium collection

### P2 (Medium)
- Admin claim approve/reject UI buttons
- Worker profile editing
- Real ML model training pipeline
- Email/SMS notifications via Twilio
- KYC verification flow

### P3 (Low)
- Localization (Hindi, Tamil, Telugu)
- PWA support for mobile workers
- API rate limiting
- Monitoring/observability stack
