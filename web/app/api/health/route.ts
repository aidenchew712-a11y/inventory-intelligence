export async function GET() { return Response.json({ status: "ok", application: "stockroom", release: "1.0.0" }, { headers: { "Cache-Control": "no-store" } }); }
