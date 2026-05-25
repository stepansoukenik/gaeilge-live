// api/session.js — Session bridge between phone and glasses
// Uses Upstash Redis REST API (free tier: 10K commands/day)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: "Redis not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN." });
  }

  const headers = { Authorization: `Bearer ${UPSTASH_TOKEN}` };

  // --- POST: Phone pushes a translation ---
  if (req.method === "POST") {
    const { sessionId, source, translation, direction } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    const payload = JSON.stringify({
      source: source || "",
      translation: translation || "",
      direction: direction || "ga-en",
      timestamp: Date.now(),
    });

    // Store with 5-minute expiry (TTL 300s)
    const redisResp = await fetch(`${UPSTASH_URL}/SET/session:${sessionId}/${encodeURIComponent(payload)}/EX/300`, {
      method: "POST",
      headers,
    });

    if (!redisResp.ok) {
      return res.status(500).json({ error: "Failed to store session data" });
    }

    return res.status(200).json({ ok: true });
  }

  // --- GET: Glasses polls for latest translation ---
  if (req.method === "GET") {
    const sessionId = req.query.id;
    if (!sessionId) return res.status(400).json({ error: "Missing ?id= parameter" });

    const redisResp = await fetch(`${UPSTASH_URL}/GET/session:${sessionId}`, {
      method: "POST",
      headers,
    });

    if (!redisResp.ok) {
      return res.status(500).json({ error: "Failed to read session" });
    }

    const data = await redisResp.json();

    if (!data.result) {
      return res.status(200).json({ source: "", translation: "", direction: "ga-en", timestamp: 0 });
    }

    try {
      const parsed = JSON.parse(data.result);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ source: "", translation: "", direction: "ga-en", timestamp: 0 });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
