"""
supabase_engine.py
Python Backend Integration for Supabase (Auth, Database & Realtime State Sync)
Uses standard library urllib (zero external pip dependencies required).
Handles GoTrue Auth (Signup/Signin/OAuth) and PostgREST Database operations.
"""

from __future__ import annotations
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"

def get_env_var(key: str, default: str = "") -> str:
    if ENV_FILE.exists():
        try:
            for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() == key:
                        val = v.strip().strip('"').strip("'")
                        if val:
                            return val
        except Exception:
            pass
    val = os.environ.get(key)
    if val:
        return val.strip()
    return default

DEFAULT_SUPABASE_URL = "https://vjslcbfvcwwiovvxnhyc.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_0sitpsM9eh7mMwsjusLsbA_H4m6FCrG"

def get_supabase_config() -> dict:
    url = get_env_var("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    anon_key = get_env_var("SUPABASE_ANON_KEY", "") or get_env_var("SUPABASE_KEY", "") or DEFAULT_SUPABASE_ANON_KEY
    service_key = get_env_var("SUPABASE_SERVICE_ROLE_KEY", "")
    return {
        "url": url,
        "anonKey": anon_key,
        "serviceRoleKey": service_key,
        "isConfigured": bool(url and (anon_key or service_key))
    }

def save_supabase_config(url: str, anon_key: str, service_key: str = "") -> bool:
    url = url.strip().rstrip("/")
    anon_key = anon_key.strip()
    service_key = service_key.strip()
    
    os.environ["SUPABASE_URL"] = url
    os.environ["SUPABASE_ANON_KEY"] = anon_key
    if service_key:
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = service_key

    # Update .env file
    lines = []
    if ENV_FILE.exists():
        try:
            lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
        except Exception:
            lines = []

    keys_to_update = {
        "SUPABASE_URL": url,
        "SUPABASE_ANON_KEY": anon_key,
        "SUPABASE_SERVICE_ROLE_KEY": service_key
    }

    found = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        updated = False
        for k, v in keys_to_update.items():
            if stripped.startswith(f"{k}=") or stripped == k:
                new_lines.append(f"{k}={v}")
                found.add(k)
                updated = True
                break
        if not updated:
            new_lines.append(line)

    for k, v in keys_to_update.items():
        if k not in found:
            new_lines.append(f"{k}={v}")

    try:
        ENV_FILE.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        return True
    except Exception as e:
        print(f"[SupabaseEngine] Error updating .env: {e}")
        return False

def _make_request(endpoint: str, method: str = "GET", payload: dict | None = None, token: str | None = None) -> dict:
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase is not configured in backend. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env or Settings."}

    url = f"{cfg['url']}{endpoint}"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]

    headers = {
        "apikey": key,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        headers["Authorization"] = f"Bearer {key}"

    data_bytes = None
    if payload is not None:
        data_bytes = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return {"ok": True, "data": None}
            parsed = json.loads(raw)
            return {"ok": True, "data": parsed}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
            msg = err_json.get("msg") or err_json.get("message") or err_json.get("error_description") or str(err_json)
        except Exception:
            msg = err_body or str(e)
        return {"ok": False, "status": e.code, "message": msg}
    except Exception as e:
        return {"ok": False, "message": str(e)}

# =====================================================================
# AUTH OPERATIONS
# =====================================================================

def signup_user(email: str, password: str, name: str = "") -> dict:
    payload = {
        "email": email.strip(),
        "password": password.strip(),
        "data": {"full_name": name.strip()}
    }
    res = _make_request("/auth/v1/signup", method="POST", payload=payload)
    if res.get("ok"):
        user_data = res.get("data", {})
        return {
            "ok": True,
            "message": "User registered successfully in Supabase.",
            "user": {
                "id": user_data.get("id"),
                "email": user_data.get("email"),
                "name": name or user_data.get("email", "").split("@")[0]
            }
        }
    return res

def signin_user(email: str, password: str) -> dict:
    payload = {
        "email": email.strip(),
        "password": password.strip()
    }
    res = _make_request("/auth/v1/token?grant_type=password", method="POST", payload=payload)
    if res.get("ok"):
        data = res.get("data", {})
        user_obj = data.get("user", {})
        return {
            "ok": True,
            "message": "Authenticated successfully with Supabase.",
            "accessToken": data.get("access_token"),
            "refreshToken": data.get("refresh_token"),
            "user": {
                "id": user_obj.get("id"),
                "email": user_obj.get("email"),
                "name": user_obj.get("user_metadata", {}).get("full_name") or user_obj.get("email", "").split("@")[0]
            }
        }
    return res

def verify_token(access_token: str) -> dict:
    res = _make_request("/auth/v1/user", method="GET", token=access_token)
    if res.get("ok"):
        return {"ok": True, "user": res.get("data")}
    return res

# =====================================================================
# WORKSPACE DATABASE SYNC (PostgREST)
# =====================================================================

def save_user_workspace(user_id: str, workspace_data: dict, token: str | None = None) -> dict:
    payload = {
        "user_id": user_id,
        "workspace_data": workspace_data,
        "updated_at": "now()"
    }
    headers_token = token
    # Upsert using PostgREST Prefer: resolution=merge-duplicates header
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase is not configured."}

    url = f"{cfg['url']}/rest/v1/user_workspaces"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {token or key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=req_headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return {"ok": True, "message": "Workspace state saved to Supabase cloud database."}
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8")
        return {"ok": False, "status": e.code, "message": err_text}
    except Exception as e:
        return {"ok": False, "message": str(e)}

def load_user_workspace(user_id: str, token: str | None = None) -> dict:
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase is not configured."}

    url = f"{cfg['url']}/rest/v1/user_workspaces?user_id=eq.{user_id}&select=*"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {token or key}",
        "Accept": "application/json"
    }

    try:
        req = urllib.request.Request(url, headers=req_headers, method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read().decode("utf-8")
            items = json.loads(raw or "[]")
            if items and len(items) > 0:
                return {"ok": True, "workspace": items[0].get("workspace_data", {})}
            return {"ok": True, "workspace": None}
    except Exception as e:
        return {"ok": False, "message": str(e)}


# =====================================================================
# GLOBAL BROKER SETTINGS CLOUD SYNC (Supabase app_config)
# =====================================================================

def save_broker_settings_to_supabase(config_data: dict) -> dict:
    """Save global broker settings to Supabase app_config table, safely merging existing settings."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase not configured"}
    
    # 1. Load existing to ensure we never overwrite or erase existing credentials
    existing = load_broker_settings_from_supabase() or {}
    merged = dict(existing)
    for k, v in config_data.items():
        if v is not None and str(v).strip():
            merged[k] = str(v).strip()

    url = f"{cfg['url']}/rest/v1/app_config"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    payload = {
        "key": "global_broker_settings",
        "value": merged,
        "updated_at": "now()"
    }
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=req_headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return {"ok": True, "message": "Broker settings backed up permanently to Supabase cloud."}
    except Exception as e:
        return {"ok": False, "message": str(e)}

def load_broker_settings_from_supabase() -> dict | None:
    """Load global broker settings from Supabase app_config table."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return None
    url = f"{cfg['url']}/rest/v1/app_config?key=eq.global_broker_settings&select=value"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json"
    }
    try:
        req = urllib.request.Request(url, headers=req_headers, method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read().decode("utf-8")
            items = json.loads(raw or "[]")
            if items and isinstance(items, list) and len(items) > 0:
                val = items[0].get("value")
                if isinstance(val, dict):
                    return val
    except Exception:
        pass
    return None

def save_angel_session_to_supabase(session_data: dict) -> dict:
    """Save active Angel One authenticated JWT session to Supabase app_config table."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase not configured"}
    
    url = f"{cfg['url']}/rest/v1/app_config"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    payload = {
        "key": "angel_session",
        "value": session_data,
        "updated_at": "now()"
    }
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=req_headers, method="POST")
        with urllib.request.urlopen(req, timeout=6) as resp:
            return {"ok": True, "message": "Angel session backed up to Supabase."}
    except Exception as e:
        return {"ok": False, "message": str(e)}

def load_angel_session_from_supabase() -> dict | None:
    """Load active Angel One authenticated JWT session from Supabase app_config table."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return None
    url = f"{cfg['url']}/rest/v1/app_config?key=eq.angel_session&select=value"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json"
    }
    try:
        req = urllib.request.Request(url, headers=req_headers, method="GET")
        with urllib.request.urlopen(req, timeout=6) as resp:
            raw = resp.read().decode("utf-8")
            items = json.loads(raw or "[]")
            if items and isinstance(items, list) and len(items) > 0:
                val = items[0].get("value")
                if isinstance(val, dict):
                    return val
    except Exception:
        pass
    return None

