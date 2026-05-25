// api/speech.js — Vercel Serverless Function for Speech-to-Text
// Uses Google Cloud Speech-to-Text API
// Receives audio blob, returns transcribed text

export const config: {
  // Auto-detect encoding based on what the browser sends
  encoding: "ENCODING_UNSPECIFIED",
  sampleRateHertz: 48000,
  languageCode: language || "en-US",
  alternativeLanguageCodes: ["ga-IE", "en-US"],
  enableAutomaticPunctuation: true,
},

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { audio, language } = req.body || {};

  if (!audio) {
    return res.status(400).json({ error: "Missing audio data" });
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Google API key not configured" });
  }

  try {
    // Google Cloud Speech-to-Text API v1
    const url = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: language || "en-US",
          alternativeLanguageCodes: ["ga-IE", "en-US"],
          enableAutomaticPunctuation: true,
        },
        audio: {
          content: audio, // base64-encoded audio
        },
      }),
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
