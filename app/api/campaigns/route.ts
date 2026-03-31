import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 10;

// GET /api/campaigns?issuerId=xxx&page=1 — List campaigns with pagination
export async function GET(req: NextRequest) {
  try {
    const issuerId = req.nextUrl.searchParams.get("issuerId");
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
    const where = issuerId ? { issuerId } : undefined;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          goal: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { strategies: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (err) {
    console.error("List campaigns error:", err);
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
  }
}
