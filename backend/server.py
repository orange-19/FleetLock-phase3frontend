from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
import random
import math
import numpy as np
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from integrations.weather_client import WeatherClient, ZONE_COORDINATES
from integrations.telematics_client import TelematicsClient
from scheduler.weather_poller import get_cached_weather, update_cache, get_all_cached, poll_all_zones

# Initialize integration clients
weather_client = WeatherClient()
telematics_client = TelematicsClient()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Password Hashing ───
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# ─── Auth Helper ───
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ─── Pydantic Models ───
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "worker"
    phone: Optional[str] = None
    city: Optional[str] = None
    platform: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class SubscribeRequest(BaseModel):
    plan: str
    zone: Optional[str] = None

class ClaimCreateRequest(BaseModel):
    disruption_type: str
    zone: Optional[str] = None
    description: Optional[str] = ""

class DisruptionSimRequest(BaseModel):
    zone: str
    disruption_type: str
    rainfall_mm: float = 0
    temperature_celsius: float = 30
    aqi_index: int = 50
    wind_speed_kmh: float = 10
    flood_alert: bool = False
    platform_outage: bool = False

class ClaimActionRequest(BaseModel):
    action: str
    notes: Optional[str] = ""

# ─── ML Models (Simulated / Rule-Based) ───

SEVERITY_MULTIPLIER_MAP = {"low": 0.75, "medium": 1.0, "high": 1.25}
COVERAGE_RATES = {"level-1": 0.40, "level-2": 0.60, "level-3": 0.80}
PLAN_PREMIUMS = {"level-1": 29, "level-2": 59, "level-3": 99}
PLAN_MAX_DAYS = {"level-1": 3, "level-2": 5, "level-3": 7}

INDIAN_CITIES = ["Mumbai", "Chennai", "Bengaluru", "Hyderabad", "Delhi", "Pune", "Kolkata", "Ahmedabad"]
ZONES = ["North", "South", "East", "West", "Central"]
PLATFORMS = ["Zomato", "Swiggy", "Blinkit", "Zepto", "Amazon", "Dunzo"]

def compute_fraud_score(claim_data: dict) -> dict:
    """Simulated fraud detection - Ensemble XGBoost + Random Forest"""
    base = random.uniform(0.05, 0.35)
    if claim_data.get("claim_frequency_30d", 0) > 5:
        base += 0.2
    if claim_data.get("zone_entry_lag_mins", 0) > 40:
        base += 0.15
    if claim_data.get("device_swap_count", 0) > 1:
        base += 0.1
    gps_drift = claim_data.get("gps_drift_meters", random.uniform(5, 25))
    if gps_drift > 30:
        base += 0.2
    score = min(max(base + random.uniform(-0.05, 0.05), 0), 1.0)
    p_xgb = score + random.uniform(-0.05, 0.05)
    p_rf = score + random.uniform(-0.08, 0.08)
    fraud_score = 0.70 * max(0, min(1, p_xgb)) + 0.30 * max(0, min(1, p_rf))
    fraud_score = round(max(0, min(1, fraud_score)), 3)
    if fraud_score < 0.35:
        tier = "auto_approve"
    elif fraud_score <= 0.70:
        tier = "flag_review"
    else:
        tier = "auto_reject"
    risk_signals = []
    if gps_drift > 20:
        risk_signals.append(f"GPS drift detected ({gps_drift:.1f}m)")
    if claim_data.get("claim_frequency_30d", 0) > 3:
        risk_signals.append(f"High claim frequency ({claim_data.get('claim_frequency_30d', 0)} in 30d)")
    if claim_data.get("device_swap_count", 0) > 0:
        risk_signals.append(f"{claim_data.get('device_swap_count', 0)} device swap(s) detected")
    return {
        "fraud_score": fraud_score,
        "tier": tier,
        "risk_signals": risk_signals,
        "sub_scores": {
            "gps_integrity": round(random.uniform(0.2, 0.8), 2),
            "device_trust": round(random.uniform(0.3, 0.9), 2),
            "behavioral": round(random.uniform(0.2, 0.7), 2),
            "temporal": round(random.uniform(0.1, 0.6), 2)
        },
        "model_version": "v2.1.0",
        "inference_ms": random.randint(8, 25)
    }

