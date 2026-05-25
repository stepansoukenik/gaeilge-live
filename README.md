# 🍀 Gaeilge Live

**Real-time Irish ↔ English translator for Meta Ray-Ban Display glasses.**

Irish (Gaeilge) isn't natively supported in Meta's Live Translation — this web app fills that gap using a phone↔glasses bridge architecture.

![Status](https://img.shields.io/badge/status-MVP-green)
![Platform](https://img.shields.io/badge/platform-Meta%20Ray--Ban%20Display-black)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## How It Works

```
📱 Phone                          🕶️ Glasses
─────────                         ──────────
Mic → Speech Recognition          Polls session every 1.5s
     → Google Translate API       Displays translation on HUD
     → Push to shared session     (600×600 dark green UI)
         ↓                              ↑
         └──── Upstash Redis ───────────┘
               (session bridge)
```

The phone captures speech and translates it. The glasses display the result. A 4-digit session code links the two devices — entered via a D-pad navigable number pad on the glasses.

---

## Features

- 🎙️ **Live speech recognition** via Web Speech API (phone)
- 🇮🇪 **Irish ↔ English translation** via Google Cloud Translation API
- 🕶️ **Glasses-optimized display** — 600×600px, dark green theme, high contrast
- 🎮 **D-pad navigation** — fully usable with EMG wristband gestures
- 🔢 **Number pad pairing** — no keyboard needed on glasses
- 📱 **Phone↔Glasses bridge** — real-time sync via Upstash Redis
- 🍀 **App icon** — shows in glasses launchpad

---

## Quick Start

### Prerequisites

- Meta Ray-Ban Display glasses with developer mode enabled
- [Vercel](https://vercel.com) account (free tier)
- [Google Cloud](https://console.cloud.google.com) project with Translation API enabled
- [Upstash](https://upstash.com) Redis database (free tier)

### 1. Clone & Deploy

```bash
git clone https://github.com/stepansoukenik/gaeilge-live.git
cd gaeilge-live

# Deploy to Vercel
npm install -g vercel
vercel login
vercel --prod
```

### 2. Set Environment Variables

In Vercel → Project → Settings → Environment Variables:

| Variable | Source | Purpose |
|----------|--------|---------|
| `GOOGLE_TRANSLATE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) | Translation + Speech |
| `UPSTASH_REDIS_REST_URL` | [Upstash Dashboard](https://console.upstash.com) | Session bridge |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Dashboard | Auth for Redis |

### 3. Add to Glasses

1. Open **Meta AI app** → Devices → Display Glasses
2. App connections → Web apps → Add
3. Name: `Gaeilge Live` / URL: `https://gaeilge-live.vercel.app`

---

## Usage

### On your phone:
1. Open `gaeilge-live.vercel.app`
2. Select **📱 Phone (mic + send)**
3. Note the **4-digit session code**
4. Tap **● Listen** and speak

### On your glasses:
1. Launch **Gaeilge Live** from the app launcher
2. Select **🕶️ Glasses (display)**
3. Use the D-pad number pad to enter the session code
4. Translations appear automatically on the HUD

### D-Pad Controls

| Input | Mode Select | Number Pad | Phone |
|-------|-------------|------------|-------|
| ← → | Switch mode | Move between digits | Switch buttons |
| ↑ ↓ | — | Move between rows | — |
| Select | Confirm | Press digit | Activate button |

---

## Project Structure

```
gaeilge-live/
├── index.html              # App shell (mode selector, numpad, phone, glasses views)
├── styles.css              # Green theme, Helvetica, D-pad focus styles
├── app.js                  # Core logic (speech, translation, session bridge)
├── icon-96.png             # App icon (glasses launchpad)
├── icon-192.png            # App icon (larger)
├── manifest.webmanifest    # Web app manifest
├── api/
│   ├── translate.js        # Translation serverless function (Google API)
│   └── session.js          # Session bridge (Upstash Redis)
└── package.json
```

---

## Design Constraints (MRBD)

| Constraint | Implementation |
|-----------|---------------|
| 600×600px viewport | Fixed layout, no scrolling |
| Black = transparent | Dark green (#0a1f0a) background |
| High contrast | White text, green (#66BB6A) accents |
| D-pad only | `.focusable` class + arrow key handlers |
| Readable fonts | Helvetica Neue, 22–28px |
| No keyboard | Visual number pad for input |
| No mic access | Phone-as-mic bridge architecture |

---

## Limitations & Known Issues

1. **Irish speech recognition** — Web Speech API has limited `ga-IE` accuracy. Works better for common phrases. English mode is more reliable.
2. **Latency** — ~1.5s polling interval + ~300ms API round-trip = ~2s total delay.
3. **Session expiry** — Sessions expire after 5 minutes of inactivity (Redis TTL).
4. **Free tier limits** — Google Translation: $10/month credit (~500K chars). Upstash: 10K commands/day.

---

## Roadmap

- [ ] Server-Sent Events (SSE) for instant display updates
- [ ] Auto language detection (remove manual swap)
- [ ] Phrase history (scroll through recent translations)
- [ ] Offline phrase book for common expressions
- [ ] Specialized Irish ASR model integration

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla HTML/CSS/JS |
| Hosting | Vercel (free tier, auto-HTTPS) |
| Translation | Google Cloud Translation API v2 |
| Session sync | Upstash Redis (REST API) |
| Speech | Web Speech API (phone browser) |
| Design | 600×600 dark green, Helvetica, D-pad focus |

---

## License

MIT — Use freely for your Meta Ray-Ban Display projects.

---

*Built as a prototype to demonstrate Irish language support on Meta Ray-Ban Display glasses.*
