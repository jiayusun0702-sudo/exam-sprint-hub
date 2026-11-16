import { head } from "@vercel/blob";

// Generated sites are self-contained: inline script and style only, no network access.
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const meta = await head(`sites/${id}.html`);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return new Response("Not found", { status: 404 });
    return new Response(await res.text(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": CSP,
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "public, s-maxage=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
