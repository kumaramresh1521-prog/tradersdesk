"""
indexnow_engine.py
Automated IndexNow submission engine for TradersDesk.in.
Directly notifies Bing, Yandex, Naver, and Seznam search engines of new or changed URLs.
"""

import json
import urllib.request
import logging

logger = logging.getLogger("IndexNow")

INDEXNOW_KEY = "tradersdesk8f9a2b3c4d5e6f7a8b9c"
INDEXNOW_HOST = "tradersdesk.in"
INDEXNOW_KEY_LOCATION = f"https://{INDEXNOW_HOST}/{INDEXNOW_KEY}.txt"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"

def submit_urls_to_indexnow(urls: list[str]) -> dict:
    """Submits a list of absolute or relative URLs to IndexNow API."""
    full_urls = []
    for u in urls:
        if u.startswith("http://") or u.startswith("https://"):
            full_urls.append(u)
        else:
            full_urls.append(f"https://{INDEXNOW_HOST}{u if u.startswith('/') else '/' + u}")

    payload = {
        "host": INDEXNOW_HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": INDEXNOW_KEY_LOCATION,
        "urlList": list(set(full_urls))
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            INDEXNOW_ENDPOINT,
            data=data,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "TradersDesk-IndexNow/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            return {"ok": True, "status": status, "count": len(full_urls), "message": "Successfully submitted to IndexNow"}
    except urllib.error.HTTPError as e:
        # HTTP 200: OK, HTTP 202: Accepted (both mean success in IndexNow)
        if e.code in (200, 202):
            return {"ok": True, "status": e.code, "count": len(full_urls), "message": "Accepted by IndexNow"}
        logger.warning(f"IndexNow submission HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')}")
        return {"ok": False, "status": e.code, "error": str(e)}
    except Exception as exc:
        logger.warning(f"IndexNow submission error: {exc}")
        return {"ok": False, "error": str(exc)}

def submit_sitemap_to_indexnow() -> dict:
    """Reads all URLs from public/sitemap.xml and submits them to IndexNow."""
    import re
    from pathlib import Path
    sitemap_file = Path(__file__).resolve().parent / "public" / "sitemap.xml"
    if not sitemap_file.exists():
        return {"ok": False, "error": "sitemap.xml not found"}

    xml = sitemap_file.read_text(encoding="utf-8")
    urls = re.findall(r'<loc>(https://tradersdesk\.in[^<]+)</loc>', xml)
    if not urls:
        return {"ok": False, "error": "No URLs found in sitemap.xml"}

    return submit_urls_to_indexnow(urls)

if __name__ == "__main__":
    res = submit_sitemap_to_indexnow()
    print("IndexNow submission result:", res)
