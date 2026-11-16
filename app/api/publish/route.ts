import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { readToken } from "@/lib/limits";
import { errorResponse } from "@/lib/route";
import { SiteInputSchema } from "@/lib/schemas";
import { renderSite } from "@/lib/site";
import { loadTemplate } from "@/lib/template";

export const maxDuration = 60;
const MAX_BYTES = 3_000_000;

/**
 * Stores a finished site and returns a share link (/s/<id>).
 * The browser sends the generated content, not HTML: the server renders it
 * through the template itself, so nobody can host arbitrary HTML here.
 * Needs BLOB_READ_WRITE_TOKEN (Vercel Blob); without it the UI offers download only.
 */
export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Sharing is not configured." }, { status: 501 });
    if (!readToken(req.headers.get("x-job-token") || "")) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Site is too large." }, { status: 413 });
    const input = SiteInputSchema.parse(JSON.parse(raw));
    const site = renderSite(await loadTemplate(), input);
    const id = randomUUID().replace(/-/g, "");
    await put(`sites/${id}.html`, site, { access: "public", contentType: "text/html; charset=utf-8", addRandomSuffix: false });
    return NextResponse.json({ url: `${new URL(req.url).origin}/s/${id}` });
  } catch (err) {
    return errorResponse(err);
  }
}
