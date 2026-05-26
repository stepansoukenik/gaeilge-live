// api/tts.js — ElevenLabs Text-to-Speech ONLY
// Uses eleven_multilingual_v2 model (supports Irish)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, lang } = req.body || {};
  if (!text) return res.status(400).json({ error: "Missing text" });

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "ELEVENLABS_API_KEY not found",
      debug: "Environment variable is not set or not readable",
      envKeys: Object.keys(process.env).filter(k => k.includes("ELEVEN") || k.includes("eleven")),
    });
  }

  // Voice ID: Rachel (English, warm) — works with multilingual model
  const voiceId = "21m00Tcm4TlvDq8ikWAM";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
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
      return res.status(500).json({
        error: "ElevenLabs API failed",
        status: response.status,
        detail: errText,
        keyPrefix: apiKey.substring(0, 8) + "...",
      });
    }

    // ElevenLabs returns raw audio bytes
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return res.status(200).json({
      audio: base64,
      format: "audio/mp3",
    });

  } catch (error) {
    return res.status(500).json({
      error: "TTS request failed",
      detail: error.message,
      keyPrefix: apiKey.substring(0, 8) + "...",
    });
  }
}
