import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

// GET /api/datasets?issuerId=xxx — List datasets scoped to issuer
export async function GET(req: NextRequest) {
  try {
    const issuerId = req.nextUrl.searchParams.get("issuerId");
    const datasets = await prisma.dataset.findMany({
      where: issuerId ? { issuerId } : undefined,
      orderBy: [{ type: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        fileName: true,
        fileSize: true,
        rowCount: true,
        columns: true,
        status: true,
        processingStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ datasets });
  } catch (err) {
    console.error("List datasets error:", err);
    return NextResponse.json({ error: "Failed to load datasets" }, { status: 500 });
  }
}

// POST /api/datasets — Upload a new dataset (CSV)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || "";
    const type = formData.get("type") as string;
    const file = formData.get("file") as File;

    if (!title || !file) {
      return NextResponse.json({ error: "Title and file are required" }, { status: 400 });
    }

    // Get default issuer
    const issuer = await prisma.issuer.findFirst();
    if (!issuer) {
      return NextResponse.json({ error: "No issuer found" }, { status: 400 });
    }

    // Save file to data/ directory
    const dataDir = path.join(process.cwd(), "data");
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(dataDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Parse CSV headers and count rows
    const content = buffer.toString("utf-8");
    const lines = content.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const rowCount = lines.length - 1;

    // Sample rows
    const sampleRows = lines.slice(1, 6).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    });

    const dataset = await prisma.dataset.create({
      data: {
        issuerId: issuer.id,
        title,
        description,
        type,
        fileName,
        fileSize: file.size,
        filePath: filePath,
        rowCount,
        columns: JSON.stringify(headers),
        sampleRows: JSON.stringify(sampleRows),
        status: "enabled",
        processingStatus: "successful",
      },
    });

    return NextResponse.json({ dataset });
  } catch (err) {
    console.error("Create dataset error:", err);
    return NextResponse.json({ error: "Failed to create dataset" }, { status: 500 });
  }
}
