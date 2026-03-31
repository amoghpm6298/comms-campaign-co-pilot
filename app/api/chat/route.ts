import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runPlanner, runReviewer } from "@/lib/claude";

function log(msg: string, data?: unknown) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] [CHAT-API] ${msg}`, typeof data === "string" ? data : JSON.stringify(data).substring(0, 300));
  } else {
    console.log(`[${ts}] [CHAT-API] ${msg}`);
  }
}

// --- Types ---

interface ChatRequest {
  campaignId?: string;
  issuerId: string;
  mode: "creation" | "feedback" | "live" | "wave_creation" | "wave_feedback";
  campaignMode?: "v1" | "v2";
  message: string;
  dataDatasetIds?: string[];
  exclusionDatasetIds?: string[];
  selectedStrategyId?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// --- Helpers ---

function pathsToLayers(paths: Record<string, unknown>[]) {
  return paths.map((path: Record<string, unknown>) => {
    const steps = (path.steps as Record<string, unknown>[]) || [];
    const legacyBriefs = (path.template_briefs as { channel: string; content: string }[]) || [];

    if (steps.length > 0) {
      // New multi-step format
      const channels = [...new Set(steps.map(s => s.channel as string))];
      return {
        name: path.name as string,
        segment: path.segment as string,
        segmentSize: path.segment_size as number,
        channel: channels,
        exitCondition: (path.exit_condition as string) || "",
        steps: steps.map((s, i) => ({
          day: (s.day as number) || i + 1,
          channel: (s.channel as string) || "SMS",
          timing: (s.timing as string) || "",
          brief: (s.brief as string) || "",
        })),
        // Legacy fields derived from steps
        timing: steps[0] ? `Day ${(steps[0] as Record<string, unknown>).day}, ${(steps[0] as Record<string, unknown>).timing || ""}`.trim() : "",
        frequency: `${steps.length} steps over ${(steps[steps.length - 1] as Record<string, unknown>).day} days`,
        evolution: "",
        templates: steps.length,
        templateBriefs: steps.map(s => ({ channel: s.channel as string, content: s.brief as string })),
      };
    }

    // Legacy flat format fallback
    return {
      name: path.name as string,
      segment: path.segment as string,
      segmentSize: path.segment_size as number,
      channel: (path.channels as string[]) || [],
      timing: (path.timing as string) || "",
      frequency: (path.frequency as string) || "",
      evolution: (path.evolution as string) || "",
      exitCondition: (path.exit_condition as string) || "",
      steps: [],
      templates: legacyBriefs.length,
      templateBriefs: legacyBriefs,
    };
  });
}

// --- Route ---

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { issuerId, mode, message, dataDatasetIds, exclusionDatasetIds, selectedStrategyId, campaignMode } = body;
    let { campaignId } = body;

    log(`Request: mode=${mode}, campaignId=${campaignId || "new"}, message="${message.substring(0, 80)}"`);
    log(`Datasets: data=${dataDatasetIds?.join(",") || "from-db"}, exclusions=${exclusionDatasetIds?.join(",") || "from-db"}`);

    // Use mock AI if enabled
    if (process.env.MOCK_AI === "true") {
      log("MOCK_AI enabled — returning mock response");
      return NextResponse.json({
        type: "text",
        message: "Mock AI is enabled. This would be a real Claude response.",
        campaignId: campaignId || "mock-campaign",
      });
    }

    // --- Get or create conversation ---
    let conversation: { id: string; messages: string; agentState: string; mode: string; campaignId: string } | null = null;

    if (campaignId) {
      conversation = await prisma.conversation.findUnique({ where: { campaignId } });
    }

    if (!conversation && campaignId) {
      conversation = await prisma.conversation.create({
        data: { campaignId, messages: "[]", agentState: "{}", mode },
      });
    }

    // If no campaign yet (first message in creation mode), create one
    if (!campaignId && (mode === "creation" || mode === "wave_creation")) {
      // Resolve issuer ID — try as UUID first, then as slug
      let resolvedIssuerId = issuerId;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issuerId);
      if (!isUUID) {
        const issuer = await prisma.issuer.findUnique({ where: { slug: issuerId } });
        if (issuer) resolvedIssuerId = issuer.id;
        else {
          const firstIssuer = await prisma.issuer.findFirst();
          resolvedIssuerId = firstIssuer?.id || "";
        }
      }

      log(`Creating new campaign for issuer: ${resolvedIssuerId}`);
      const campaign = await prisma.campaign.create({
        data: {
          issuerId: resolvedIssuerId,
          name: message.length > 50 ? message.substring(0, 47) + "..." : message,
          goal: message,
          status: "draft",
        },
      });
      campaignId = campaign.id;

      // Link datasets
      if (dataDatasetIds) {
        for (const dsId of dataDatasetIds) {
          try {
            await prisma.campaignDataset.create({ data: { campaignId, datasetId: dsId, role: "data" } });
            log(`Linked data dataset: ${dsId}`);
          } catch (err) { log(`Failed to link data dataset ${dsId}: ${err}`); }
        }
      }
      if (exclusionDatasetIds) {
        for (const dsId of exclusionDatasetIds) {
          try {
            await prisma.campaignDataset.create({ data: { campaignId, datasetId: dsId, role: "exclusion" } });
            log(`Linked exclusion dataset: ${dsId}`);
          } catch (err) { log(`Failed to link exclusion dataset ${dsId}: ${err}`); }
        }
      }
      log(`Linked ${dataDatasetIds?.length || 0} data + ${exclusionDatasetIds?.length || 0} exclusion datasets`);

      conversation = await prisma.conversation.create({
        data: { campaignId, messages: "[]", agentState: "{}", mode },
      });
    }

    if (!conversation || !campaignId) {
      return NextResponse.json({ error: "No campaign or conversation found" }, { status: 400 });
    }

    // --- Build conversation history ---
    const existingMessages: ChatMessage[] = JSON.parse(conversation.messages);
    existingMessages.push({ role: "user", content: message, timestamp: new Date().toISOString() });

    // Convert to Claude format
    const claudeMessages = existingMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: m.content,
    }));

    // --- Determine context ---
    const dataDsIds = dataDatasetIds || [];
    const exclDsIds = exclusionDatasetIds || [];

    // If not provided, get from campaign_datasets
    if (dataDsIds.length === 0 || exclDsIds.length === 0) {
      log(`Loading datasets from DB for campaign: ${campaignId}`);
      const linked = await prisma.campaignDataset.findMany({ where: { campaignId } });
      log(`Found ${linked.length} linked datasets: ${linked.map(l => l.datasetId).join(", ")}`);
      if (dataDsIds.length === 0) {
        dataDsIds.push(...linked.filter((l) => l.role === "data").map((l) => l.datasetId));
      }
      if (exclDsIds.length === 0) {
        exclDsIds.push(...linked.filter((l) => l.role === "exclusion").map((l) => l.datasetId));
      }
    }

    // Inject dataset context into first user message so AI knows what tool IDs to use
    if (claudeMessages.length > 0 && claudeMessages[0].role === "user") {
      const allDsIds = [...dataDsIds, ...exclDsIds];
      if (allDsIds.length > 0) {
        const existing = claudeMessages[0].content as string;
        if (!existing.includes("[Available datasets:")) {
          claudeMessages[0] = {
            role: "user",
            content: `[SYSTEM: Use these exact dataset IDs with tools — data: ${dataDsIds.join(", ")} | exclusions: ${exclDsIds.join(", ")}. These are the correct IDs, do not ask for clarification.]\n\n${existing}`,
          };
        }
      }
    }

    // Get current strategy if in feedback/live mode
    let currentStrategy = undefined;
    if ((mode === "feedback" || mode === "live") && selectedStrategyId) {
      const strat = await prisma.strategy.findUnique({
        where: { id: selectedStrategyId },
        include: { paths: { include: { templateBriefs: true }, orderBy: { sortOrder: "asc" } } },
      });
      if (strat) currentStrategy = strat;
    }

    // --- V2 WAVE MODE ---
    if (mode === "wave_creation" || mode === "wave_feedback") {
      const { runV2Planner } = await import("@/lib/claude");

      // Build wave summary for feedback mode
      let wavesSummary: string | undefined;
      if (mode === "wave_feedback" && campaignId) {
        const existingWaves = await prisma.wave.findMany({
          where: { campaignId },
          orderBy: { waveNumber: "asc" },
        });
        wavesSummary = existingWaves.map(w => {
          const metrics = JSON.parse(w.metrics || "{}");
          return `Wave ${w.waveNumber} (${w.name}): ${w.audienceCount} customers, status=${w.status}${metrics.sent ? `, sent=${metrics.sent}, converted=${metrics.converted || 0}` : ""}`;
        }).join("\n");
      }

      log(`Running V2 Planner (${claudeMessages.length} messages, mode=${mode})`);
      const v2Result = await runV2Planner(claudeMessages, {
        dataDatasetIds: dataDsIds,
        exclusionDatasetIds: exclDsIds,
        mode: mode as "wave_creation" | "wave_feedback",
        wavesSummary,
      });

      log(`V2 Planner completed: type=${v2Result.type}, toolCalls=${v2Result.toolCallsUsed}`);

      let responseMessage = "";
      let waveResponse = null;

      if (v2Result.type === "ask_user") {
        responseMessage = v2Result.message || "";
      } else if (v2Result.type === "wave" && v2Result.wave) {
        const waveData = v2Result.wave as Record<string, unknown>;
        const waveName = (waveData.name as string) || `Wave ${((waveData.waveNumber as number) || 1)}`;
        const waveNumber = (waveData.waveNumber as number) || 1;
        const audienceCount = (waveData.audienceCount as number) || 0;
        const blueprint = (waveData.blueprint as string) || "";

        // Convert AI strategy output → JourneyTreeNode[] for React Flow
        const { convertWaveToJourneyTree, validateWaveOutput } = await import("@/lib/wave-converter");
        let journeyTree: unknown[];
        try {
          // Validate first
          const typedWave = waveData as unknown as Parameters<typeof validateWaveOutput>[0];
          const validationErrors = validateWaveOutput(typedWave);
          if (validationErrors.length > 0) {
            log(`Wave validation: ${validationErrors.length} issues`);
            validationErrors.forEach(e => log(`  [${e.severity}] ${e.field}: ${e.message}`));
          }

          journeyTree = convertWaveToJourneyTree(typedWave);
          log(`Converted wave to journey tree: ${journeyTree.length} nodes`);
        } catch (err) {
          log(`Wave conversion failed, using raw output: ${err}`);
          // Fallback: if AI already output a journeyTree (old format), use it directly
          journeyTree = (waveData.journeyTree as unknown[]) || (waveData.segments as unknown[]) || [];
        }

        // Save wave to DB — upsert to handle updates to existing waves
        const existingWave = await prisma.wave.findUnique({
          where: { campaignId_waveNumber: { campaignId: campaignId!, waveNumber } },
        });

        let savedWave;
        if (existingWave) {
          // Update existing wave — version bump
          const newVersion = existingWave.version + 1;
          savedWave = await prisma.wave.update({
            where: { id: existingWave.id },
            data: {
              name: waveName,
              journeyTree: JSON.stringify(journeyTree),
              audienceCount,
              blueprint,
              version: newVersion,
            },
          });

          await prisma.waveVersion.create({
            data: {
              waveId: savedWave.id,
              version: newVersion,
              initiator: "ai",
              description: `Wave ${waveNumber} updated based on feedback`,
              journeySnapshot: JSON.stringify(journeyTree),
            },
          });

          log(`Updated wave ${waveNumber} to v${newVersion}: ${savedWave.id}`);
        } else {
          // Create new wave
          savedWave = await prisma.wave.create({
            data: {
              campaignId: campaignId!,
              waveNumber,
              name: waveName,
              status: "draft",
              journeyTree: JSON.stringify(journeyTree),
              audienceCount,
              blueprint,
            },
          });

          await prisma.waveVersion.create({
            data: {
              waveId: savedWave.id,
              version: 1,
              initiator: "ai",
              description: waveNumber === 1 ? "Initial wave generated" : `Wave ${waveNumber} proposed based on previous results`,
              journeySnapshot: JSON.stringify(journeyTree),
            },
          });

          log(`Created wave ${waveNumber}: ${savedWave.id}`);
        }

        // Update campaign mode if first wave
        if (waveNumber === 1) {
          await prisma.campaign.update({
            where: { id: campaignId! },
            data: {
              mode: "v2",
              waveBlueprint: JSON.stringify({ blueprint }),
            },
          });
        }

        log(`Saved wave ${waveNumber}: ${savedWave.id}`);

        waveResponse = {
          id: savedWave.id,
          waveNumber,
          name: waveName,
          status: "draft",
          version: 1,
          journeyTree,
          audienceCount,
          blueprint,
        };

        // Use AI's reasoning text if available, fallback to generic message
        const aiReasoning = (v2Result.message as string) || "";
        responseMessage = aiReasoning
          ? `${aiReasoning}\n\nWave ${waveNumber} is ready: **${waveName}**.${blueprint ? `\n\nBlueprint: ${blueprint}` : ""}`
          : `Wave ${waveNumber} is ready: **${waveName}**.${blueprint ? `\n\nBlueprint: ${blueprint}` : ""}`;
      } else {
        responseMessage = v2Result.message || "I'm ready to help.";
      }

      // Save conversation
      existingMessages.push({ role: "assistant", content: responseMessage, timestamp: new Date().toISOString() });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { messages: JSON.stringify(existingMessages), mode },
      });

      return NextResponse.json({
        type: v2Result.type,
        message: responseMessage,
        wave: waveResponse,
        campaignId,
        toolCallsUsed: v2Result.toolCallsUsed,
      });
    }

    // --- V1: Run Planner ---
    log(`Running Planner (${claudeMessages.length} messages, mode=${mode})`);
    const plannerStartTime = Date.now();
    const plannerResult = await runPlanner(claudeMessages, {
      dataDatasetIds: dataDsIds,
      exclusionDatasetIds: exclDsIds,
      mode,
      currentStrategy,
    });

    // --- Handle result ---
    const plannerDuration = Date.now() - plannerStartTime;
    log(`Planner completed: type=${plannerResult.type}, toolCalls=${plannerResult.toolCallsUsed}, duration=${plannerDuration}ms`);

    let responseMessage = "";
    let strategies = null;

    if (plannerResult.type === "ask_user") {
      responseMessage = plannerResult.message || "";
      log(`Planner asks user: "${responseMessage.substring(0, 100)}..."`);
    } else if (plannerResult.type === "strategies") {
      // Run Reviewer
      log("Running Reviewer on generated strategies");
      const reviewerResult = await runReviewer(plannerResult.strategies, {
        dataDatasetIds: dataDsIds,
        exclusionDatasetIds: exclDsIds,
      });

      log(`Reviewer done: ${reviewerResult.fixesApplied.length} fixes, ${reviewerResult.excludedStrategies.length} excluded`);

      // Archive old strategies for this campaign (soft delete — preserved for version history)
      const archivedCount = await prisma.strategy.updateMany({
        where: { campaignId, archived: false },
        data: { archived: true },
      });
      if (archivedCount.count > 0) {
        log(`Archived ${archivedCount.count} old strategies`);
      }

      // Save strategies to DB
      log("Saving strategies to DB");

      // Extract strategies and analysis from the AI output
      // The structure can be: { analysis: {...}, strategies: [...] } or just [...]
      const rawOutput = reviewerResult.updatedStrategies as Record<string, unknown>;
      const plannerOutput = plannerResult.strategies as Record<string, unknown>;

      let strategyList: Record<string, unknown>[];
      if (Array.isArray(rawOutput)) {
        strategyList = rawOutput;
      } else if (rawOutput.strategies && Array.isArray(rawOutput.strategies)) {
        strategyList = rawOutput.strategies as Record<string, unknown>[];
      } else {
        strategyList = [];
      }

      // Get analysis from AI output
      const analysis = (rawOutput.analysis || plannerOutput?.analysis || {}) as Record<string, unknown>;

      // Compute exclusions server-side from actual data (don't rely on AI)
      log(`Computing exclusions with data=${dataDsIds.join(",")} excl=${exclDsIds.join(",")}`);
      let exclusionsData: Record<string, unknown> = {};
      try {
        const { getExclusionSummary } = await import("@/lib/data-service");
        const exclResult = getExclusionSummary(dataDsIds, exclDsIds);
        exclusionsData = {
          total: exclResult.totalUnique,
          ...Object.fromEntries(exclResult.breakdown.map(b => [b.name.toLowerCase().replace(/\s+/g, '_'), b.count])),
        };
        log(`Server-computed exclusions: ${JSON.stringify(exclusionsData)}`);
      } catch (err) {
        log(`Exclusion computation failed, using AI output: ${err}`);
        exclusionsData = (analysis.exclusions || {}) as Record<string, unknown>;
      }

      log(`Parsed: ${strategyList.length} strategies, exclusions: ${JSON.stringify(exclusionsData).substring(0, 200)}`);

      // --- Server-side segment size adjustment for exclusions ---
      // Always apply exclusion reduction to segment sizes.
      // AI may or may not have subtracted exclusions — we enforce it server-side.
      const totalExcluded = (exclusionsData.total as number) || 0;
      if (totalExcluded > 0) {
        // Get total eligible (base population) from analysis or compute from data datasets
        let totalEligible = (analysis.total_eligible as number) || 0;
        if (!totalEligible) {
          try {
            const { countRows: countRowsFn } = await import("@/lib/data-service");
            for (const dsId of dataDsIds) {
              const count = countRowsFn(dsId);
              if (count > totalEligible) totalEligible = count;
            }
          } catch { /* fallback below */ }
        }

        if (totalEligible > 0) {
          const exclusionRatio = totalExcluded / totalEligible;
          const reachable = totalEligible - totalExcluded;
          log(`Exclusion adjustment: ${totalExcluded} excluded / ${totalEligible} eligible = ${(exclusionRatio * 100).toFixed(1)}% exclusion rate. Reachable: ${reachable}`);

          for (const strat of strategyList) {
            const paths = ((strat as Record<string, unknown>).paths as Record<string, unknown>[]) || [];
            for (const p of paths) {
              const raw = (p.segment_size as number) || 0;
              // If segment size exceeds reachable, it's definitely raw — cap it
              // Otherwise, apply proportional exclusion reduction
              if (raw > reachable) {
                p.segment_size = reachable;
                log(`  Path "${p.name}": capped ${raw} → ${reachable} (exceeded reachable)`);
              } else {
                const adjusted = Math.round(raw * (1 - exclusionRatio));
                log(`  Path "${p.name}": ${raw} → ${adjusted} (applied ${(exclusionRatio * 100).toFixed(1)}% exclusion)`);
                p.segment_size = adjusted;
              }
            }
          }
        }
      }

      const savedStrategies = [];
      for (const strat of strategyList) {
        const s = strat as Record<string, unknown>;

        const saved = await prisma.strategy.create({
          data: {
            campaignId,
            name: (s.name as string) || "Strategy",
            approach: (s.approach as string) || "",
            recommended: (s.recommended as boolean) || false,
            estimatedImpact: (s.estimated_impact as string) || "",
            totalReach: 0,
            exclusions: JSON.stringify(exclusionsData),
            analysis: JSON.stringify(analysis),
            reviewerFixes: JSON.stringify(reviewerResult.fixesApplied),
          },
        });

        // Save paths
        const paths = (s.paths as Record<string, unknown>[]) || [];
        let totalReach = 0;
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          const segSize = (p.segment_size as number) || 0;
          totalReach += segSize;

          const steps = (p.steps as Record<string, unknown>[]) || [];
          // Derive legacy fields from steps
          const stepChannels = steps.length > 0
            ? [...new Set(steps.map(s => s.channel as string))]
            : (p.channels || []);

          const savedPath = await prisma.path.create({
            data: {
              strategyId: saved.id,
              name: (p.name as string) || `Path ${i + 1}`,
              reasoning: (p.reasoning as string) || "",
              segmentDescription: (p.segment as string) || "",
              segmentSize: segSize,
              channels: JSON.stringify(stepChannels),
              timing: steps.length > 0 ? `Day ${(steps[0] as Record<string, unknown>).day || 1}` : ((p.timing as string) || ""),
              frequency: steps.length > 0 ? `${steps.length} steps` : ((p.frequency as string) || ""),
              evolution: (p.evolution as string) || "",
              exitCondition: (p.exit_condition as string) || "",
              sortOrder: i,
            },
          });

          if (steps.length > 0) {
            // New multi-step format: save Step records + TemplateBriefs per step
            for (let si = 0; si < steps.length; si++) {
              const step = steps[si];
              const savedStep = await prisma.step.create({
                data: {
                  pathId: savedPath.id,
                  channel: (step.channel as string) || "SMS",
                  timing: (step.timing as string) || "",
                  dayOffset: (step.day as number) || si + 1,
                  brief: (step.brief as string) || "",
                  sortOrder: si,
                },
              });
              await prisma.templateBrief.create({
                data: {
                  pathId: savedPath.id,
                  stepId: savedStep.id,
                  channel: (step.channel as string) || "SMS",
                  content: (step.brief as string) || "",
                  sortOrder: si,
                },
              });
            }
          } else {
            // Legacy flat format: save template briefs directly on path
            const briefs = (p.template_briefs as Record<string, unknown>[]) || [];
            for (let j = 0; j < briefs.length; j++) {
              const b = briefs[j];
              await prisma.templateBrief.create({
                data: {
                  pathId: savedPath.id,
                  channel: (b.channel as string) || "SMS",
                  content: (b.content as string) || "",
                  tone: (b.tone as string) || "",
                  sortOrder: j,
                },
              });
            }
          }
        }

        // Update total reach
        await prisma.strategy.update({
          where: { id: saved.id },
          data: { totalReach },
        });

        savedStrategies.push({
          ...saved,
          totalReach,
          paths: paths.map((p, i) => ({
            ...p,
            id: `path-${i}`,
          })),
        });
      }

      // Compute next version
      const lastVersion = await prisma.campaignVersion.findFirst({
        where: { campaignId },
        orderBy: { version: "desc" },
      });
      const nextVersion = (lastVersion?.version || 0) + 1;

      // Set recommended strategy as active
      const recommended = savedStrategies.find((s) => (s as Record<string, unknown>).recommended);
      if (recommended) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { activeStrategyId: recommended.id, activeVersion: nextVersion },
        });
      }

      // Create version
      await prisma.campaignVersion.create({
        data: {
          campaignId,
          version: nextVersion,
          initiator: "ai",
          description: nextVersion === 1 ? "Initial strategies generated" : "Strategies updated",
          strategySnapshot: JSON.stringify(savedStrategies),
        },
      });

      // Transform for UI
      strategies = savedStrategies.map((s) => {
        const strat = s as Record<string, unknown>;
        const paths = (strat.paths as Record<string, unknown>[]) || [];
        const stratAnalysis = JSON.parse((strat.analysis as string) || "{}");
        return {
          id: strat.id,
          name: strat.name,
          recommended: strat.recommended,
          approach: strat.approach,
          estimatedImpact: strat.estimatedImpact || strat.estimated_impact,
          totalReach: strat.totalReach,
          totalEligible: (stratAnalysis.total_eligible as number) || 0,
          exclusions: JSON.parse((strat.exclusions as string) || "{}"),
          layers: pathsToLayers(paths),
        };
      });

      responseMessage = `Generated ${strategyList.length} strategies. ${recommended ? `Recommended: **${(recommended as Record<string, unknown>).name}**` : ""}`;
    } else {
      responseMessage = plannerResult.message || "I'm ready to help. What would you like to do?";
    }

    // --- Save conversation ---
    existingMessages.push({ role: "assistant", content: responseMessage, timestamp: new Date().toISOString() });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messages: JSON.stringify(existingMessages),
        mode,
      },
    });

    log(`Response: type=${plannerResult.type}, strategies=${strategies ? (strategies as unknown[]).length : 0}, campaignId=${campaignId}`);

    return NextResponse.json({
      type: plannerResult.type,
      message: responseMessage,
      strategies,
      campaignId,
      toolCallsUsed: plannerResult.toolCallsUsed,
    });
  } catch (error) {
    log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again.", details: String(error) },
      { status: 500 }
    );
  }
}
