// ============================================================
// Converts AI strategy output → JourneyTreeNode[] for React Flow
// The AI thinks in segments + journeys. This converts to nodes.
// Includes validation + hardening for malformed AI output.
// ============================================================

interface AIStep {
  day: number;
  channel: string;
  timing: string;
  brief: string;
}

interface AISegment {
  name: string;
  condition: string;
  size: number;
  journey: AIStep[];
  exit: string;
  ab_test?: { field: string; splits: { label: string; pct: number }[] };
}

interface AIWaveOutput {
  name: string;
  waveNumber: number;
  audienceCount: number;
  audience: { total_eligible: number; excluded: number; reachable: number; desc: string };
  segments: AISegment[];
  goal: string;
  blueprint: string;
}

interface JourneyTreeNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  branches?: { label: string; color: string; nodes: JourneyTreeNode[] }[];
}

// ============================================================
// VALIDATION
// ============================================================

interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

function validateWaveOutput(wave: AIWaveOutput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!wave.name) errors.push({ field: "name", message: "Wave name is missing", severity: "warning" });
  if (!wave.waveNumber || wave.waveNumber < 1) errors.push({ field: "waveNumber", message: "Invalid wave number", severity: "error" });
  if (!wave.segments || wave.segments.length === 0) errors.push({ field: "segments", message: "No segments defined", severity: "error" });
  if (!wave.goal) errors.push({ field: "goal", message: "No campaign goal specified", severity: "warning" });

  // Validate audience
  if (!wave.audience) {
    errors.push({ field: "audience", message: "Audience data missing", severity: "warning" });
  }

  // Validate each segment
  for (let i = 0; i < (wave.segments || []).length; i++) {
    const seg = wave.segments[i];
    const prefix = `segments[${i}]`;

    if (!seg.name) errors.push({ field: `${prefix}.name`, message: `Segment ${i} has no name`, severity: "warning" });
    if (!seg.journey || seg.journey.length === 0) {
      errors.push({ field: `${prefix}.journey`, message: `Segment "${seg.name || i}" has no journey steps`, severity: "error" });
    }

    // Validate steps
    let prevDay = 0;
    for (let j = 0; j < (seg.journey || []).length; j++) {
      const step = seg.journey[j];
      const stepPrefix = `${prefix}.journey[${j}]`;

      if (!step.channel) errors.push({ field: `${stepPrefix}.channel`, message: "Step has no channel", severity: "error" });
      if (!step.day || step.day < 1) errors.push({ field: `${stepPrefix}.day`, message: "Step has invalid day", severity: "warning" });
      if (step.day <= prevDay) errors.push({ field: `${stepPrefix}.day`, message: `Step day ${step.day} is not increasing (prev: ${prevDay})`, severity: "warning" });
      prevDay = step.day || prevDay;

      // DLT timing check
      if (step.timing) {
        const hourMatch = step.timing.match(/(\d+)/);
        if (hourMatch) {
          let hour = parseInt(hourMatch[1]);
          if (step.timing.toLowerCase().includes("pm") && hour < 12) hour += 12;
          if (hour < 9 || hour >= 21) {
            errors.push({ field: `${stepPrefix}.timing`, message: `Timing "${step.timing}" is outside DLT window (9AM-9PM)`, severity: "warning" });
          }
        }
      }
    }

    // Validate exit
    if (!seg.exit) {
      errors.push({ field: `${prefix}.exit`, message: `Segment "${seg.name || i}" has no exit type`, severity: "warning" });
    }
  }

  return errors;
}

// ============================================================
// SAFE ACCESSORS (handle missing fields gracefully)
// ============================================================

function safeStr(val: unknown, fallback: string = ""): string {
  return typeof val === "string" ? val : fallback;
}

function safeNum(val: unknown, fallback: number = 0): number {
  return typeof val === "number" ? val : fallback;
}

function safeArr<T>(val: unknown, fallback: T[] = []): T[] {
  return Array.isArray(val) ? val : fallback;
}

// ============================================================
// NODE GENERATION
// ============================================================

function makeId(waveNum: number, ...parts: (string | number)[]) {
  return `w${waveNum}-${parts.join("-")}`;
}