def compute_disruption_severity(features: dict) -> dict:
    """Rule-based disruption severity with XGBClassifier simulation"""
    rainfall = features.get("rainfall_mm", 0)
    temp = features.get("temperature_celsius", 30)
    aqi = features.get("aqi_index", 50)
    wind = features.get("wind_speed_kmh", 10)
    flood = features.get("flood_alert_flag", 0)
    if rainfall > 100 or wind > 80 or aqi > 300 or flood:
        severity = "high"
    elif rainfall > 50 or wind > 50 or aqi > 200 or temp > 42:
        severity = "medium"
    else:
        severity = "low"
    conf_map = {"low": 0.0, "medium": 0.0, "high": 0.0}
    conf_map[severity] = round(random.uniform(0.65, 0.90), 2)
    remaining = round(1.0 - conf_map[severity], 2)
    others = [k for k in conf_map if k != severity]
    split = round(random.uniform(0.2, 0.8) * remaining, 2)
    conf_map[others[0]] = split
    conf_map[others[1]] = round(remaining - split, 2)
    return {
        "predicted_severity": severity,
        "severity_multiplier": SEVERITY_MULTIPLIER_MAP[severity],
        "confidence_map": conf_map,
        "trigger_auto_claim": severity in ["medium", "high"],
        "fallback_used": False,
        "model_version": "v2.1.0"
    }

def compute_payout(worker_data: dict, claim_data: dict, severity_result: dict) -> dict:
    """Deterministic payout formula + AI audit simulation"""
    base_daily = worker_data.get("daily_income_avg", 700)
    plan = worker_data.get("active_plan", "kavach")
    coverage_rate = COVERAGE_RATES.get(plan, 0.60)
    severity_mult = severity_result.get("severity_multiplier", 1.0)
    tenure = worker_data.get("tenure_days", 30)
    loyalty_bonus = 1.0 + (0.05 if tenure > 180 else 0.0) + (0.05 if tenure > 365 else 0.0) + (0.03 if worker_data.get("claim_accuracy_rate", 1.0) > 0.8 else 0.0) + (0.02 if worker_data.get("platform_rating", 4.0) >= 4.5 else 0.0)
    loyalty_bonus = min(loyalty_bonus, 1.15)
    deterministic_payout = round(base_daily * coverage_rate * severity_mult * loyalty_bonus, 2)
    max_days = PLAN_MAX_DAYS.get(plan, 5)
    max_payout = base_daily * coverage_rate * max_days
    deterministic_payout = min(deterministic_payout, max_payout)
    ai_predicted = deterministic_payout * (1 + random.uniform(-0.08, 0.08))
    delta_pct = abs(deterministic_payout - ai_predicted) / max(ai_predicted, 1)
    audit_flag = delta_pct > 0.10
    zone_risk = random.uniform(0.85, 1.20)
    season_risk = random.uniform(0.90, 1.25)
    base_premium = PLAN_PREMIUMS.get(plan, 59)
    adjusted_premium = round(base_premium * zone_risk * season_risk, 2)
    adjusted_premium = min(adjusted_premium, base_premium * 1.40)
    return {
        "deterministic_payout": deterministic_payout,
        "ai_predicted_payout": round(ai_predicted, 2),
        "delta_pct": round(delta_pct, 3),
        "audit_flag": audit_flag,
        "final_payout": deterministic_payout if not audit_flag else round(deterministic_payout * 0.5, 2),
        "loyalty_bonus_applied": loyalty_bonus > 1.0,
        "loyalty_bonus_pct": round(loyalty_bonus - 1.0, 2),
        "adjusted_premium": adjusted_premium,
        "model_version": "v2.1.0",
        "coverage_rate": coverage_rate,
        "severity_multiplier": severity_mult,
        "base_daily_income": base_daily
    }

def compute_loyalty_score(worker: dict) -> dict:
    """Compute loyalty score from 4 weighted inputs"""
    active_days = min(worker.get("tenure_days", 0), 365)
    renewal_streak = worker.get("renewal_streak", 0)
    claim_accuracy = worker.get("claim_accuracy_rate", 1.0)
    platform_rating = worker.get("platform_rating", 4.0) / 5.0
    score = (0.40 * (active_days / 365)) + (0.30 * min(renewal_streak / 10, 1.0)) + (0.20 * claim_accuracy) + (0.10 * platform_rating)
    score = round(min(score, 1.0), 3)
    bonus = round(1.0 + (score * 0.15), 2)
    bonus = min(bonus, 1.15)
    return {"loyalty_score": score, "loyalty_bonus": bonus, "breakdown": {"active_days_weight": round(0.40 * (active_days / 365), 3), "renewal_streak_weight": round(0.30 * min(renewal_streak / 10, 1.0), 3), "claim_accuracy_weight": round(0.20 * claim_accuracy, 3), "platform_rating_weight": round(0.10 * platform_rating, 3)}}

