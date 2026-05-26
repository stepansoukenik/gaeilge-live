// api/tts.js — Google Cloud Text-to-Speech
// Returns audio as base64 MP3 for playback via <audio> element
// Routes properly through Bluetooth to glasses speakers

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, lang } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: "Missing text" });
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Google API key not configured" });
  }

  // Map our language codes to Google TTS language codes
  const langMap = {
    "en-GB": { languageCode: "en-GB", name: "en-GB-Standard-A" },
    "en-US": { languageCode: "en-US", name: "en-US-Standard-C" },
    "ga-IE": { languageCode: "en-GB", name: "en-GB-Standard-A" }, // Irish TTS not available, use English
    // Note: Google Cloud TTS doesn't support Irish (ga-IE) natively
    // For Irish output, we fall back to English voice reading Irish text
  };

  const voiceConfig = langMap[lang] || langMap["en-GB"];

  try {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: text },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 0.9,
          pitch: 0,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`TTS API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    // Returns { audioContent: "base64-encoded-audio" }
    return res.status(200).json({
      audio: data.audioContent,
      format: "audio/mp3",
    });

  } catch (error) {
    console.error("TTS error:", error.message);
    return res.status(500).json({ error: "TTS failed", detail: error.message });
  }
}
