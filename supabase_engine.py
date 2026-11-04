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

def save_app_config_to_supabase(key: str, value: any) -> dict:
    """Save any generic app configuration (e.g. footer_links, seo_routes, seo_config) to Supabase app_config table."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase not configured"}

    url = f"{cfg['url']}/rest/v1/app_config"
    key_token = cfg["serviceRoleKey"] or cfg["anonKey"]
    payload = {
        "key": key.strip(),
        "value": value,
        "updated_at": "now()"
    }
    req_headers = {
        "apikey": key_token,
        "Authorization": f"Bearer {key_token}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=req_headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return {"ok": True, "message": f"{key} saved permanently to Supabase cloud."}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def load_app_config_from_supabase(key: str) -> any | None:
    """Load generic app configuration from Supabase app_config table."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return None
    url = f"{cfg['url']}/rest/v1/app_config?key=eq.{key.strip()}&select=value"
    key_token = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key_token,
        "Authorization": f"Bearer {key_token}",
        "Accept": "application/json"
    }
    try:
        req = urllib.request.Request(url, headers=req_headers, method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read().decode("utf-8")
            items = json.loads(raw or "[]")
            if items and isinstance(items, list) and len(items) > 0:
                return items[0].get("value")
    except Exception:
        pass
    return None


def delete_app_config_from_supabase(key: str) -> bool:
    """Delete a configuration record from Supabase app_config table."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return False
    url = f"{cfg['url']}/rest/v1/app_config?key=eq.{key.strip()}"
    key_token = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key_token,
        "Authorization": f"Bearer {key_token}",
    }
    try:
        req = urllib.request.Request(url, headers=req_headers, method="DELETE")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status in (200, 204)
    except Exception:
        pass
    return False


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

def delete_angel_session_from_supabase() -> bool:
    """Delete cleared/invalid Angel One session from Supabase app_config."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return False
    url = f"{cfg['url']}/rest/v1/app_config?key=eq.angel_session"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    try:
        req = urllib.request.Request(url, headers=req_headers, method="DELETE")
        with urllib.request.urlopen(req, timeout=6) as resp:
            return resp.status in (200, 204)
    except Exception:
        pass
    return False


def sync_all_admin_configs_from_cloud(data_dir: Path | None = None) -> dict:
    """
    Called on container boot (e.g. in Cloud Run / Docker / Local startup).
    Pulls all persistent admin configurations from Supabase app_config table
    and synchronizes them down to data/*.json so container restarts/scaling
    never lose admin settings.
    Also uploads any missing local configs to Supabase if not yet present in the cloud.
    """
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase not configured"}

    if data_dir is None:
        data_dir = ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    CONFIG_FILE_MAP = {
        "footer_links": "footer_links.json",
        "navigation_master": "navigation_master.json",
        "cms_pages": "cms_pages.json",
        "cms_posts": "cms_posts.json",
        "platform_settings": "platform_settings.json",
        "feature_flags": "feature_flags.json",
        "ads_config": "ads_config.json",
        "seo_config": "seo_config.json",
        "seo_routes": "seo_routes.json",
        "deleted_seo_routes": "deleted_seo_routes.json",
        "admin_pin": "admin_pin.json",
        "admin_config": "admin_config.json",
        "global_broker_settings": "config_backup.json",
    }

    url = f"{cfg['url']}/rest/v1/app_config?select=key,value,updated_at"
    key_token = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key_token,
        "Authorization": f"Bearer {key_token}",
        "Accept": "application/json"
    }

    synced_from_cloud = []
    seeded_to_cloud = []

    try:
        req = urllib.request.Request(url, headers=req_headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            items = json.loads(raw or "[]")
            cloud_keys = set()
            if isinstance(items, list):
                for item in items:
                    k = item.get("key")
                    v = item.get("value")
                    if not k or v is None:
                        continue
                    cloud_keys.add(k)
                    if k in CONFIG_FILE_MAP:
                        target_file = data_dir / CONFIG_FILE_MAP[k]
                        try:
                            target_file.write_text(json.dumps(v, indent=2, ensure_ascii=False), encoding="utf-8")
                            synced_from_cloud.append(k)

                            # Write aliases & secondary locations
                            if k == "navigation_master":
                                try:
                                    (data_dir / "navigation.json").write_text(json.dumps(v, indent=2, ensure_ascii=False), encoding="utf-8")
                                except Exception:
                                    pass
                            elif k == "global_broker_settings" and isinstance(v, dict):
                                try:
                                    cache_backup = ROOT / "cache" / "config_backup.json"
                                    cache_backup.parent.mkdir(parents=True, exist_ok=True)
                                    cache_backup.write_text(json.dumps(v, indent=2, ensure_ascii=False), encoding="utf-8")
                                    import os
                                    for b_k, b_v in v.items():
                                        if b_v and str(b_v).strip():
                                            os.environ[b_k] = str(b_v).strip()
                                except Exception:
                                    pass
                            elif k in ("footer_links", "seo_config", "seo_routes"):
                                try:
                                    (ROOT / f"{k}.json").write_text(json.dumps(v, indent=2, ensure_ascii=False), encoding="utf-8")
                                except Exception:
                                    pass
                        except Exception as e:
                            print(f"[Supabase Sync] Error writing {target_file}: {e}")
                            print(f"[Supabase Sync] Error writing {target_file}: {e}")

            # Check if any local configs are missing in Supabase and upload them
            for k, filename in CONFIG_FILE_MAP.items():
                if k not in cloud_keys:
                    local_file = data_dir / filename
                    if local_file.exists():
                        try:
                            content_json = json.loads(local_file.read_text(encoding="utf-8"))
                            if content_json:
                                save_app_config_to_supabase(k, content_json)
                                seeded_to_cloud.append(k)
                        except Exception as e:
                            print(f"[Supabase Sync] Error uploading {k} to cloud: {e}")

        summary = f"[Supabase Sync] Synced {len(synced_from_cloud)} configs from cloud. Seeded {len(seeded_to_cloud)} to cloud."
        print(summary)
        return {
            "ok": True,
            "synced_from_cloud": synced_from_cloud,
            "seeded_to_cloud": seeded_to_cloud
        }
    except Exception as e:
        print(f"[Supabase Sync] Cloud sync warning: {e}")
        return {"ok": False, "error": str(e)}


# =====================================================================
# 90-DAYS DAILY MARKET & TOOLS SNAPSHOTS
# =====================================================================

def save_market_daily_snapshot(trade_date: str, snapshot_data: dict) -> dict:
    """
    Saves or updates daily market snapshot for trade_date in Supabase table market_daily_snapshots.
    Payload keys: options_data, straddle_data, open_interest_data, call_vs_put_data,
                  smart_money_data, delivery_data, mtf_data, breadth_data
    """
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase not configured"}

    url = f"{cfg['url']}/rest/v1/market_daily_snapshots"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]

    payload = {
        "trade_date": trade_date.strip(),
        "options_data": snapshot_data.get("options_data", {}),
        "straddle_data": snapshot_data.get("straddle_data", {}),
        "open_interest_data": snapshot_data.get("open_interest_data", {}),
        "call_vs_put_data": snapshot_data.get("call_vs_put_data", {}),
        "smart_money_data": snapshot_data.get("smart_money_data", {}),
        "delivery_data": snapshot_data.get("delivery_data", {}),
        "mtf_data": snapshot_data.get("mtf_data", {}),
        "breadth_data": snapshot_data.get("breadth_data", {}),
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
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"ok": True, "message": f"Snapshot for {trade_date} saved to Supabase."}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def load_market_daily_snapshot(trade_date: str) -> dict | None:
    """Loads full market snapshot for a specific trade date from Supabase."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return None
    url = f"{cfg['url']}/rest/v1/market_daily_snapshots?trade_date=eq.{trade_date.strip()}&select=*"
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
                return items[0]
    except Exception:
        pass
    return None


def load_market_snapshots_calendar(days: int = 90) -> list[str]:
    """Returns list of available trade_date strings in market_daily_snapshots sorted descending."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return []
    url = f"{cfg['url']}/rest/v1/market_daily_snapshots?select=trade_date&order=trade_date.desc&limit={days}"
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
            if isinstance(items, list):
                return [item["trade_date"] for item in items if item.get("trade_date")]
    except Exception:
        pass
    return []


