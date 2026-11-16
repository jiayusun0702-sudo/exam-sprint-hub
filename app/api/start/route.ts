import { NextResponse } from "next/server";
import { clientIp, startJob } from "@/lib/limits";
import { errorResponse } from "@/lib/route";

export async function POST(req: Request) {
  try {
    const token = await startJob(clientIp(req));
    return NextResponse.json({ token });
  } catch (err) {
    return errorResponse(err);
  }
}