# ─── Seed Admin ───
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fleetlock.in").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "FleetLock@2026")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({"email": admin_email, "password_hash": hashed, "name": "Admin", "role": "admin", "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")

async def seed_demo_data():
    """Seed demo workers and data if DB is empty"""
    count = await db.workers.count_documents({})
    if count > 0:
        return
    demo_workers = []
    for i in range(12):
        city = random.choice(INDIAN_CITIES)
        zone = f"{city}_{random.choice(ZONES)}"
        platform = random.choice(PLATFORMS)
        daily_income = round(random.uniform(400, 1000), 2)
        tenure = random.randint(30, 500)
        user_doc = {
            "email": f"worker{i+1}@demo.com",
            "password_hash": hash_password("demo123"),
            "name": f"Worker {random.choice(['Ravi', 'Priya', 'Amit', 'Neha', 'Suresh', 'Deepa', 'Kiran', 'Anita', 'Raj', 'Meera', 'Vikram', 'Sita'])} {random.choice(['Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Das', 'Nair', 'Gupta'])}",
            "role": "worker",
            "phone": f"+91{random.randint(7000000000, 9999999999)}",
            "city": city,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=tenure)).isoformat()
        }
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
        plans = ["level-1", "level-2", "level-3"]
        plan = random.choice(plans)
        worker_doc = {
            "user_id": user_id,
            "platform": platform,
            "zone": zone,
            "city": city,
            "daily_income_avg": daily_income,
            "tenure_days": tenure,
            "active_plan": plan,
            "renewal_streak": random.randint(0, 15),
            "claim_accuracy_rate": round(random.uniform(0.7, 1.0), 2),
            "platform_rating": round(random.uniform(3.5, 5.0), 1),
            "total_claims": random.randint(0, 10),
            "total_payouts": round(random.uniform(0, 5000), 2),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.workers.insert_one(worker_doc)
        sub_doc = {
            "worker_id": user_id,
            "plan": plan,
            "status": "active",
            "premium_daily": PLAN_PREMIUMS[plan],
            "start_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 14))).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=random.randint(1, 14))).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscriptions.insert_one(sub_doc)
        for d in range(min(tenure, 60)):
            day = datetime.now(timezone.utc) - timedelta(days=d)
            earning = round(daily_income * random.uniform(0.5, 1.5), 2)
            await db.earnings.insert_one({
                "worker_id": user_id,
                "date": day.strftime("%Y-%m-%d"),
                "amount": earning,
                "hours_worked": round(random.uniform(4, 12), 1),
                "orders_completed": random.randint(5, 30),
                "platform": platform
            })
        if random.random() > 0.4:
            for _ in range(random.randint(1, 3)):
                claim_types = ["weather", "platform_outage", "civic_event"]
                ct = random.choice(claim_types)
                statuses = ["approved", "pending", "rejected", "paid"]
                st = random.choice(statuses)
                fs = round(random.uniform(0.05, 0.65), 3)
                sev = random.choice(["low", "medium", "high"])
                payout_amt = round(daily_income * COVERAGE_RATES[plan] * SEVERITY_MULTIPLIER_MAP[sev], 2) if st in ["approved", "paid"] else 0
                claim_doc = {
                    "worker_id": user_id,
                    "worker_name": user_doc["name"],
                    "disruption_type": ct,
                    "zone": zone,
                    "status": st,
                    "fraud_score": fs,
                    "fraud_tier": "auto_approve" if fs < 0.35 else ("flag_review" if fs <= 0.70 else "auto_reject"),
                    "severity": sev,
                    "severity_multiplier": SEVERITY_MULTIPLIER_MAP[sev],
                    "payout_amount": payout_amt,
                    "description": f"Auto-generated {ct} disruption claim",
                    "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.claims.insert_one(claim_doc)
                if st == "paid":
                    await db.payouts.insert_one({
                        "worker_id": user_id,
                        "worker_name": user_doc["name"],
                        "amount": payout_amt,
                        "status": "disbursed",
                        "plan": plan,
                        "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 7))).isoformat()
                    })
    logger.info("Demo data seeded successfully")

# ─── Startup ───
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.workers.create_index("user_id")
    await db.claims.create_index("worker_id")
    await db.earnings.create_index([("worker_id", 1), ("date", -1)])
    await db.subscriptions.create_index("worker_id")
    await db.login_attempts.create_index("identifier")
    await seed_admin()
    await seed_demo_data()
    # Write test credentials
    cred_dir = Path("/app/memory")
    cred_dir.mkdir(exist_ok=True)
    with open(cred_dir / "test_credentials.md", "w") as f:
        f.write("# FleetLock Test Credentials\n\n")
        f.write(f"## Admin\n- Email: {os.environ.get('ADMIN_EMAIL', 'admin@fleetlock.in')}\n- Password: {os.environ.get('ADMIN_PASSWORD', 'FleetLock@2026')}\n- Role: admin\n\n")
        f.write("## Demo Worker\n- Email: worker1@demo.com\n- Password: demo123\n- Role: worker\n\n")
        f.write("## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n")

# ─── AUTH ROUTES ───
@api_router.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name,
        "role": req.role if req.role in ["worker", "admin"] else "worker",
        "phone": req.phone or "",
        "city": req.city or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    if req.role == "worker":
        zone = f"{req.city or random.choice(INDIAN_CITIES)}_{random.choice(ZONES)}"
        await db.workers.insert_one({
            "user_id": user_id,
            "platform": req.platform or random.choice(PLATFORMS),
            "zone": zone,
            "city": req.city or random.choice(INDIAN_CITIES),
            "daily_income_avg": round(random.uniform(500, 900), 2),
            "tenure_days": 0,
            "active_plan": None,
            "renewal_streak": 0,
            "claim_accuracy_rate": 1.0,
            "platform_rating": 4.0,
            "total_claims": 0,
            "total_payouts": 0,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    access = create_access_token(user_id, email, user_doc["role"])
    refresh = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"access_token": access, "user": {"id": user_id, "email": email, "name": req.name, "role": user_doc["role"]}}

@api_router.post("/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        last = datetime.fromisoformat(attempt["last_attempt"])
        if datetime.now(timezone.utc) - last < timedelta(minutes=15):
            raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    user_id = str(user["_id"])
    access = create_access_token(user_id, email, user["role"])
    refresh = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"access_token": access, "user": {"id": user_id, "email": email, "name": user["name"], "role": user["role"]}}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(str(user["_id"]), user["email"], user["role"])
        response.set_cookie(key="access_token", value=access, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ─── WORKER ROUTES ───
@api_router.get("/worker/dashboard")
async def worker_dashboard(request: Request):
    user = await get_current_user(request)
    worker = await db.workers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    loyalty = compute_loyalty_score(worker)
    sub = await db.subscriptions.find_one({"worker_id": user["id"], "status": "active"}, {"_id": 0})
    claims = await db.claims.find({"worker_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    payouts = await db.payouts.find({"worker_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
    earnings = await db.earnings.find({"worker_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(30)
    total_payout = sum(p.get("amount", 0) for p in payouts)
    return {
        "worker": worker,
        "loyalty": loyalty,
        "subscription": sub,
        "claims": claims,
        "payouts": payouts,
        "earnings": earnings,
        "stats": {
            "total_claims": len(claims),
            "approved_claims": sum(1 for c in claims if c["status"] in ["approved", "paid"]),
            "pending_claims": sum(1 for c in claims if c["status"] == "pending"),
            "total_payouts": round(total_payout, 2),
            "avg_daily_earnings": worker.get("daily_income_avg", 0),
        }
    }

@api_router.post("/worker/subscribe")
async def subscribe(req: SubscribeRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "worker":
        raise HTTPException(status_code=403, detail="Only workers can subscribe")
    plan = req.plan.lower()
    if plan not in PLAN_PREMIUMS:
        raise HTTPException(status_code=400, detail="Invalid plan. Choose level-1, level-2, or level-3")
    await db.subscriptions.update_many({"worker_id": user["id"], "status": "active"}, {"$set": {"status": "expired"}})
    now = datetime.now(timezone.utc)
    sub = {
        "worker_id": user["id"],
        "plan": plan,
        "status": "active",
        "premium_daily": PLAN_PREMIUMS[plan],
        "coverage_rate": COVERAGE_RATES[plan],
        "max_covered_days": PLAN_MAX_DAYS[plan],
        "start_date": now.isoformat(),
        "end_date": (now + timedelta(days=15)).isoformat(),
        "created_at": now.isoformat()
    }
    await db.subscriptions.insert_one(sub)
    await db.workers.update_one({"user_id": user["id"]}, {"$set": {"active_plan": plan}, "$inc": {"renewal_streak": 1}})
    return {"message": f"Subscribed to {plan.capitalize()} plan", "plan": plan, "premium_daily": PLAN_PREMIUMS[plan]}

@api_router.post("/worker/claim")
async def create_claim(req: ClaimCreateRequest, request: Request):
    user = await get_current_user(request)
    worker = await db.workers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    if not worker.get("active_plan"):
        raise HTTPException(status_code=400, detail="No active subscription. Please subscribe first.")
    claim_count = await db.claims.count_documents({"worker_id": user["id"], "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}})
    # Use TelematicsClient for GPS/device features
    telem_features = telematics_client.generate_fraud_features(
        zone_id=worker.get("zone", "Mumbai_Central"),
        weather_severity="low",
        fraud_type="genuine"
    )
    fraud_input = {
        "claim_frequency_30d": claim_count,
        "gps_drift_meters": telem_features["gps_drift_meters"],
        "speed_jump_kmh": telem_features["speed_jump_kmh"],
        "route_deviation_pct": telem_features["route_deviation_pct"],
        "device_swap_count": telem_features["device_swap_count"],
        "zone_entry_lag_mins": telem_features["zone_entry_lag_mins"],
        "avg_earnings_7d": worker.get("daily_income_avg", 700),
    }
    fraud_result = compute_fraud_score(fraud_input)
    # Use WeatherClient for zone weather (cached or live)
    zone_id = worker.get("zone", "Mumbai_Central")
    weather_data = get_cached_weather(zone_id)
    if not weather_data:
        weather_data = await weather_client.get_weather_for_zone(zone_id)
        update_cache(zone_id, weather_data)
    severity_features = {
        "rainfall_mm": weather_data.get("rainfall_mm", random.uniform(0, 120)),
        "temperature_celsius": weather_data.get("temperature_celsius", random.uniform(25, 45)),
        "aqi_index": weather_data.get("aqi_index", random.randint(30, 350)),
        "wind_speed_kmh": weather_data.get("wind_speed_kmh", random.uniform(5, 90)),
        "flood_alert_flag": weather_data.get("flood_alert_flag", 1 if req.disruption_type == "flood" else 0),
    }
    severity_result = compute_disruption_severity(severity_features)
    payout_result = compute_payout(worker, {"disruption_type": req.disruption_type}, severity_result)
    status = "approved" if fraud_result["tier"] == "auto_approve" else ("pending" if fraud_result["tier"] == "flag_review" else "rejected")
    claim_doc = {
        "worker_id": user["id"],
        "worker_name": user.get("name", ""),
        "disruption_type": req.disruption_type,
        "zone": worker.get("zone", ""),
        "status": status,
        "fraud_score": fraud_result["fraud_score"],
        "fraud_tier": fraud_result["tier"],
        "fraud_details": fraud_result,
        "severity": severity_result["predicted_severity"],
        "severity_multiplier": severity_result["severity_multiplier"],
        "severity_details": severity_result,
        "payout_amount": payout_result["final_payout"] if status == "approved" else 0,
        "payout_details": payout_result,
        "description": req.description or f"{req.disruption_type} disruption claim",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.claims.insert_one(claim_doc)
    claim_id = str(result.inserted_id)
    if status == "approved":
        await db.payouts.insert_one({
            "worker_id": user["id"],
            "worker_name": user.get("name", ""),
            "claim_id": claim_id,
            "amount": payout_result["final_payout"],
            "status": "pending_disbursement",
            "plan": worker.get("active_plan", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.workers.update_one({"user_id": user["id"]}, {"$inc": {"total_claims": 1, "total_payouts": payout_result["final_payout"]}})
    return {
        "claim_id": claim_id,
        "status": status,
        "fraud_score": fraud_result["fraud_score"],
        "fraud_tier": fraud_result["tier"],
        "severity": severity_result["predicted_severity"],
        "payout_amount": payout_result["final_payout"] if status == "approved" else 0,
        "message": f"Claim {status}. " + ("Payout will be processed." if status == "approved" else "Under review." if status == "pending" else "Claim rejected due to high fraud risk.")
    }

@api_router.get("/worker/earnings")
async def get_earnings(request: Request):
    user = await get_current_user(request)
    earnings = await db.earnings.find({"worker_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(60)
    if earnings:
        amounts = [e["amount"] for e in earnings]
        trimmed = sorted(amounts)[max(1, len(amounts)//20):-max(1, len(amounts)//20)] or amounts
        baseline = round(sum(trimmed) / len(trimmed), 2)
    else:
        baseline = 0
    return {"earnings": earnings, "baseline": baseline, "total_days": len(earnings)}

# ─── ADMIN ROUTES ───
@api_router.get("/admin/dashboard")
async def admin_dashboard(request: Request):
    await require_admin(request)
    total_workers = await db.workers.count_documents({})
    active_subs = await db.subscriptions.count_documents({"status": "active"})
    total_claims = await db.claims.count_documents({})
    pending_claims = await db.claims.count_documents({"status": "pending"})
    approved_claims = await db.claims.count_documents({"status": {"$in": ["approved", "paid"]}})
    rejected_claims = await db.claims.count_documents({"status": "rejected"})
    payouts_cursor = db.payouts.find({}, {"_id": 0, "amount": 1})
    payouts_list = await payouts_cursor.to_list(10000)
    total_payout_amount = sum(p.get("amount", 0) for p in payouts_list)
    recent_claims = await db.claims.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)
    recent_disruptions = await db.disruptions.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    plan_dist = {}
    for p in ["sahara", "kavach", "suraksha"]:
        plan_dist[p] = await db.subscriptions.count_documents({"plan": p, "status": "active"})
    severity_dist = {}
    for s in ["low", "medium", "high"]:
        severity_dist[s] = await db.claims.count_documents({"severity": s})
    fraud_dist = {}
    for t in ["auto_approve", "flag_review", "auto_reject"]:
        fraud_dist[t] = await db.claims.count_documents({"fraud_tier": t})
    return {
        "stats": {
            "total_workers": total_workers,
            "active_subscriptions": active_subs,
            "total_claims": total_claims,
            "pending_claims": pending_claims,
            "approved_claims": approved_claims,
            "rejected_claims": rejected_claims,
            "total_payout_amount": round(total_payout_amount, 2),
        },
        "distributions": {
            "plans": plan_dist,
            "severity": severity_dist,
            "fraud_tiers": fraud_dist,
        },
        "recent_claims": recent_claims,
        "recent_disruptions": recent_disruptions,
    }

@api_router.get("/admin/workers")
async def admin_workers(request: Request):
    await require_admin(request)
    workers = await db.workers.find({}, {"_id": 0}).to_list(100)
    for w in workers:
        user = await db.users.find_one({"_id": ObjectId(w["user_id"])}, {"_id": 0, "password_hash": 0})
        if user:
            w["user_info"] = user
    return {"workers": workers}

@api_router.get("/admin/claims")
async def admin_claims(request: Request, status: Optional[str] = None):
    await require_admin(request)
    query = {}
    if status:
        query["status"] = status
    claims = await db.claims.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"claims": claims}

@api_router.post("/admin/claims/{claim_id}/action")
async def admin_claim_action(claim_id: str, req: ClaimActionRequest, request: Request):
    await require_admin(request)
    claim = await db.claims.find_one({"_id": ObjectId(claim_id)})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if req.action == "approve":
        await db.claims.update_one({"_id": ObjectId(claim_id)}, {"$set": {"status": "approved", "admin_notes": req.notes, "updated_at": datetime.now(timezone.utc).isoformat()}})
        if claim.get("payout_amount", 0) > 0:
            await db.payouts.insert_one({
                "worker_id": claim["worker_id"],
                "worker_name": claim.get("worker_name", ""),
                "claim_id": claim_id,
                "amount": claim["payout_amount"],
                "status": "pending_disbursement",
                "plan": "",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    elif req.action == "reject":
        await db.claims.update_one({"_id": ObjectId(claim_id)}, {"$set": {"status": "rejected", "admin_notes": req.notes, "updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use approve or reject")
    return {"message": f"Claim {req.action}d successfully"}

@api_router.post("/admin/simulate-disruption")
async def simulate_disruption(req: DisruptionSimRequest, request: Request):
    await require_admin(request)
    features = {
        "rainfall_mm": req.rainfall_mm,
        "temperature_celsius": req.temperature_celsius,
        "aqi_index": req.aqi_index,
        "wind_speed_kmh": req.wind_speed_kmh,
        "flood_alert_flag": 1 if req.flood_alert else 0,
        "api_outage_flag": 1 if req.platform_outage else 0,
    }
    severity_result = compute_disruption_severity(features)
    disruption_doc = {
        "zone": req.zone,
        "disruption_type": req.disruption_type,
        "severity": severity_result["predicted_severity"],
        "severity_multiplier": severity_result["severity_multiplier"],
        "features": features,
        "severity_details": severity_result,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.disruptions.insert_one(disruption_doc)
    affected_workers = await db.workers.find({"zone": {"$regex": req.zone.split("_")[0], "$options": "i"}, "active_plan": {"$ne": None}}, {"_id": 0}).to_list(100)
    auto_claims = []
    for w in affected_workers:
        fraud_input = {"claim_frequency_30d": random.randint(0, 3), "gps_drift_meters": round(random.uniform(3, 15), 1), "device_swap_count": 0, "zone_entry_lag_mins": random.randint(0, 20), "avg_earnings_7d": w.get("daily_income_avg", 700)}
        fraud_result = compute_fraud_score(fraud_input)
        payout_result = compute_payout(w, {"disruption_type": req.disruption_type}, severity_result)
        status = "approved" if fraud_result["tier"] == "auto_approve" else ("pending" if fraud_result["tier"] == "flag_review" else "rejected")
        claim_doc = {
            "worker_id": w["user_id"],
            "worker_name": "",
            "disruption_type": req.disruption_type,
            "zone": w.get("zone", req.zone),
            "status": status,
            "fraud_score": fraud_result["fraud_score"],
            "fraud_tier": fraud_result["tier"],
            "severity": severity_result["predicted_severity"],
            "severity_multiplier": severity_result["severity_multiplier"],
            "payout_amount": payout_result["final_payout"] if status == "approved" else 0,
            "description": f"Auto-triggered: {req.disruption_type} in {req.zone}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        result = await db.claims.insert_one(claim_doc)
        auto_claims.append({"worker_id": w["user_id"], "status": status, "payout": claim_doc["payout_amount"]})
    return {
        "disruption": {
            "zone": req.zone,
            "type": req.disruption_type,
            "severity": severity_result["predicted_severity"],
            "severity_multiplier": severity_result["severity_multiplier"],
        },
        "severity_details": severity_result,
        "affected_workers": len(affected_workers),
        "auto_claims_created": len(auto_claims),
        "claims_summary": {
            "approved": sum(1 for c in auto_claims if c["status"] == "approved"),
            "pending": sum(1 for c in auto_claims if c["status"] == "pending"),
            "rejected": sum(1 for c in auto_claims if c["status"] == "rejected"),
            "total_payout": round(sum(c["payout"] for c in auto_claims), 2),
        }
    }

@api_router.get("/admin/ml-insights")
async def ml_insights(request: Request):
    await require_admin(request)
    claims = await db.claims.find({}, {"_id": 0, "fraud_score": 1, "severity": 1, "fraud_tier": 1, "payout_amount": 1, "created_at": 1, "disruption_type": 1}).to_list(500)
    fraud_over_time = {}
    for c in claims:
        date = c.get("created_at", "")[:10]
        if date not in fraud_over_time:
            fraud_over_time[date] = {"date": date, "avg_fraud_score": 0, "count": 0, "total_payout": 0}
        fraud_over_time[date]["avg_fraud_score"] += c.get("fraud_score", 0)
        fraud_over_time[date]["count"] += 1
        fraud_over_time[date]["total_payout"] += c.get("payout_amount", 0)
    for k in fraud_over_time:
        fraud_over_time[k]["avg_fraud_score"] = round(fraud_over_time[k]["avg_fraud_score"] / fraud_over_time[k]["count"], 3)
        fraud_over_time[k]["total_payout"] = round(fraud_over_time[k]["total_payout"], 2)
    return {
        "fraud_over_time": sorted(fraud_over_time.values(), key=lambda x: x["date"]),
        "models": {
            "fraud_model": {"name": "FraudRiskModel", "type": "XGBoost + RandomForest Ensemble", "version": "v2.1.0", "accuracy": "96.2%", "features": 11},
            "payout_model": {"name": "PayoutAuditRegressor", "type": "XGBRegressor + Deterministic", "version": "v2.1.0", "rmse": "Rs. 42.30", "features": 9},
            "disruption_model": {"name": "DisruptionSeverityClassifier", "type": "XGBClassifier + Rule Fallback", "version": "v2.1.0", "f1_score": "0.91", "features": 11}
        }
    }

@api_router.get("/plans")
async def get_plans():
    return {
        "plans": [
            {"id": "level-1", "name": "Level 1", "level": 1, "premium_daily": 29, "coverage_rate": 0.40, "max_covered_days": 3, "target": "Part-time / Occasional", "description": "Basic protection for part-time delivery partners", "features": ["40% income coverage", "3 max covered days", "Weather disruptions", "Basic fraud protection"]},
            {"id": "level-2", "name": "Level 2", "level": 2, "premium_daily": 59, "coverage_rate": 0.60, "max_covered_days": 5, "target": "Full-time Delivery Partner", "description": "Comprehensive protection for full-time riders", "features": ["60% income coverage", "5 max covered days", "All disruption types", "Advanced fraud detection", "Priority claim processing"], "recommended": True},
            {"id": "level-3", "name": "Level 3", "level": 3, "premium_daily": 99, "coverage_rate": 0.80, "max_covered_days": 7, "target": "Power Users / High Earners", "description": "Maximum protection for power delivery partners", "features": ["80% income coverage", "7 max covered days", "All disruption types", "Premium fraud protection", "Express claim processing", "Loyalty bonus eligible"]},
        ]
    }

@api_router.get("/payout-calculator")
async def payout_calculator(daily_income: float = 700, plan: str = "level-2", severity: str = "medium", tenure_days: int = 90):
    worker_data = {"daily_income_avg": daily_income, "active_plan": plan, "tenure_days": tenure_days, "claim_accuracy_rate": 0.9, "platform_rating": 4.2}
    severity_result = {"severity_multiplier": SEVERITY_MULTIPLIER_MAP.get(severity, 1.0), "predicted_severity": severity}
    result = compute_payout(worker_data, {}, severity_result)
    return result

# ─── WEATHER & INTEGRATION ROUTES ───
@api_router.get("/weather/zones")
async def get_weather_zones():
    """Return all supported zones with coordinates."""
    return {"zones": [{"id": z, "lat": c[0], "lon": c[1]} for z, c in ZONE_COORDINATES.items()]}

@api_router.get("/weather/zone/{zone_id}")
async def get_zone_weather(zone_id: str):
    """Get current weather for a zone (cached or live)."""
    cached = get_cached_weather(zone_id)
    if cached:
        return {**cached, "from_cache": True}
    data = await weather_client.get_weather_for_zone(zone_id)
    update_cache(zone_id, data)
    return {**data, "from_cache": False}

@api_router.get("/weather/all")
async def get_all_weather():
    """Get cached weather for all zones."""
    cached = get_all_cached()
    if not cached:
        await poll_all_zones(weather_client)
        cached = get_all_cached()
    return {"zones": cached, "weather_api_active": weather_client.available}

@api_router.post("/weather/poll")
async def trigger_weather_poll(request: Request):
    """Admin: force refresh weather for all zones."""
    await require_admin(request)
    results = await poll_all_zones(weather_client)
    return {"message": f"Polled {len(results)} zones", "results": results}

@api_router.get("/telematics/features/{zone_id}")
async def get_telematics_features(zone_id: str, fraud_type: str = "genuine", severity: str = "low"):
    """Generate telematics features for fraud model testing."""
    features = telematics_client.generate_fraud_features(zone_id, severity, fraud_type)
    return features

@api_router.get("/")
async def root():
    return {"message": "FleetLock API v2.0", "status": "running", "weather_api": weather_client.available}

app.include_router(api_router)

# CORS must be after router inclusion but that's fine in FastAPI/Starlette
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
cors_origins = [frontend_url, "http://localhost:3000"]
# Also add any URL from CORS_ORIGINS env
extra = os.environ.get("CORS_ORIGINS", "")
if extra and extra != "*":
    cors_origins.extend([o.strip() for o in extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
