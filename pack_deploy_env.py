import os
import sys

ALLOWED_KEYS = {
    "DATA_BROKER",
    "ANGEL_API_KEY",
    "ANGEL_CLIENT_CODE",
    "ANGEL_PIN",
    "ANGEL_TOTP_SECRET",
    "ANGEL_TOTP_CODE",
    "ANGEL_BASE_URL",
    "UPSTOX_ACCESS_TOKEN",
    "UPSTOX_API_KEY",
    "UPSTOX_API_SECRET",
    "UPSTOX_REDIRECT_URI",
    "ADMIN_SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "KOTAK_ACCESS_TOKEN",
    "KOTAK_CONSUMER_KEY",
    "KOTAK_CONSUMER_SECRET",
    "KOTAK_MOBILE_NO",
    "KOTAK_MPIN",
    "FYERS_APP_ID",
    "FYERS_ACCESS_TOKEN",
    "HOST",
    "PORT",
}

DEFAULT_SUPABASE_URL = "https://vjslcbfvcwwiovvxnhyc.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_0sitpsM9eh7mMwsjusLsbA_H4m6FCrG"

def main():
    project_id = sys.argv[1] if len(sys.argv) > 1 else "trading-509214"
    pairs = [f"GOOGLE_CLOUD_PROJECT={project_id}"]
    found_keys = set()
    env_file = ".env"
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k in ALLOWED_KEYS and v:
                    pairs.append(f"{k}={v}")
                    found_keys.add(k)
    
    # Guarantee permanent Supabase cloud connection on Cloud Run
    if "SUPABASE_URL" not in found_keys:
        pairs.append(f"SUPABASE_URL={DEFAULT_SUPABASE_URL}")
    if "SUPABASE_ANON_KEY" not in found_keys:
        pairs.append(f"SUPABASE_ANON_KEY={DEFAULT_SUPABASE_ANON_KEY}")

    output = ",".join(pairs)
    print(output)

if __name__ == "__main__":
    main()