function journeyToNodes(segment: AISegment, waveNum: number, segIndex: number, goal: string): JourneyTreeNode[] {
  const nodes: JourneyTreeNode[] = [];
  const prefix = `s${segIndex}`;
  const journey = safeArr<AIStep>(segment.journey);

  // Handle empty journey
  if (journey.length === 0) {
    nodes.push({
      id: makeId(waveNum, prefix, "send", 0),
      type: "send",
      label: "Send SMS",
      config: { channel: "SMS", desc: "Default message — journey not specified" },
    });
  }

  for (let i = 0; i < journey.length; i++) {
    const step = journey[i];
    const channel = safeStr(step.channel, "SMS");
    const brief = safeStr(step.brief, `Message via ${channel}`);

    // Pause node between steps
    if (i > 0) {
      const prevDay = safeNum(journey[i - 1].day, 1);
      const curDay = safeNum(step.day, prevDay + 1);
      const gap = curDay - prevDay;
      if (gap > 0) {
        nodes.push({
          id: makeId(waveNum, prefix, "pause", i),
          type: "pause",
          label: `Wait ${gap} Day${gap > 1 ? "s" : ""}`,
          config: { desc: "Pause before next touchpoint" },
        });
      }
    }

    // Send node
    const timing = safeStr(step.timing, "");
    nodes.push({
      id: makeId(waveNum, prefix, "send", i),
      type: "send",
      label: `Send ${channel}`,
      config: { channel, desc: brief, timing },
    });
  }

  // Exit node
  const exit = safeStr(segment.exit, "goal_or_next_wave");
  if (exit === "drop") {
    nodes.push({
      id: makeId(waveNum, prefix, "exit"),
      type: "exit",
      label: "Drop from Campaign",
      config: { desc: "Removed — exhausted attempts", reason: "drop" },
    });
  } else {
    nodes.push({
      id: makeId(waveNum, prefix, "goal"),
      type: "goal_exit",
      label: `Goal: ${safeStr(goal, "conversion").replace(/_/g, " ")}`,
      config: { desc: "Exit on conversion, otherwise proceed to next wave" },
    });
  }

  return nodes;
}

// ============================================================
// MAIN CONVERTER
// ============================================================

