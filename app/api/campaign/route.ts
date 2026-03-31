import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/campaign?id=xxx — Load campaign state
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("id");
  if (!campaignId) return NextResponse.json({ error: "Missing campaign id" }, { status: 400 });

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        conversation: true,
        strategies: {
          where: { archived: false },
          include: {
            paths: {
              include: {
                templateBriefs: true,
                steps: { orderBy: { sortOrder: "asc" } },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        campaignDatasets: true,
        versions: { orderBy: { version: "asc" } },
        waves: { orderBy: { waveNumber: "asc" } },
      },
    });

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    // Transform strategies to UI format
    const strategies = campaign.strategies.map((s) => {
      const sAnalysis = JSON.parse(s.analysis || "{}");
      return {
      id: s.id,
      name: s.name,
      recommended: s.recommended,
      approach: s.approach,
      estimatedImpact: s.estimatedImpact,
      totalReach: s.totalReach,
      totalEligible: (sAnalysis.total_eligible as number) || 0,
      exclusions: JSON.parse(s.exclusions),
      layers: s.paths.map((p) => ({
        name: p.name,
        segment: p.segmentDescription,
        segmentSize: p.segmentSize,
        channel: p.steps.length > 0
          ? [...new Set(p.steps.map((st) => st.channel))]
          : JSON.parse(p.channels),
        timing: p.timing,
        frequency: p.frequency,
        evolution: p.evolution,
        exitCondition: p.exitCondition,
        templates: p.steps.length > 0 ? p.steps.length : p.templateBriefs.length,
        templateBriefs: p.steps.length > 0
          ? p.steps.map((st) => ({ channel: st.channel, content: st.brief }))
          : p.templateBriefs.map((tb) => ({ channel: tb.channel, content: tb.content })),
        steps: p.steps.map((st) => ({
          id: st.id,
          day: st.dayOffset,
          channel: st.channel,
          timing: st.timing,
          brief: st.brief,
        })),
      })),
    };
    });

    // Parse conversation messages
    const messages = campaign.conversation
      ? JSON.parse(campaign.conversation.messages).map((m: { role: string; content: string; timestamp: string }) => ({
          id: m.timestamp,
          role: m.role === "assistant" ? "ai" : "user",
          content: m.content,
        }))
      : [];

    // Transform waves for v2
    const waves = campaign.waves.map((w) => ({
      id: w.id,
      waveNumber: w.waveNumber,
      name: w.name,
      status: w.status,
      version: w.version,
      journeyTree: JSON.parse(w.journeyTree),
      audienceCount: w.audienceCount,
      blueprint: w.blueprint,
      metrics: JSON.parse(w.metrics),
    }));

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        goal: campaign.goal,
        status: campaign.status,
        mode: campaign.mode,
        activeStrategyId: campaign.activeStrategyId,
        goLiveAt: campaign.goLiveAt,
      },
      strategies,
      waves,
      messages,
      versions: campaign.versions,
    });
  } catch (err) {
    console.error("Load campaign error:", err);
    return NextResponse.json({ error: "Failed to load campaign", details: String(err) }, { status: 500 });
  }
}

// PATCH /api/campaign — Update campaign status (go live / schedule)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { campaignId, status, scheduledAt } = body;

    if (!campaignId || !status) {
      return NextResponse.json({ error: "Missing campaignId or status" }, { status: 400 });
    }

    const data: Record<string, unknown> = { status };
    if (status === "live") {
      data.goLiveAt = new Date();
    } else if (status === "scheduled" && scheduledAt) {
      data.goLiveAt = new Date(scheduledAt);
    }

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data,
    });

    // Update wave statuses to match campaign
    if (status === "live" || status === "scheduled") {
      await prisma.wave.updateMany({
        where: { campaignId, status: "draft" },
        data: { status },
      });
    }

    return NextResponse.json({ campaign: { id: campaign.id, status: campaign.status, goLiveAt: campaign.goLiveAt } });
  } catch (err) {
    console.error("Update campaign error:", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}
