"""
Small Secret Manager adapter for Cloud Run.

The service receives credentials as environment variables at startup. When an
authorized admin updates a broker setting, this module adds a new Secret
Manager version so the next Cloud Run instance receives the same value.
"""

from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request

METADATA_TOKEN_URL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
SECRET_MANAGER_API = "https://secretmanager.googleapis.com/v1"
SECRET_PREFIX = "tradersdesk-"


def is_cloud_run() -> bool:
    return bool(os.environ.get("K_SERVICE"))


def project_id() -> str:
    return (os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT_ID") or "").strip()


def secret_id_for_env(env_key: str) -> str:
    return f"{SECRET_PREFIX}{env_key.lower().replace('_', '-')}"


def _access_token() -> str:
    request = urllib.request.Request(METADATA_TOKEN_URL, headers={"Metadata-Flavor": "Google"})
    with urllib.request.urlopen(request, timeout=3) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return str(payload.get("access_token") or "")


def _request(url: str, method: str, token: str, payload: dict | None = None) -> tuple[int, dict]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, {"error": {"message": raw}}


def upsert_environment_secrets(values: dict[str, str]) -> dict:
    """Adds new versions to pre-created secrets; creation is intentionally setup-only."""
    if not is_cloud_run():
        return {"ok": False, "message": "Secret Manager writes are available only inside Cloud Run."}
    project = project_id()
    if not project:
        return {"ok": False, "message": "GOOGLE_CLOUD_PROJECT is not available."}
    try:
        token = _access_token()
    except Exception as exc:
        return {"ok": False, "message": f"Could not acquire Cloud Run identity token: {exc}"}
    if not token:
        return {"ok": False, "message": "Cloud Run identity token was empty."}

    saved = []
    failed = []
    for env_key, value in values.items():
        secret_id = secret_id_for_env(env_key)
        encoded = base64.b64encode(value.encode("utf-8")).decode("ascii")
        url = f"{SECRET_MANAGER_API}/projects/{urllib.parse.quote(project, safe='')}/secrets/{urllib.parse.quote(secret_id, safe='')}:addVersion"
        status, response = _request(url, "POST", token, {"payload": {"data": encoded}})
        if 200 <= status < 300:
            saved.append(env_key)
        else:
            message = ((response.get("error") or {}).get("message") or f"HTTP {status}").replace("\n", " ")
            failed.append(f"{env_key}: {message[:160]}")
    if failed:
        return {"ok": False, "count": len(saved), "message": "; ".join(failed)}
    return {"ok": True, "count": len(saved)}
