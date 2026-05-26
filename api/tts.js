// api/tts.js — Text-to-Speech
// Primary: ElevenLabs (natural voices, Irish support)
// Fallback: Google Cloud TTS

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, lang } = req.body || {};
  if (!text) return res.status(400).json({ error: "Missing text" });

  // Try ElevenLabs first, fall back to Google
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    try {
      const audio = await elevenLabsTTS(text, lang, elevenLabsKey);
      return res.status(200).json({ audio, format: "audio/mp3" });
    } catch (err) {
      console.error("ElevenLabs failed, trying Google:", err.message);
    }
  }

  // Fallback: Google Cloud TTS
  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (googleKey) {
    try {
      const audio = await googleTTS(text, lang, googleKey);
      return res.status(200).json({ audio, format: "audio/mp3" });
    } catch (err) {
      return res.status(500).json({ error: "TTS failed", detail: err.message });
    }
  }

  return res.status(500).json({ error: "No TTS API key configured. Set ELEVENLABS_API_KEY or GOOGLE_TRANSLATE_API_KEY." });
}

// --- ElevenLabs TTS ---
async function elevenLabsTTS(text, lang, apiKey) {
  // Voice IDs — pick natural-sounding voices
  // You can change these to any ElevenLabs voice ID
  const voices = {
    "en-GB": "21m00Tcm4TlvDq8ikWAM",  // Rachel (English, warm)
    "en-US": "21m00Tcm4TlvDq8ikWAM",  // Rachel
    "ga-IE": "21m00Tcm4TlvDq8ikWAM",  // Use English voice for Irish text
  };

  const voiceId = voices[lang] || voices["en-GB"];
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2",  // Supports Irish!
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs HTTP ${response.status}: ${errText}`);
  }

  // ElevenLabs returns raw audio bytes
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return base64;
}

// --- Google Cloud TTS (fallback) ---
async function googleTTS(text, lang, apiKey) {
  const voiceConfig = {
    "en-GB": { languageCode: "en-GB", name: "en-GB-Standard-A" },
    "en-US": { languageCode: "en-US", name: "en-US-Standard-C" },
    "ga-IE": { languageCode: "en-GB", name: "en-GB-Standard-A" },
  };

  const voice = voiceConfig[lang] || voiceConfig["en-GB"];
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google TTS HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.audioContent;
}
