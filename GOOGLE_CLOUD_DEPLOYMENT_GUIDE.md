# Google Cloud Platform (GCP) Deployment & Admin Management Guide

This comprehensive guide explains how to deploy **TradersDesk** to **Google Cloud Run** and manage the entire website (menus, submenus, dynamic pages, blog articles, broker APIs, SEO, and Market-Hours Auto-Scaling) directly from your secret **Admin Panel**.

---

## 1. Cloud Architecture Overview

TradersDesk is containerized with a production-optimized `Dockerfile` (Python 3.11-slim) and dynamically detects Cloud Run's `$PORT` (default `8080` / `8000`).

```
  [ Visitors / Traders ]
           │
           ▼
 [ Google Cloud Run Service ]  ◄── (Auto-scaling, HTTPS, SSL Included)
           │
           ├─► server.py (Multi-threaded HTTP Server)
           ├─► Master Navigation (`data/navigation_master.json`)
           ├─► Dynamic Pages CMS (`data/cms_pages.json`)
           ├─► Blog & Insights CMS (`data/cms_posts.json`)
           └─► Cloud Database Sync (`supabase_engine.py`)
```

---

## 2. Fast 1-Click Deployment to Google Cloud Run

### Step 1: Install & Login to Google Cloud SDK
If you haven't installed `gcloud` on your computer:
1. Download installer: [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)
2. Open terminal / command prompt and log in:
   ```bash
   gcloud auth login
   ```

### Step 2: Set your Google Cloud Project
```bash
gcloud config set project trading-509214
```

### Step 3: Run 1-Click Deployment
In this project directory, simply run:

**On Windows:**
```cmd
deploy_gcp.bat
```

**On Linux / macOS:**
```bash
chmod +x deploy_gcp.sh
./deploy_gcp.sh
```

Google Cloud will automatically build your Docker container via Cloud Build and output your live production URL:
```
Service URL: https://tradersdesk-xxxx-el.a.run.app
```

---

## 3. Market-Hours Automated Cost Optimization (~81% Cloud Savings)

### Why 24/7 Server Was Expensive:
- A month has 720 hours.
- The Indian Stock Market (NSE/BSE) is open only ~137 hours per month (Mon–Fri, 9:15 AM – 3:30 PM).
- Running 24/7 means paying for 583 hours of idle server time (nights and weekends), resulting in high monthly bills (~₹3,500 – ₹5,000/mo).

### The Solution: Cloud Scheduler Auto-Warm & Auto-Sleep
With Google Cloud Scheduler:
1. **09:00 AM IST (Mon–Fri)**: Automatically sets Cloud Run `min-instances: 1` (`--no-cpu-throttling`). The server stays continuously warm, recording real market ticks, candles, and option data without missing a single minute.
2. **03:45 PM IST (Mon–Fri)**: Automatically scales back to `min-instances: 0` (`--cpu-throttling`) after market close and EOD processing.
3. **Nights & Weekends**: Zero compute instances run, costing **₹0**!
4. **Estimated Monthly Bill**: Drops to **~₹150 – ₹250/month** (fits within Google Cloud Free Tier of 360,000 vCPU-seconds).

### How to Activate in 1-Click:
In this project directory, simply run:

**On Windows:**
```cmd
setup_market_schedule.bat
```

**On Linux / macOS:**
```bash
chmod +x setup_market_schedule.sh
./setup_market_schedule.sh
```

You can also download and monitor this directly from **Admin Panel ➔ Google Cloud & Ops**.

---

## 4. Secret Admin Panel Management

### No Public Links (100% Hidden)
As requested, **NO link** to the Admin Panel exists anywhere on the public website (not in the header, footer, 6-dot menu, or sitemap).

### How to Access:
Simply navigate to your live domain with `/admin.html` in your browser address bar:
```
https://your-domain.com/admin.html
```
Enter your Master Admin PIN/Secret Key (`9771897535`) to unlock the console.

---

## 5. What You Can Manage in the Admin Panel

1. **🕒 Market-Hours Scheduler & Cost Optimizer:**
   - Monitor current mode (WARM vs SLEEP).
   - 1-click download of setup and test scripts (`set_market_warm.bat`, `set_market_sleep.bat`).

2. **🧭 Navigation & Submenu Builder:**
   - Add new Top-level menus or dropdown submenus.
   - Column-by-column visual organizer with 1-click **⚡ Auto-Balance Submenus** and **⇄ Col 1 / Col 2 Switch**.
   - Reorder, change icons, badges (`PRO`, `LIVE`, `NEW`), and toggle items ON/OFF in real-time.

3. **📄 Dynamic Pages CMS (Markdown & HTML):**
   - Create custom pages at any URL slug (e.g. `/guide`, `/rules`, `/handbook`).
   - Real-time side-by-side preview with custom SEO meta titles & descriptions.

4. **✍️ Blog & Article Studio:**
   - Write and publish market research posts, options strategies, and educational guides.
   - Appears at `/blog` and `/blog/<slug>`.

5. **🎛️ Feature Flags & Toggles:**
   - Temporarily enable or disable specific features with 1 click.

6. **🔑 Master Broker APIs:**
   - Configure Angel One SmartAPI, Kotak Neo, Upstox, or Fyers credentials without restarting the server.

7. **🔍 SEO & Google Search Console:**
   - Instant 1-click sitemap generation, Googlebot dynamic HTML simulation, and meta tag inspection.

---

## 6. Setting Cloud Environment Variables

To keep your secrets safe in Google Cloud Run:
```bash
gcloud run services update tradersdesk \
    --region asia-south1 \
    --set-env-vars "ADMIN_SECRET_KEY=9771897535,SUPABASE_URL=your_supabase_url,SUPABASE_KEY=your_supabase_anon_key"
```
