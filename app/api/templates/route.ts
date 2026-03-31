import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/templates?issuerId=xxx — List templates scoped to issuer
export async function GET(req: NextRequest) {
  try {
    const issuerId = req.nextUrl.searchParams.get("issuerId");
    const templates = await prisma.template.findMany({
      where: issuerId ? { issuerId } : undefined,
      orderBy: [{ channel: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        channel: true,
        type: true,
        description: true,
        body: true,
        status: true,
        dltTemplateId: true,
        subject: true,
        ctaText: true,
        ctaUrl: true,
        pushTitle: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("List templates error:", err);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

// POST /api/templates — Create a new template
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, channel, type, description, body: templateBody, subject, dltTemplateId, ctaText, ctaUrl, pushTitle } = body;

    if (!title || !templateBody) {
      return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
    }

    // Get default issuer
    const issuer = await prisma.issuer.findFirst();
    if (!issuer) {
      return NextResponse.json({ error: "No issuer found" }, { status: 400 });
    }

    const template = await prisma.template.create({
      data: {
        issuerId: issuer.id,
        title,
        channel: channel || "SMS",
        type: type || "promotional",
        description: description || "",
        body: templateBody,
        subject: subject || null,
        dltTemplateId: dltTemplateId || null,
        ctaText: ctaText || null,
        ctaUrl: ctaUrl || null,
        pushTitle: pushTitle || null,
        status: "draft",
      },
    });

    return NextResponse.json({ template });
  } catch (err) {
    console.error("Create template error:", err);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
