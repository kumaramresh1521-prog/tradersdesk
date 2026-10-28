# Google Cloud Platform (GCP) Deployment & Admin Management Guide

This comprehensive guide explains how to deploy **TradersDesk** to **Google Cloud Run** and manage the entire website (menus, submenus, dynamic pages, blog articles, broker APIs, and SEO) directly from your secret **Admin Panel**.

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
gcloud config set project YOUR_PROJECT_ID
```
*(Replace `YOUR_PROJECT_ID` with your Google Cloud Project ID).*

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

**Or directly with gcloud CLI:**
```bash
gcloud run deploy tradersdesk \
    --source . \
    --region asia-south1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 4
```

Google Cloud will automatically build your Docker container via Cloud Build and output your live production URL:
```
Service URL: https://tradersdesk-xxxx-el.a.run.app
```

---

## 3. Secret Admin Panel Management

### No Public Links (100% Hidden)
As requested, **NO link** to the Admin Panel exists anywhere on the public website (not in the header, footer, 6-dot menu, or sitemap).

### How to Access:
Simply navigate to your live domain with `/admin.html` in your browser address bar:
```
https://your-domain.com/admin.html
```
Enter your Master Admin PIN/Secret Key to unlock the console.

---

## 4. What You Can Manage in the Admin Panel

1. **🧭 Navigation & Submenu Builder:**
   - Add new Top-level menus or dropdown submenus.
   - All newly added menus automatically adopt the exact institutional terminal styling (`inst-nav-btn`, `inst-dd-item`, badges).
   - Reorder, change icons, badges (`PRO`, `LIVE`, `NEW`), and toggle items ON/OFF in real-time.

2. **📄 Dynamic Pages CMS (Markdown & HTML):**
   - Create custom pages at any URL slug (e.g. `/guide`, `/rules`, `/handbook`).
   - Write in **Markdown** (`.md`) or **HTML**.
   - Real-time side-by-side preview with custom SEO meta titles & descriptions.

3. **✍️ Blog & Article Studio:**
   - Write and publish market research posts, options strategies, and educational guides.
   - Appears at `/blog` and `/blog/<slug>`.
   - Supports cover images, tags, categories, and author badges.

4. **🎛️ Feature Flags & Toggles:**
   - Temporarily enable or disable specific features (e.g., experimental desks or submenus) with 1 click.

5. **🔑 Master Broker APIs:**
   - Configure Angel One SmartAPI, Kotak Neo, Upstox, or Fyers credentials without restarting the server.

6. **🔍 SEO & Google Search Console:**
   - Instant 1-click sitemap generation, Googlebot dynamic HTML simulation, and meta tag inspection.

---

## 5. Setting Cloud Environment Variables

To keep your secrets safe in Google Cloud Run:
```bash
gcloud run services update tradersdesk \
    --region asia-south1 \
    --set-env-vars "ADMIN_SECRET_KEY=your_secret_pin,SUPABASE_URL=your_supabase_url,SUPABASE_KEY=your_supabase_anon_key"
```

All CMS pages, blog articles, and navigation menus automatically synchronize to Supabase Cloud, ensuring your edits remain 100% permanent even if Cloud Run instances restart or scale down.
