import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ sharing: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
}
