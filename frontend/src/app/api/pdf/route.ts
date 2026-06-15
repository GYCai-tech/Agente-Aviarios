import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8005";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const res = await fetch(`${BACKEND}/pdf/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "PDF no disponible" }, { status: res.status });
  }
  const bytes = await res.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="propuesta-gyc.pdf"',
    },
  });
}
