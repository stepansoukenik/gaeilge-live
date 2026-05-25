// api/translate.js — Improved Vercel Serverless Function
// Supports: Lingvanex Cloud API, Google Cloud Translation, and LibreTranslate
// Includes a test mode for debugging

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET request = health check / test endpoint
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      provider: getProvider(),
      hasKey: !!getApiKey(),
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, from, to } = req.body || {};

  if (!text || !from || !to) {
    return res.status(400).json({ error: "Missing fields: text, from, to" });
  }

  const provider = getProvider();

  try {
    let translation;

    switch (provider) {
      case "lingvanex":
        translation = await translateLingvanex(text, from, to);
        break;
      case "google":
        translation = await translateGoogle(text, from, to);
        break;
      case "libretranslate":
        translation = await translateLibre(text, from, to);
        break;
      default:
        return res.status(500).json({
          error: "No translation provider configured. Set LINGVANEX_API_KEY, GOOGLE_TRANSLATE_API_KEY, or LIBRETRANSLATE_URL in Vercel environment variables.",
          help: "Visit your Vercel project → Settings → Environment Variables"
        });
    }

    return res.status(200).json({ translation, source: text, from, to, provider });

  } catch (error) {
    console.error(`[${provider}] Translation error:`, error.message);
    return res.status(500).json({
      error: "Translation failed",
      detail: error.message,
      provider,
    });
  }
}

// --- Determine which provider to use ---
function getProvider() {
  if (process.env.LINGVANEX_API_KEY) return "lingvanex";
  if (process.env.GOOGLE_TRANSLATE_API_KEY) return "google";
  if (process.env.LIBRETRANSLATE_URL) return "libretranslate";
  return "none";
}

function getApiKey() {
  return process.env.LINGVANEX_API_KEY || process.env.GOOGLE_TRANSLATE_API_KEY || null;
}

// --- Lingvanex Cloud API ---
async function translateLingvanex(text, from, to) {
  const apiKey = process.env.LINGVANEX_API_KEY;

  // Lingvanex uses full locale codes like "en_GB", "ga_IE"
  const langMap = {
    ga: "ga_IE",
    en: "en_GB",
  };

  const sourceLang = langMap[from] || from;
  const targetLang = langMap[to] || to;

  // Lingvanex Cloud API endpoint (current as of 2025)
  const response = await fetch("https://api-b2b.backenster.com/b1/api/v3/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": apiKey,  // Note: some versions use just the key, not "Bearer key"
    },
    body: JSON.stringify({
      from: sourceLang,
      to: targetLang,
      data: text,
      platform: "api",
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Lingvanex HTTP ${response.status}: ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Lingvanex returned non-JSON: ${responseText.slice(0, 200)}`);
  }

  // Lingvanex returns { err: null, result: "translated text" }
  if (data.err) {
    throw new Error(`Lingvanex error: ${JSON.stringify(data.err)}`);
  }

  return data.result || data.translation || responseText;
}

// --- Google Cloud Translation API v2 ---
async function translateGoogle(text, from, to) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  const url = `https://translation.googleapis.com/language/translate/v2`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: from,  // "ga" or "en" — Google supports ISO 639-1
      target: to,
      key: apiKey,
      format: "text",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.data.translations[0].translatedText;
}

// --- LibreTranslate (self-hosted or free instance) ---
async function translateLibre(text, from, to) {
  const baseUrl = process.env.LIBRETRANSLATE_URL || "https://libretranslate.com";
  const apiKey = process.env.LIBRETRANSLATE_API_KEY || "";

  const response = await fetch(`${baseUrl}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: from,  // "ga" or "en"
      target: to,
      api_key: apiKey,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LibreTranslate HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.translatedText;
}
