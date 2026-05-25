// api/translate.js — Vercel Serverless Function
// Proxies translation requests to Lingvanex API (keeps API key secure)

export default async function handler(req, res) {
  // CORS headers for the glasses browser
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, from, to } = req.body;

  if (!text || !from || !to) {
    return res.status(400).json({ error: "Missing required fields: text, from, to" });
  }

  // Lingvanex language codes
  const langMap = {
    "ga": "ga_IE",  // Irish
    "en": "en_GB",  // English (British)
  };

  const sourceLang = langMap[from] || from;
  const targetLang = langMap[to] || to;

  try {
    // --- Option A: Lingvanex API ---
    const apiKey = process.env.LINGVANEX_API_KEY;

    if (!apiKey) {
      // Fallback: use Google Cloud Translation if Lingvanex key not set
      return await googleTranslateFallback(req, res, text, from, to);
    }

    const response = await fetch("https://api-b2b.backenster.com/b1/api/v3/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: sourceLang,
        to: targetLang,
        data: text,
        platform: "api",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Lingvanex error:", response.status, errText);
      throw new Error(`Lingvanex API error: ${response.status}`);
    }

    const data = await response.json();
    const translation = data.result || data.translation || "";

    return res.status(200).json({ translation, source: text, from, to });

  } catch (error) {
    console.error("Translation error:", error);
    return res.status(500).json({ error: "Translation service unavailable" });
  }
}

// --- Fallback: Google Cloud Translation API ---
async function googleTranslateFallback(req, res, text, from, to) {
  const googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  if (!googleApiKey) {
    return res.status(500).json({
      error: "No translation API key configured. Set LINGVANEX_API_KEY or GOOGLE_TRANSLATE_API_KEY in Vercel environment variables."
    });
  }

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: from === "ga" ? "ga" : "en",
        target: to === "ga" ? "ga" : "en",
        format: "text",
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Translate error: ${response.status}`);
    }

    const data = await response.json();
    const translation = data.data.translations[0].translatedText;

    return res.status(200).json({ translation, source: text, from, to });

  } catch (error) {
    console.error("Google Translate fallback error:", error);
    return res.status(500).json({ error: "Translation service unavailable" });
  }
}