export function convertWaveToJourneyTree(wave: AIWaveOutput): JourneyTreeNode[] {
  // Validate
  const errors = validateWaveOutput(wave);
  const criticalErrors = errors.filter(e => e.severity === "error");
  if (criticalErrors.length > 0) {
    console.error("[WAVE-CONVERTER] Critical validation errors:", criticalErrors);
    // Don't throw — try to convert anyway with safe defaults
  }
  if (errors.length > 0) {
    console.warn("[WAVE-CONVERTER] Validation warnings:", errors.filter(e => e.severity === "warning").map(e => e.message));
  }

  const wn = safeNum(wave.waveNumber, 1);
  const segments = safeArr<AISegment>(wave.segments);
  const goal = safeStr(wave.goal, "conversion");
  const tree: JourneyTreeNode[] = [];

  // Audience info (with safe defaults)
  const audience = wave.audience || { total_eligible: wave.audienceCount || 0, excluded: 0, reachable: wave.audienceCount || 0, desc: "" };
  const audienceDesc = safeStr(audience.desc, "Campaign audience");
  const totalEligible = safeNum(audience.total_eligible, wave.audienceCount || 0);
  const reachable = safeNum(audience.reachable, wave.audienceCount || 0);

  // 1. Segment entry node
  tree.push({
    id: makeId(wn, "entry"),
    type: "segment",
    label: segments.length === 1 ? safeStr(segments[0].name, "All Eligible") : `Wave ${wn} Entry`,
    config: {
      desc: audienceDesc,
      detail: `${totalEligible.toLocaleString()} eligible · ${reachable.toLocaleString()} reachable`,
    },
  });

  // Handle no segments
  if (segments.length === 0) {
    tree.push({
      id: makeId(wn, "exit"),
      type: "exit",
      label: "Exit",
      config: { desc: "No segments defined", reason: "wave_complete" },
    });
    return tree;
  }

  // 2. Single segment — linear journey
  if (segments.length === 1) {
    const seg = segments[0];

    if (seg.ab_test && seg.ab_test.splits && seg.ab_test.splits.length > 1) {
      const splitBranches = seg.ab_test.splits.map((split, si) => {
        const abLabel: JourneyTreeNode = {
          id: makeId(wn, "ab", `label${si}`),
          type: "branch_label",
          label: `${safeStr(split.label, `Variant ${si + 1}`)} (${safeNum(split.pct, 50)}%)`,
          config: { color: si === 0 ? "blue" : "purple" },
        };
        return {
          label: "",
          color: si === 0 ? "blue" : "purple",
          nodes: [abLabel, ...journeyToNodes(seg, wn, si, goal)],
        };
      });

      tree.push({
        id: makeId(wn, "ab"),
        type: "random_split",
        label: `A/B Test: ${safeStr(seg.ab_test.field, "variant")}`,
        config: { desc: seg.ab_test.splits.map(s => `${s.label}: ${s.pct}%`).join(" vs ") },
        branches: splitBranches,
      });
    } else {
      tree.push(...journeyToNodes(seg, wn, 0, goal));
    }

    return tree;
  }

  // 3. Multiple segments — separate A/B test segments from conditional segments
  const colors = ["green", "purple", "red", "blue"];

  // Detect A/B test pairs: segments with matching base names differing by channel/variant
  // e.g., "Moderate — SMS Test" + "Moderate — WhatsApp Test"
  function findAbPairs(segs: AISegment[]): { abIndices: Set<number>; pairs: [number, number][] } {
    const abIndices = new Set<number>();
    const pairs: [number, number][] = [];

    for (let a = 0; a < segs.length; a++) {
      for (let b = a + 1; b < segs.length; b++) {
        if (abIndices.has(a) || abIndices.has(b)) continue;
        const nameA = safeStr(segs[a].name, "").toLowerCase();
        const nameB = safeStr(segs[b].name, "").toLowerCase();
        const condA = safeStr(segs[a].condition, "").toLowerCase();
        const condB = safeStr(segs[b].condition, "").toLowerCase();
        // Match if: both have "test" in name, or both conditions mention "random"/"50%"
        const bothTest = (nameA.includes("test") && nameB.includes("test"));
        const bothRandom = (condA.includes("random") && condB.includes("random")) || (condA.includes("50%") && condB.includes("50%"));
        const similarSize = Math.abs(safeNum(segs[a].size) - safeNum(segs[b].size)) <= safeNum(segs[a].size) * 0.1;
        if ((bothTest || bothRandom) && similarSize) {
          abIndices.add(a);
          abIndices.add(b);
          pairs.push([a, b]);
        }
      }
    }
    return { abIndices, pairs };
  }

  const { abIndices, pairs: abPairs } = findAbPairs(segments);
  const regularSegments = segments.filter((_, i) => !abIndices.has(i));

  if (abPairs.length > 0) {
    // Build branches: regular segments + A/B random split nodes
    const allBranches: { label: string; color: string; nodes: JourneyTreeNode[] }[] = [];

    // Regular segments first
    regularSegments.forEach((seg, ri) => {
      const labelNode: JourneyTreeNode = {
        id: makeId(wn, `s${ri}`, "label"),
        type: "branch_label",
        label: safeStr(seg.name, `Segment ${ri + 1}`),
        config: { color: colors[ri % colors.length], size: safeNum(seg.size), condition: safeStr(seg.condition, "") },
      };
      allBranches.push({
        label: "",
        color: colors[ri % colors.length],
        nodes: [labelNode, ...journeyToNodes(seg, wn, ri, goal)],
      });
    });

    // A/B pairs as Random Split nodes, each as a branch
    abPairs.forEach(([aIdx, bIdx], pi) => {
      const segA = segments[aIdx];
      const segB = segments[bIdx];
      const abBranches = [segA, segB].map((seg, vi) => {
        const labelNode: JourneyTreeNode = {
          id: makeId(wn, `ab${pi}v${vi}`, "label"),
          type: "branch_label",
          label: safeStr(seg.name, `Variant ${vi + 1}`),
          config: { color: "blue", size: safeNum(seg.size), condition: safeStr(seg.condition, "") },
        };
        return {
          label: "",
          color: "blue",
          nodes: [labelNode, ...journeyToNodes(seg, wn, 100 + pi * 2 + vi, goal)],
        };
      });

      // The A/B split itself becomes a branch of the conditional split
      const totalAbSize = safeNum(segA.size) + safeNum(segB.size);
      const abSplitNode: JourneyTreeNode = {
        id: makeId(wn, `ab${pi}-split`),
        type: "random_split",
        label: "A/B Test",
        config: { desc: `${safeStr(segA.name, "A")} vs ${safeStr(segB.name, "B")}` },
        branches: abBranches,
      };

      allBranches.push({
        label: "",
        color: "blue",
        nodes: [abSplitNode],
      });
    });

    if (allBranches.length === 1 && abPairs.length === 1 && regularSegments.length === 0) {
      // Only one A/B pair, no regular — just the Random Split at top level
      tree.push(allBranches[0].nodes[0]); // the random_split node directly
    } else {
      tree.push({
        id: makeId(wn, "split"),
        type: "conditional_split",
        label: segments.length <= 3 ? "Segment by audience" : `Split into ${allBranches.length} groups`,
        config: { desc: `${regularSegments.length} segments + ${abPairs.length} A/B test${abPairs.length > 1 ? "s" : ""}` },
        branches: allBranches,
      });
    }

    return tree;
  }

  // No A/B segments — all regular conditional split
  const branches = segments.map((seg, i) => {
    let segNodes: JourneyTreeNode[];

    if (seg.ab_test && seg.ab_test.splits && seg.ab_test.splits.length > 1) {
      const splitBranches = seg.ab_test.splits.map((split, si) => {
        const abLabel: JourneyTreeNode = {
          id: makeId(wn, `s${i}`, "ab", `label${si}`),
          type: "branch_label",
          label: `${safeStr(split.label, `V${si + 1}`)} (${safeNum(split.pct, 50)}%)`,
          config: { color: "blue" },
        };
        return {
          label: "",
          color: "blue",
          nodes: [abLabel, ...journeyToNodes(seg, wn, i * 10 + si, goal)],
        };
      });

      segNodes = [{
        id: makeId(wn, `s${i}`, "ab"),
        type: "random_split",
        label: `A/B: ${safeStr(seg.ab_test.field, "variant")}`,
        config: { desc: seg.ab_test.splits.map(s => `${s.label}: ${s.pct}%`).join(" vs ") },
        branches: splitBranches,
      }];
    } else {
      segNodes = journeyToNodes(seg, wn, i, goal);
    }

    // Prepend a branch_label node so dagre spaces it properly (no edge labels)
    const labelNode: JourneyTreeNode = {
      id: makeId(wn, `s${i}`, "label"),
      type: "branch_label",
      label: safeStr(seg.name, `Segment ${i + 1}`),
      config: { color: colors[i % colors.length], size: safeNum(seg.size), condition: safeStr(seg.condition, ""), sql: safeStr((seg as unknown as Record<string, unknown>).sql as string, "") },
    };

    return {
      label: "", // No edge label — the branch_label node handles it
      color: colors[i % colors.length],
      nodes: [labelNode, ...segNodes],
    };
  });

  // Build split label from segment conditions
  const firstCondition = safeStr(segments[0].condition, "");
  const splitLabel = segments.length === 2
    ? `${safeStr(segments[0].condition, "Group A")} vs ${safeStr(segments[1].condition, "Group B")}`
    : firstCondition.toLowerCase().includes("wave")
      ? "Segment by engagement"
      : `Split into ${segments.length} segments`;

  tree.push({
    id: makeId(wn, "split"),
    type: "conditional_split",
    label: splitLabel,
    config: { desc: `${segments.length} segments based on ${wn > 1 ? "previous wave engagement" : "customer data"}` },
    branches,
  });

  return tree;
}

// Export validation for use in chat route
export { validateWaveOutput };
export type { AIWaveOutput, ValidationError };
