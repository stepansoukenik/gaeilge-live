# 🍀 Gaeilge Live

**Real-time Irish ↔ English translator for Meta smart glasses.**

Irish (Gaeilge) isn't natively supported in Meta's Live Translation. This web app fills that gap — providing live speech-to-translation through the glasses speakers.

![Status](https://img.shields.io/badge/status-MVP-green)
![Platform](https://img.shields.io/badge/platform-Ray--Ban%20Meta-black)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Current Status

| Mode | Status | Notes |
|------|--------|-------|
| 🎧 **Ray-Ban Meta (Audio)** | ✅ Working | Speak → Translate → Hear translation in glasses |
| 🕶️ **Ray-Ban Display (HUD)** | ⏸️ Paused | Awaiting platform mic access for web apps |

### What Works Today

Open `gaeilge-live.vercel.app` on your phone → select Audio mode → speak Irish or English → hear the translation through your Ray-Ban Meta speakers. That's it.

### Why Display Mode is Paused

Meta Ray-Ban Display web apps currently cannot access the microphone (`getUserMedia` is blocked). Additionally, activating the phone mic while glasses are Bluetooth-paired triggers a phone call UI on the glasses. The Display mode architecture (phone↔glasses bridge) is fully built and will be re-enabled when the platform team ships mic access for web apps.

---

## How It Works (Audio Mode)

```
📱 Your phone (paired to Ray-Ban Meta via Bluetooth)
─────────────────────────────────────────────────────
1. Mic captures speech (Web Speech API or MediaRecorder)
2. Google Cloud Speech-to-Text → transcript
3. Google Cloud Translation → Irish↔English
4. Web Speech Synthesis → plays through glasses speakers 🔊
```

Everything runs in the phone browser. The glasses are a Bluetooth audio device — mic picks up speech, speakers play translations.

---

## Quick Start

### Prerequisites

- Ray-Ban Meta glasses (Gen 2) paired to your phone
- Phone browser (Safari or Chrome)
- [Vercel](https://vercel.com) account (free)
- [Google Cloud](https://console.cloud.google.com) project with:
  - Cloud Translation API enabled
  - Cloud Speech-to-Text API enabled
  - API key created

### Deploy

```bash
git clone https://github.com/stepansoukenik/gaeilge-live.git
cd gaeilge-live
npm install -g vercel
vercel login
vercel --prod
```

### Environment Variables (Vercel)

| Variable | Source |
|----------|--------|
| `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Console → Credentials |
| `UPSTASH_REDIS_REST_URL` | Upstash Console (for Display mode) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console (for Display mode) |

---

## Usage

1. Pair your Ray-Ban Meta glasses to your phone
2. Open `gaeilge-live.vercel.app` in your phone browser
3. Select **🎧 Ray-Ban Meta**
4. Tap **● Listen** — speak Irish or English
5. Hear the translation in your glasses speakers
6. Tap **⇄ Swap** to change direction (GA→EN or EN→GA)

---

## Project Structure

```
gaeilge-live/
├── index.html              # App UI (device selector + audio mode)
├── styles.css              # Green theme, Helvetica, responsive
├── app.js                  # Speech recognition + translation + TTS
├── icon-96.png             # App icon
├── icon-192.png            # Larger icon
├── manifest.webmanifest    # Web app manifest
├── api/
│   ├── translate.js        # Google Translation API proxy
│   ├── speech.js           # Google Speech-to-Text proxy (fallback)
│   └── session.js          # Redis session bridge (Display mode)
└── package.json
```

---

## Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| MRBD web apps can't access mic | Display mode blocked | Audio mode uses phone mic instead |
| BT phone call hijack | Phone mic triggers call UI on Display glasses | Use separate device or Audio mode |
| Irish speech recognition accuracy | ga-IE recognition is limited | English mode more reliable; translate EN→GA |
| iOS Web Speech API | Fails on Safari/Chrome iOS | MediaRecorder + Cloud Speech fallback |
| ~2-4s latency per translation | Not real-time simultaneous | Sentence-by-sentence, acceptable for demo |

---

## Roadmap

- [ ] Platform mic access for MRBD web apps → re-enable Display mode
- [ ] Server-Sent Events (replace polling)
- [ ] Auto language detection
- [ ] Improved Irish ASR model
- [ ] Offline phrase book for common expressions
- [ ] Continuous streaming transcription

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla HTML/CSS/JS |
| Hosting | Vercel (free tier, HTTPS) |
| Translation | Google Cloud Translation API v2 |
| Speech Recognition | Web Speech API + Google Cloud Speech-to-Text |
| TTS | Web Speech Synthesis API |
| Session Bridge | Upstash Redis (Display mode) |
| Design | Dark green, Helvetica, responsive |

---

## License

MIT

---

*Built in 24 hours as a prototype demonstrating Irish language support on Meta smart glasses.*
