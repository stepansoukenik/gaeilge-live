# 🇮🇪 Gaeilge Live — Irish Translator for Meta Ray-Ban Display

Real-time Irish ↔ English translation web app designed for Meta Ray-Ban Display glasses.
Built as a testing prototype. Irish (Gaeilge) is not natively supported in Live Translation yet.

## 🎯 What It Does

- **Listen** to spoken Irish or English via the glasses microphone
- **Translate** in real-time using Lingvanex or Google Translate API
- **Display** translations on the 600×600px glasses HUD
- **Navigate** with D-pad (EMG wristband gestures → arrow keys)

## 📁 Project Structure

```
gaeilge-live/
├── public/
│   ├── index.html          # Main app (600×600 viewport)
│   ├── styles.css          # Dark theme, high contrast, D-pad focus
│   └── app.js              # Speech recognition + translation + navigation
├── api/
│   └── translate.js        # Vercel serverless function (API proxy)
├── vercel.json             # Vercel deployment config
├── package.json            # Project metadata
├── .env.example            # Environment variable template
└── README.md               # This file
```

## 🚀 Quick Start

### 1. Get a Translation API Key

**Option A — Lingvanex (recommended for Irish):**
1. Sign up at https://lingvanex.com/
2. Get your API key from the dashboard
3. Free tier includes 100K characters/month

**Option B — Google Cloud Translation:**
1. Go to https://console.cloud.google.com/
2. Enable the Cloud Translation API
3. Create an API key

### 2. Deploy to Vercel (Free)

```bash
# Install Vercel CLI (one-time)
npm install -g vercel

# Clone/create the project
mkdir gaeilge-live && cd gaeilge-live
# (paste the files from this package)

# Login to Vercel
vercel login

# Deploy
vercel

# Set your API key as environment variable
vercel env add LINGVANEX_API_KEY
# Paste your key when prompted

# Deploy to production
vercel --prod
```

Your app is now live at `https://gaeilge-live-XXXXX.vercel.app` (HTTPS ✓)

### 3. Add to Your Glasses

1. Open the **Meta AI app** on your phone
2. Go to **Devices** → **Display Glasses settings**
3. Navigate to **App connections** → **Web apps**
4. Tap **Add a web app**
5. Enter:
   - Name: `Gaeilge Live`
   - URL: `https://your-vercel-url.vercel.app`

### 4. Test Locally

```bash
# Install Vercel CLI
npm install -g vercel

# Create .env.local from .env.example and add your key
cp .env.example .env.local

# Run locally
vercel dev
```

Open http://localhost:3000 in your browser.
Use arrow keys to simulate D-pad navigation.

## 🎮 Controls (D-pad)

| Input | Action |
|-------|--------|
| ← → | Navigate between buttons |
| Enter / Select | Activate focused button |
| ● Listen | Start/stop speech recognition |
| ⇄ Swap | Switch Irish↔English direction |
| ✕ Clear | Reset display |

## 🔧 Design Constraints (MRBD)

| Constraint | Implementation |
|-----------|---------------|
| 600×600px viewport | Fixed layout, no scrolling needed |
| Dark background | Pure black (#000) — transparent on additive display |
| High contrast | White text, cyan (#4fc3f7) accents |
| D-pad navigation | Arrow keys + `.focusable` class |
| Readable fonts | 22-26px, system sans-serif |

## ⚠️ Known Limitations

1. **Speech Recognition for Irish**: The Web Speech API may have limited Irish
   (ga-IE) recognition accuracy. It works best for common phrases. Recognition
   quality depends on the browser engine on the glasses.
2. **API Latency**: Translation adds ~200-500ms round-trip. Acceptable for
   sentence-level translation but not word-by-word simultaneous.
3. **Free Tier Limits**: Lingvanex free tier = 100K chars/month. For heavier
   usage, consider their paid plans or Google Cloud's $10/month credit.

## 📄 License

MIT — Use freely for your Meta Ray-Ban Display projects.

