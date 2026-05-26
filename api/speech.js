// api/speech.js — Speech-to-Text (handles all audio formats)
// Supports: webm/opus (Chrome), mp4/aac (Safari/iOS), ogg/opus (Firefox)

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { audio, language, mimeType } = req.body || {};

  if (!audio) {
    return res.status(400).json({ error: "Missing audio data" });
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Google API key not configured" });
  }

  // Map browser mimeType to Google Cloud Speech encoding
  const encodingMap = {
    "audio/webm;codecs=opus": "WEBM_OPUS",
    "audio/webm": "WEBM_OPUS",
    "audio/ogg;codecs=opus": "OGG_OPUS",
    "audio/ogg": "OGG_OPUS",
    "audio/mp4": "MP4_AAC",      // iOS Safari
    "audio/aac": "MP4_AAC",
    "audio/mpeg": "MP3",
  };

  // Determine encoding — fall back to auto-detect if unknown
  const encoding = encodingMap[mimeType] || "ENCODING_UNSPECIFIED";

  // Sample rate: 48000 for webm/ogg, 44100 for mp4
  const sampleRate = (mimeType && mimeType.includes("mp4")) ? 44100 : 48000;

  try {
    const url = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

    const requestBody = {
      config: {
        encoding: encoding,
        sampleRateHertz: sampleRate,
        languageCode: language || "en-US",
        alternativeLanguageCodes: ["ga-IE", "en-US", "en-GB"],
        enableAutomaticPunctuation: true,
        model: "default",
      },
      audio: {
        content: audio,
      },
    };

    // If encoding is unspecified OR language is Irish, let Google auto-detect
    // Irish (ga-IE) doesn't support all encodings
    if (encoding === "ENCODING_UNSPECIFIED" || language === "ga-IE") {
      delete requestBody.config.encoding;
      delete requestBody.config.sampleRateHertz;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Speech API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const transcript = data.results
      ? data.results.map(r => r.alternatives[0].transcript).join(" ")
      : "";

    return res.status(200).json({ transcript, language });

  } catch (error) {
    console.error("Speech-to-text error:", error.message);
    return res.status(500).json({ error: "Speech recognition failed", detail: error.message });
  }
}