def purge_old_market_snapshots(retention_days: int = 90) -> dict:
    """
    Deletes snapshots older than retention_days.
    PostgREST filter: trade_date=lt.(current_date - retention_days)
    """
    from datetime import datetime, timedelta, timezone
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase not configured"}

    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=retention_days)).strftime("%Y-%m-%d")
    url = f"{cfg['url']}/rest/v1/market_daily_snapshots?trade_date=lt.{cutoff_date}"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    try:
        req = urllib.request.Request(url, headers=req_headers, method="DELETE")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return {"ok": True, "message": f"Purged snapshots older than {cutoff_date}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def load_market_snapshots_summary_list(days: int = 90) -> list[dict]:
    """Returns summarized snapshot metadata for Admin Panel tracking table."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return []
    url = f"{cfg['url']}/rest/v1/market_daily_snapshots?select=trade_date,created_at,updated_at,options_data,straddle_data,open_interest_data,call_vs_put_data,smart_money_data,delivery_data,mtf_data,breadth_data&order=trade_date.desc&limit={days}"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json"
    }
    try:
        req = urllib.request.Request(url, headers=req_headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            items = json.loads(resp.read().decode("utf-8") or "[]")
            res = []
            for item in items:
                opt = item.get("options_data") or {}
                strd = item.get("straddle_data") or {}
                sm = item.get("smart_money_data") or {}
                deliv = item.get("delivery_data") or {}
                mtf = item.get("mtf_data") or {}
                brd = item.get("breadth_data") or {}
                oi = item.get("open_interest_data") or {}
                cvp = item.get("call_vs_put_data") or {}

                strd_lower_keys = [k for k in strd.keys() if k.islower()]
                opt_inst_keys = opt.get("instrument_keys") or [k for k in (opt.get("instruments") or {}).keys() if "|" in k] or ([opt.get("underlying") or "NIFTY"] if opt.get("strikes") else [])
                res.append({
                    "trade_date": item.get("trade_date"),
                    "created_at": item.get("created_at"),
                    "updated_at": item.get("updated_at"),
                    "spot_price": opt.get("spotPrice"),
                    "pcr": opt.get("pcr"),
                    "options_count": len(opt.get("strikes", [])),
                    "options_instruments_count": len(opt_inst_keys),
                    "straddle_symbols_count": len(strd_lower_keys),
                    "straddle_symbols": [k.upper() for k in strd_lower_keys],
                    "straddle_nifty_decay": (strd.get("nifty") or {}).get("decayPct"),
                    "straddle_nifty_ltp": (strd.get("nifty") or {}).get("combinedPremium"),
                    "straddle_points_count": len((strd.get("nifty") or {}).get("points", [])),
                    "smart_money_participants": len(sm.get("participants", [])),
                    "fii_net_cr": ((sm.get("cashFlow") or {}).get("daily") or [{}])[0].get("fiiNet") if isinstance((sm.get("cashFlow") or {}).get("daily"), list) and (sm.get("cashFlow") or {}).get("daily") else None,
                    "delivery_stocks_count": len(deliv.get("topStocks", [])),
                    "mtf_stocks_count": len(mtf.get("topFundedStocks", [])),
                    "breadth_universes_count": len(brd),
                })
            return res
    except Exception as e:
        print(f"[Supabase] load_market_snapshots_summary_list error: {e}")
        return []


def delete_market_snapshot(trade_date: str) -> dict:
    """Deletes a single snapshot by trade_date from Supabase."""
    cfg = get_supabase_config()
    if not cfg["isConfigured"]:
        return {"ok": False, "message": "Supabase not configured"}
    t_date = trade_date.strip()
    url = f"{cfg['url']}/rest/v1/market_daily_snapshots?trade_date=eq.{t_date}"
    key = cfg["serviceRoleKey"] or cfg["anonKey"]
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    try:
        req = urllib.request.Request(url, headers=req_headers, method="DELETE")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return {"ok": True, "message": f"Snapshot for {t_date} deleted from Supabase."}
    except Exception as e:
        return {"ok": False, "message": str(e)}

