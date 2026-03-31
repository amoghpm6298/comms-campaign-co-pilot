import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/issuers — List all issuers the current user has access to
export async function GET() {
  try {
    const issuers = await prisma.issuer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return NextResponse.json({ issuers });
  } catch (err) {
    console.error("List issuers error:", err);
    return NextResponse.json({ error: "Failed to load issuers" }, { status: 500 });
  }
}
