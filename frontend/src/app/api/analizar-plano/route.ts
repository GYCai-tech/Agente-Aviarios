import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8005";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const res = await fetch(`${BACKEND}/analizar-plano-imagen`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
