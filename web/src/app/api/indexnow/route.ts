import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";

const INDEXNOW_KEY = "animevocab-indexnow-key";

/** Notify Bing/Yandex of new or updated URLs (IndexNow protocol). */
export async function POST(request: Request) {
  let urls: string[];
  try {
    const body = (await request.json()) as { urls?: string[] };
    urls = body.urls ?? [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!urls.length || urls.length > 10000) {
    return NextResponse.json({ error: "urls must contain 1–10000 entries" }, { status: 400 });
  }

  const payload = {
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    submitted: urls.length,
  });
}
