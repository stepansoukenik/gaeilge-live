# 🍀 Gaeilge Live

**Real-time Irish ↔ English translator for Meta smart glasses.**

Irish (Gaeilge) isn't natively supported in Meta's Live Translation. This web app fills that gap — providing live speech-to-translation through the glasses speakers using ElevenLabs' multilingual AI.

**Try it:** [gaeilge-live.vercel.app](https://gaeilge-live.vercel.app)

![Status](https://img.shields.io/badge/status-Working%20MVP-brightgreen)
![Platform](https://img.shields.io/badge/platform-Ray--Ban%20Meta-black)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Demo

Speak English → hear Irish in your glasses. Speak Irish → hear English. Real-time, hands-free.

---

## Current Status

| Mode | Status | How It Works |
|------|--------|--------------|
| 🎧 **Ray-Ban Meta (Audio)** | ✅ Working | Speak → ElevenLabs STT → Translate → ElevenLabs TTS → glasses speakers |
| 🕶️ **Ray-Ban Display (HUD)** | ⏸️ Coming Soon | Awaiting platform mic access for web apps |

---

## How It Works

```
📱 Phone (paired to Ray-Ban Meta via Bluetooth)
───────────────────────────────────────────────
1. Mic captures speech
2. ElevenLabs Scribe → transcribes (97+ languages, Irish included)
3. Google Cloud Translation → Irish ↔ English
4. ElevenLabs TTS → natural voice speaks translation
5. Audio plays through glasses speakers via Bluetooth 🔊
```

Everything runs in the phone browser. The glasses are a Bluetooth audio device — mic picks up speech, speakers play translations.

---

## Quick Start

### Prerequisites

- Ray-Ban Meta glasses (Gen 2) paired to your phone
- Phone browser (Safari or Chrome)
- [Vercel](https://vercel.com) account (free)
- [ElevenLabs](https://elevenlabs.io) account (Starter plan, $5/mo — for multilingual TTS + Scribe STT)
- [Google Cloud](https://console.cloud.google.com) project with Cloud Translation API enabled

### Deploy

```bash
git clone https://github.com/stepansoukenik/gaeilge-live.git
cd gaeilge-live
npm install -g vercel
vercel login
vercel --prod
```

### Environment Variables (Vercel)

| Variable | Source | Purpose |
|----------|--------|---------|
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) → Profile | STT (Scribe) + TTS |
| `GOOGLE_TRANSLATE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → Credentials | Translation |
| `UPSTASH_REDIS_REST_URL` | [Upstash](https://console.upstash.com) | Display mode (future) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Display mode (future) |

---

## Usage

1. Pair your Ray-Ban Meta glasses to your phone (Bluetooth)
2. Open `gaeilge-live.vercel.app` in your phone browser
3. Select **🎧 Ray-Ban Meta**
4. Tap **● Listen** — speak in English or Irish
5. Hear the translation in your glasses speakers
6. Tap **⇄ Swap** to change direction
7. Tap **✕ Clear** to reset history

### Conversation History

All translations are kept in a scrollable session. Scroll up to see earlier translations. Tap **✕ Clear** to reset.

---

## Project Structure

```
gaeilge-live/
├── index.html              # App UI (device selector + audio mode)
├── styles.css              # Green theme, Helvetica, responsive
├── app.js                  # Core logic (STT + translate + TTS)
├── icon-96.png             # App icon (shamrock)
├── icon-192.png            # Larger icon
├── manifest.webmanifest    # Web app manifest
├── api/
│   ├── translate.js        # Google Translation API proxy
│   ├── speech.js           # ElevenLabs Scribe STT
│   ├── tts.js              # ElevenLabs TTS (multilingual)
│   └── session.js          # Redis session bridge (Display mode)
└── package.json
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Speech-to-Text | ElevenLabs Scribe v1 (97+ languages) |
| Translation | Google Cloud Translation API v2 |
| Text-to-Speech | ElevenLabs Multilingual v2 |
| Hosting | Vercel (free tier, HTTPS) |
| Frontend | Vanilla HTML/CSS/JS |
| Design | Dark green, Helvetica, responsive |
| Session Bridge | Upstash Redis (Display mode) |

---

## Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Irish STT accuracy | Some phrases may not transcribe perfectly | Speak clearly, short sentences |
| ~3-5s latency | Not simultaneous interpretation | Sentence-by-sentence acceptable |
| iOS autoplay restrictions | Audio requires user tap to unlock | App auto-unlocks on first interaction |
| Display mode blocked | MRBD web apps can't access mic | Audio mode via phone instead |
| ElevenLabs 30K chars/mo | Limited on Starter plan | Sufficient for demos + testing |

---

## Roadmap

- [x] ~~Working EN→GA translation with voice~~
- [x] ~~Working GA→EN translation with ElevenLabs Scribe~~
- [x] ~~Session history with scroll~~
- [ ] V2: DAT (Device Access Toolkit) native iOS app
- [ ] Re-enable Display mode when platform ships mic access
- [ ] Auto language detection (remove Swap button)
- [ ] Streaming transcription (lower latency)
- [ ] Specialized Irish pronunciation model

---

## License

MIT
