// ============================================================
// Converts v1 Strategy (paths/steps) → JourneyTreeNode[] for React Flow
// So both v1 and v2 campaigns render in the same visualizer.
// ============================================================

interface StepData {
  day: number;
  channel: string;
  timing: string;
  brief: string;
}

interface LayerData {
  name: string;
  segment: string;
  segmentSize: number;
  channel: string[];
  timing: string;
  exitCondition?: string;
  steps?: StepData[];
}

interface StrategyData {
  totalReach: number;
  totalEligible?: number;
  exclusions: Record<string, number>;
  layers: LayerData[];
}

interface JourneyTreeNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  branches?: { label: string; color: string; nodes: JourneyTreeNode[] }[];
}

function layerToNodes(layer: LayerData, idx: number): JourneyTreeNode[] {
  const nodes: JourneyTreeNode[] = [];
  const prefix = `p${idx}`;
  const steps = layer.steps || [];

  if (steps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Pause between steps
      if (i > 0) {
        const gap = step.day - (steps[i - 1].day || 1);
        if (gap > 0) {
          nodes.push({
            id: `${prefix}-pause-${i}`,
            type: "pause",
            label: `Wait ${gap} Day${gap > 1 ? "s" : ""}`,
            config: { desc: `Pause before next touchpoint` },
          });
        }
      }

      nodes.push({
        id: `${prefix}-send-${i}`,
        type: "send",
        label: `Send ${step.channel}`,
        config: { channel: step.channel, desc: step.brief, timing: step.timing },
      });
    }
  } else {
    // Legacy — no steps, use channel array
    for (let i = 0; i < layer.channel.length; i++) {
      nodes.push({
        id: `${prefix}-send-${i}`,
        type: "send",
        label: `Send ${layer.channel[i]}`,
        config: { channel: layer.channel[i], desc: `${layer.timing}` },
      });
    }
  }

  // Exit
  nodes.push({
    id: `${prefix}-exit`,
    type: "goal_exit",
    label: "Goal Exit",
    config: { desc: layer.exitCondition || "Exit on conversion" },
  });

  return nodes;
}

export function convertStrategyToJourneyTree(strategy: StrategyData): JourneyTreeNode[] {
  const tree: JourneyTreeNode[] = [];
  const totalEligible = strategy.totalEligible || (strategy.totalReach + (strategy.exclusions?.total || 0));
  const excluded = strategy.exclusions?.total || 0;
  const reachable = totalEligible - excluded;

  // Entry
  tree.push({
    id: "entry",
    type: "segment",
    label: "Campaign Audience",
    config: {
      desc: "All eligible customers, post-exclusion",
      detail: `${totalEligible.toLocaleString()} eligible · ${reachable.toLocaleString()} reachable`,
    },
  });

  // Single layer — linear
  if (strategy.layers.length === 1) {
    tree.push(...layerToNodes(strategy.layers[0], 0));
    return tree;
  }

  // Multiple layers — conditional split
  const colors = ["green", "purple", "red", "blue"];
  const branches = strategy.layers.map((layer, i) => ({
    label: `${layer.name} (${layer.segmentSize.toLocaleString()})`,
    color: colors[i % colors.length],
    nodes: layerToNodes(layer, i),
  }));

  tree.push({
    id: "split",
    type: "conditional_split",
    label: "Split by Segment",
    config: { desc: `${strategy.layers.length} parallel paths` },
    branches,
  });

  return tree;
}
