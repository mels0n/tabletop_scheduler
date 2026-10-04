import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";

// Liveness: GET /api/health returns { status: "ok" } and touches no dependency.
// Readiness: GET /api/health?deep=1 also round-trips the database.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  if (!deep) {
    return NextResponse.json({ status: "ok" });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "error" }, { status: 503 });
  }
}
