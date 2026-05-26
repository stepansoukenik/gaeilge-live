// api/speech.js — ElevenLabs Scribe Speech-to-Text
// Supports 97+ languages with auto-detection (including Irish)
// Uses same ELEVENLABS_API_KEY as TTS

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

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
  }

  try {
    // Convert base64 audio to a Blob/Buffer for multipart upload
    const audioBuffer = Buffer.from(audio, "base64");

    // Determine file extension from mimeType
    const extMap = {
      "audio/webm;codecs=opus": "webm",
      "audio/webm": "webm",
      "audio/ogg;codecs=opus": "ogg",
      "audio/ogg": "ogg",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
    };
    const ext = extMap[mimeType] || "webm";

    // Build multipart form data manually
    const boundary = "----ElevenLabsBoundary" + Date.now();
    const formParts = [];

    // Add audio file
    formParts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n` +
      `Content-Type: ${mimeType || "audio/webm"}\r\n\r\n`
    );

    // Add language_code field (optional — auto-detect if not specified)
    const langPart = language === "ga-IE" ? "ga" : language === "en-US" ? "en" : null;

    let formBody;
    const parts = [];
    
    // Use FormData-style with fetch
    // ElevenLabs STT expects multipart/form-data with "file" field
    const { Blob } = await import("buffer");
    
    // Simpler approach: build the request with raw boundaries
    const bodyParts = [];
    
    // File part
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType || "audio/webm"}\r\n\r\n`
    ));
    bodyParts.push(audioBuffer);
    bodyParts.push(Buffer.from("\r\n"));

    // Model part
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n`
    ));

    // Language code (helps accuracy but auto-detect works too)
    if (langPart) {
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\n${langPart}\r\n`
      ));
    }

    // End boundary
    bodyParts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(bodyParts);

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({
        error: "ElevenLabs STT failed",
        status: response.status,
        detail: errText,
      });
    }

    const data = await response.json();
    // ElevenLabs returns { text: "transcribed text", ... }
    const transcript = data.text || "";

    return res.status(200).json({
      transcript,
      language: data.language_code || language,
    });

  } catch (error) {
    return res.status(500).json({
      error: "Speech recognition failed",
      detail: error.message,
    });
  }
}
