// Optional server-side storage so results from ALL students' devices are saved in one place.
// Works when an Upstash Redis / Vercel KV database is connected (env vars below).
// If not configured, the app still works and saves results in the browser (localStorage).
export const dynamic = "force-dynamic";

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const LIST = "backend-quiz-results";

async function redis(cmd) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Redis error");
  return (await res.json()).result;
}

export async function GET() {
  if (!URL_ || !TOKEN) return Response.json({ enabled: false, results: [] });
  try {
    const rows = await redis(["LRANGE", LIST, "0", "-1"]);
    return Response.json({ enabled: true, results: rows.map((r) => JSON.parse(r)) });
  } catch {
    return Response.json({ enabled: false, results: [] });
  }
}

export async function POST(req) {
  if (!URL_ || !TOKEN) return Response.json({ enabled: false }, { status: 501 });
  try {
    const r = await req.json();
    const clean = {
      id: String(r.id || ""),
      name: String(r.name || "").slice(0, 80),
      roll: String(r.roll || "").slice(0, 40),
      course: String(r.course || "").slice(0, 80),
      correct: Number(r.correct) || 0,
      wrong: Number(r.wrong) || 0,
      unanswered: Number(r.unanswered) || 0,
      total: Number(r.total) || 0,
      pct: Number(r.pct) || 0,
      submittedAt: Number(r.submittedAt) || Date.now(),
    };
    await redis(["RPUSH", LIST, JSON.stringify(clean)]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
