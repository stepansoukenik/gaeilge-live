# 🍀 Gaeilge Live

**Real-time Irish ↔ English translator for Meta smart glasses.**

Irish (Gaeilge) isn't natively supported in Meta's Live Translation — this web app fills that gap. Works with both Ray-Ban Display (HUD) and Ray-Ban Meta (audio-only).

![Status](https://img.shields.io/badge/status-MVP-green)
![Platform](https://img.shields.io/badge/platform-Meta%20Glasses-black)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Two Modes

### 🕶️ Ray-Ban Display (HUD Mode)
Phone captures speech → translates → displays on glasses HUD via session bridge.

```
📱 Phone                          🕶️ Glasses HUD
─────────                         ──────────────
Mic → Transcribe                  Polls session every 1.5s
     → Translate                  Displays translation (600×600)
     → Push to Redis              Speaks translation (TTS)
         ↓                              ↑
         └──── Upstash Redis ───────────┘
```

### 🎧 Ray-Ban Meta (Audio-Only Mode)
Single device — phone listens, translates, speaks translation through glasses speakers via Bluetooth.

```
📱 Phone (connected to glasses via Bluetooth)
─────────
Mic → Transcribe → Translate → TTS → 🔊 Glasses speakers
```

---

## Quick Start

### Prerequisites

- Meta smart glasses (Display or Meta Gen 2)
- [Vercel](https://vercel.com) account (free)
- [Google Cloud](https://console.cloud.google.com) project with:
  - Cloud Translation API enabled
  - Cloud Speech-to-Text API enabled
  - API key created
- [Upstash](https://upstash.com) Redis database (free — needed for Display mode only)

### 1. Deploy

```bash
git clone https://github.com/stepansoukenik/gaeilge-live.git
cd gaeilge-live
npm install -g vercel
vercel login
vercel --prod
```

### 2. Environment Variables

In Vercel → Project → Settings → Environment Variables:

| Variable | Source | Required for |
|----------|--------|--------------|
| `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Console → Credentials | Both modes |
| `UPSTASH_REDIS_REST_URL` | Upstash Console → REST API | Display mode |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → REST API | Display mode |

### 3. Add to Glasses (Display mode)

1. Meta AI app → Devices → App connections → Web apps → Add
2. Name: `Gaeilge Live`
3. URL: `https://gaeilge-live.vercel.app`

---

## Usage

### Audio-Only Mode (Ray-Ban Meta)

1. Open `gaeilge-live.vercel.app` on your phone
2. Select **🎧 Ray-Ban Meta**
3. Tap **● Listen** — speak Irish or English
4. Translation plays through glasses speakers automatically
5. Tap **⇄ Swap** to change direction

### Display Mode (Ray-Ban Display)

**On your phone/laptop:**
1. Open `gaeilge-live.vercel.app`
2. Select **🕶️ Ray-Ban Display** → **📱 Phone**
3. Note the 4-digit session code
4. Tap **● Listen** and speak

**On your glasses:**
1. Launch Gaeilge Live from the app launcher
2. Select **🕶️ Glasses**
3. Enter the 4-digit code via D-pad number pad
4. Translations appear on HUD + spoken aloud

---

## Project Structure

```
gaeilge-live/
├── index.html              # Device selector + all mode UIs
├── styles.css              # Green theme, Helvetica, responsive
├── app.js                  # Core logic (both modes)
├── icon-96.png             # App icon (glasses launchpad)
├── icon-192.png            # Larger icon
├── manifest.webmanifest    # Web app manifest
├── api/
│   ├── translate.js        # Google Translation API proxy
│   ├── speech.js           # Google Speech-to-Text proxy
│   └── session.js          # Upstash Redis session bridge
└── package.json
```

---

## Design

| Element | Value |
|---------|-------|
| Background | Dark green (#0a1f0a) |
| Accents | Green (#2E7D32, #66BB6A) |
| Text | White, Helvetica Neue |
| Viewport | 600×600 (glasses), responsive (phone/desktop) |
| Navigation | D-pad (arrow keys + Enter) |
| Icon | Shamrock in speech bubble (transparent PNG) |

---

## Known Limitations

| Issue | Status |
|-------|--------|
| MRBD web apps can't access microphone | Waiting for Meta platform team |
| Phone mic triggers BT call mode on glasses | Workaround: use separate device as mic |
| Web Speech API unavailable on iOS/glasses | MediaRecorder + Cloud Speech fallback |
| Irish speech recognition accuracy | Limited in ga-IE; English mode more reliable |
| ~2s translation latency | Polling (1.5s) + API round-trip (~300ms) |
| Session expires after 5 min idle | Redis TTL — reconnect if needed |

---

## Roadmap

- [ ] Mic access for MRBD web apps (platform dependency)
- [ ] Server-Sent Events (replace polling for instant updates)
- [ ] Auto language detection
- [ ] Phrase history (scroll recent translations)
- [ ] Offline phrase book
- [ ] Specialized Irish ASR model

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla HTML/CSS/JS |
| Hosting | Vercel (free tier) |
| Translation | Google Cloud Translation API v2 |
| Speech | Google Cloud Speech-to-Text + Web Speech API |
| TTS | Web Speech Synthesis API |
| Session | Upstash Redis (REST API) |

---

## License

MIT

---

*Built as a prototype demonstrating Irish language support on Meta smart glasses.*
