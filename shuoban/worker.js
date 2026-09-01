// 说伴 TTS + ASR。密钥：Worker 加密变量 DASHSCOPE_API_KEY、SHUOBAN_GATE
// 请求头 X-Shuoban-Key 必须等于 SHUOBAN_GATE
// POST / 或 /tts  {text, rate} → audio/mpeg
// POST /asr       原始音频 → {text}

const LIMIT_PER_MIN = 40;
const MAX_TTS_CHARS = 400;
const MAX_ASR_BYTES = 2 * 1024 * 1024;

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Shuoban-Key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const json = (obj, status) =>
      new Response(JSON.stringify(obj), {
        status: status || 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

    const gate = env.SHUOBAN_GATE;
    if (!gate) return json({ error: "gate not set" }, 503);
    if ((req.headers.get("X-Shuoban-Key") || "") !== gate) {
      return json({ error: "forbidden" }, 403);
    }
    if (await overLimit(req)) return json({ error: "slow down" }, 429);

    const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
    const key = env.DASHSCOPE_API_KEY;
    if (path === "/asr") return asr(req, key, cors, json);
    return tts(req, key, cors, json);
  },
};

async function overLimit(req) {
  const ip = req.headers.get("CF-Connecting-IP") || "0";
  const bucket = Math.floor(Date.now() / 60000);
  const key = new Request("https://shuoban.rate/" + ip + "/" + bucket);
  const cache = caches.default;
  let n = 1;
  const hit = await cache.match(key);
  if (hit) n = (parseInt(await hit.text(), 10) || 0) + 1;
  await cache.put(
    key,
    new Response(String(n), { headers: { "Cache-Control": "max-age=120" } })
  );
  return n > LIMIT_PER_MIN;
}

async function tts(req, key, cors, json) {
  const { text, rate } = await req.json();
  if (!text) return new Response("no text", { status: 400, headers: cors });
  if (String(text).length > MAX_TTS_CHARS) return json({ error: "too long" }, 413);
  const speed = Math.min(2, Math.max(0.5, Number(rate) || 1));
  const ali = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "cosyvoice-v3-flash",
        input: {
          text,
          voice: "loongluna_v3",
          format: "mp3",
          rate: speed,
          language_hints: ["en"],
        },
      }),
    }
  );
  const body = await ali.json();
  const url = body && body.output && body.output.audio && body.output.audio.url;
  if (!ali.ok || !url) return json(body, 502);
  const audio = await fetch(url);
  return new Response(audio.body, {
    headers: { ...cors, "Content-Type": "audio/mpeg" },
  });
}

async function asr(req, key, cors, json) {
  const buf = await req.arrayBuffer();
  if (!buf || buf.byteLength < 200) return json({ text: "" });
  if (buf.byteLength > MAX_ASR_BYTES) return json({ error: "too large" }, 413);
  const mime = (req.headers.get("Content-Type") || "audio/webm").split(";")[0].trim();
  const dataUri = "data:" + mime + ";base64," + bytesToB64(buf);
  const ali = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "X-DashScope-SSE": "disable",
      },
      body: JSON.stringify({
        model: "qwen3-asr-flash",
        input: {
          messages: [
            { role: "user", content: [{ audio: dataUri }] },
          ],
        },
        parameters: {
          asr_options: { language: "en", enable_itn: true },
        },
      }),
    }
  );
  const body = await ali.json();
  if (!ali.ok) return json(body, 502);
  return json({ text: pickAsrText(body) });
}

function bytesToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function pickAsrText(body) {
  const o = (body && body.output) || body || {};
  if (typeof o.text === "string" && o.text.trim()) return o.text.trim();
  const ch = o.choices && o.choices[0];
  const msg = ch && ch.message;
  if (msg && typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
  if (msg && Array.isArray(msg.content)) {
    const t = msg.content.map((x) => (x && (x.text || x)).toString()).filter(Boolean).join(" ").trim();
    if (t) return t;
  }
  const nested = o.output && o.output.sentence && o.output.sentence.text;
  return (nested || "").trim();
}
