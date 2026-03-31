import Anthropic from "@anthropic-ai/sdk";
import { PLANNER_SYSTEM_PROMPT, REVIEWER_SYSTEM_PROMPT, LIVE_MODE_CONTEXT, PLANNER_TOOLS, V2_PLANNER_SYSTEM_PROMPT, V2_WAVE_FEEDBACK_CONTEXT, V2_PLANNER_TOOLS } from "./prompts";
import { getDatasetSchema, countRows, getDistribution, getExclusionSummary } from "./data-service";

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOOL_CALLS = 12;

// --- Logging ---

function log(context: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${context}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, typeof data === "string" ? data : JSON.stringify(data, null, 2).substring(0, 500));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

function logError(context: string, message: string, error: unknown) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${context}] ERROR: ${message}`, error instanceof Error ? error.message : String(error));
}

// --- Tool execution ---

function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: { dataDatasetIds: string[]; exclusionDatasetIds: string[] }
): string {
  log("TOOL", `Executing: ${toolName}`, toolInput);
  const startTime = Date.now();

  try {
    let result: string;
    switch (toolName) {
      case "get_dataset_schema": {
        const data = getDatasetSchema(toolInput.dataset_id as string);
        result = JSON.stringify(data);
        break;
      }
      case "count_rows": {
        const count = countRows(toolInput.dataset_id as string, toolInput.filter as string | undefined);
        result = JSON.stringify({ count });
        break;
      }
      case "get_distribution": {
        const data = getDistribution(
          toolInput.dataset_id as string,
          toolInput.column as string,
          (toolInput.buckets as number) || 5
        );
        result = JSON.stringify(data);
        break;
      }
      case "get_exclusion_summary": {
        const data = getExclusionSummary(context.dataDatasetIds, context.exclusionDatasetIds);
        result = JSON.stringify(data);
        break;
      }
      default:
        result = JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }

    const duration = Date.now() - startTime;
    log("TOOL", `${toolName} completed in ${duration}ms`, result.substring(0, 200));
    return result;
  } catch (err) {
    logError("TOOL", `${toolName} failed`, err);
    return JSON.stringify({ error: String(err) });
  }
}

// --- Planner Agent ---

export interface PlannerResult {
  type: "ask_user" | "strategies" | "text";
  message?: string;
  strategies?: unknown;
  toolCallsUsed: number;
}

export async function runPlanner(
  messages: { role: "user" | "assistant"; content: string }[],
  context: {
    dataDatasetIds: string[];
    exclusionDatasetIds: string[];
    mode?: "creation" | "feedback" | "live";
    currentStrategy?: unknown;
  }
): Promise<PlannerResult> {
  log("PLANNER", `Starting in ${context.mode || "creation"} mode`);
  log("PLANNER", `Data datasets: ${context.dataDatasetIds.join(", ")}`);
  log("PLANNER", `Exclusion datasets: ${context.exclusionDatasetIds.join(", ")}`);
  log("PLANNER", `Messages: ${messages.length}`, messages[messages.length - 1]?.content.substring(0, 100));

  const systemPrompt = context.mode === "live"
    ? PLANNER_SYSTEM_PROMPT + "\n\n" + LIVE_MODE_CONTEXT
    : PLANNER_SYSTEM_PROMPT;

  const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (context.currentStrategy && (context.mode === "feedback" || context.mode === "live")) {
    const strategyContext = `Current active strategy:\n${JSON.stringify(context.currentStrategy, null, 2)}`;
    claudeMessages[0] = {
      role: "user",
      content: strategyContext + "\n\n" + (claudeMessages[0].content as string),
    };
    log("PLANNER", "Prepended current strategy to first message");
  }

  let toolCallCount = 0;
  let loopCount = 0;
  const startTime = Date.now();

  while (toolCallCount < MAX_TOOL_CALLS) {
    loopCount++;
    log("PLANNER", `--- Loop ${loopCount} (${toolCallCount} tool calls so far) ---`);

    const apiStartTime = Date.now();
    let response: Anthropic.Message;
    let retries = 0;
    const maxRetries = 3;
    while (true) {
      try {
        response = await getClient().messages.create({
          model: MODEL,
          max_tokens: 8192,
          system: systemPrompt,
          tools: PLANNER_TOOLS as Anthropic.Tool[],
          messages: claudeMessages,
        });
        break;
      } catch (err) {
        retries++;
        const isRetryable = err instanceof Error && (err.message.includes("Overloaded") || err.message.includes("529") || err.message.includes("rate"));
        if (isRetryable && retries <= maxRetries) {
          const delay = retries * 2000;
          log("PLANNER", `API error (retry ${retries}/${maxRetries}), waiting ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    const apiDuration = Date.now() - apiStartTime;

    log("PLANNER", `API call ${loopCount}: ${apiDuration}ms, stop_reason: ${response.stop_reason}`);
    log("PLANNER", `Usage: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`);

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const textBlocks = response.content.filter((b) => b.type === "text");

    if (textBlocks.length > 0) {
      const text = textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("\n");
      log("PLANNER", `Text response: ${text.substring(0, 200)}...`);
    }

    if (toolUseBlocks.length === 0) {
      const text = textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("\n");
      const totalDuration = Date.now() - startTime;
      log("PLANNER", `Completed (text) in ${totalDuration}ms, ${toolCallCount} tool calls, ${loopCount} loops`);
      return { type: "text", message: text, toolCallsUsed: toolCallCount };
    }

    claudeMessages.push({ role: "assistant", content: response.content });
    const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const toolBlock = block as Anthropic.ToolUseBlock;
      toolCallCount++;

      log("PLANNER", `Tool call #${toolCallCount}: ${toolBlock.name}`, toolBlock.input);

      if (toolBlock.name === "ask_user") {
        const input = toolBlock.input as { message: string };
        const totalDuration = Date.now() - startTime;
        log("PLANNER", `Completed (ask_user) in ${totalDuration}ms, ${toolCallCount} tool calls`);
        log("PLANNER", `Question: ${input.message}`);
        return {
          type: "ask_user",
          message: input.message,
          toolCallsUsed: toolCallCount,
        };
      }

      if (toolBlock.name === "generate_strategies") {
        const input = toolBlock.input as { output: string };
        log("PLANNER", `Strategy output length: ${input.output.length} chars`);
        try {
          const strategies = JSON.parse(input.output);
          const stratCount = strategies.strategies?.length || 0;
          const totalDuration = Date.now() - startTime;
          log("PLANNER", `Completed (strategies) in ${totalDuration}ms, ${toolCallCount} tool calls, ${stratCount} strategies`);
          return {
            type: "strategies",
            strategies,
            toolCallsUsed: toolCallCount,
          };
        } catch (err) {
          logError("PLANNER", "Failed to parse strategy JSON", err);
          log("PLANNER", "Raw output (first 500 chars):", input.output.substring(0, 500));
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: "Error: Invalid JSON in strategy output. Please fix and try again.",
          });
          continue;
        }
      }

      const result = executeTool(toolBlock.name, toolBlock.input as Record<string, unknown>, {
        dataDatasetIds: context.dataDatasetIds,
        exclusionDatasetIds: context.exclusionDatasetIds,
      });

      toolResultContents.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    if (toolResultContents.length > 0) {
      claudeMessages.push({ role: "user", content: toolResultContents });
    }
  }

  const totalDuration = Date.now() - startTime;
  log("PLANNER", `Hit max tool calls (${MAX_TOOL_CALLS}) after ${totalDuration}ms, ${loopCount} loops`);
  return {
    type: "text",
    message: "I've explored the data extensively. Let me generate strategies with what I have.",
    toolCallsUsed: toolCallCount,
  };
}

// --- Reviewer Agent ---

export interface ReviewerResult {
  updatedStrategies: unknown;
  fixesApplied: { strategyId: string; fix: string }[];
  excludedStrategies: string[];
}

export async function runReviewer(
  strategies: unknown,
  context: {
    dataDatasetIds: string[];
    exclusionDatasetIds: string[];
  }
): Promise<ReviewerResult> {
  log("REVIEWER", "Starting review");
  log("REVIEWER", `Input strategies: ${JSON.stringify(strategies).length} chars`);
  const startTime = Date.now();

  try {
    let response: Anthropic.Message;
    let retries = 0;
    const maxRetries = 3;
    while (true) {
      try {
        response = await getClient().messages.create({
          model: MODEL,
          max_tokens: 8192,
          system: REVIEWER_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Review and improve these campaign strategies. Return the updated strategies JSON.\n\nInput:\n${JSON.stringify(strategies, null, 2)}\n\nDataset context: Data datasets: ${context.dataDatasetIds.join(", ")}. Exclusion datasets: ${context.exclusionDatasetIds.join(", ")}.`,
            },
          ],
        });
        break;
      } catch (err) {
        retries++;
        const isRetryable = err instanceof Error && (err.message.includes("Overloaded") || err.message.includes("529") || err.message.includes("rate"));
        if (isRetryable && retries <= maxRetries) {
          const delay = retries * 2000;
          log("REVIEWER", `API error (retry ${retries}/${maxRetries}), waiting ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    const apiDuration = Date.now() - startTime;
    log("REVIEWER", `API call: ${apiDuration}ms`);
    log("REVIEWER", `Usage: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`);

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("\n");

    log("REVIEWER", `Response length: ${text.length} chars`);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const fixes = parsed.fixes_applied || [];
        const excluded = parsed.excluded_strategies || [];
        log("REVIEWER", `Parsed: ${fixes.length} fixes, ${excluded.length} excluded`);
        fixes.forEach((f: { fix: string }, i: number) => log("REVIEWER", `  Fix ${i + 1}: ${f.fix || f}`));

        return {
          updatedStrategies: parsed.updated_strategies || parsed.strategies || strategies,
          fixesApplied: fixes,
          excludedStrategies: excluded,
        };
      } else {
        log("REVIEWER", "No JSON found in response, returning original strategies");
      }
    } catch (err) {
      logError("REVIEWER", "JSON parse failed", err);
      log("REVIEWER", "Raw response (first 500):", text.substring(0, 500));
    }
  } catch (err) {
    logError("REVIEWER", "API call failed", err);
  }

  const totalDuration = Date.now() - startTime;
  log("REVIEWER", `Completed (fallback) in ${totalDuration}ms — returning original strategies`);
  return {
    updatedStrategies: strategies,
    fixesApplied: [],
    excludedStrategies: [],
  };
}


// --- V2 Planner Agent (Wave-based) ---

export interface V2PlannerResult {
  type: "ask_user" | "wave" | "text";
  message?: string;
  wave?: unknown;
  analysis?: unknown;
  toolCallsUsed: number;
}

export async function runV2Planner(
  messages: { role: "user" | "assistant"; content: string }[],
  context: {
    dataDatasetIds: string[];
    exclusionDatasetIds: string[];
    mode: "wave_creation" | "wave_feedback";
    wavesSummary?: string; // Summary of previous waves for context
  }
): Promise<V2PlannerResult> {
  log("V2-PLANNER", `Starting in ${context.mode} mode`);
  log("V2-PLANNER", `Messages: ${messages.length}`);

  const systemPrompt = context.mode === "wave_feedback"
    ? V2_PLANNER_SYSTEM_PROMPT + "\n\n" + V2_WAVE_FEEDBACK_CONTEXT
    : V2_PLANNER_SYSTEM_PROMPT;

  const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Prepend wave summary for feedback mode
  if (context.wavesSummary && context.mode === "wave_feedback") {
    claudeMessages[0] = {
      role: "user",
      content: `Previous waves:\n${context.wavesSummary}\n\n${claudeMessages[0].content as string}`,
    };
    log("V2-PLANNER", "Prepended wave summary to first message");
  }

  let toolCallCount = 0;
  let loopCount = 0;
  const startTime = Date.now();

  while (toolCallCount < MAX_TOOL_CALLS) {
    loopCount++;
    log("V2-PLANNER", `--- Loop ${loopCount} (${toolCallCount} tool calls) ---`);

    let response: Anthropic.Message;
    let retries = 0;
    while (true) {
      try {
        response = await getClient().messages.create({
          model: MODEL,
          max_tokens: 8192,
          system: systemPrompt,
          tools: V2_PLANNER_TOOLS as Anthropic.Tool[],
          messages: claudeMessages,
        });
        break;
      } catch (err) {
        retries++;
        const isRetryable = err instanceof Error && (err.message.includes("Overloaded") || err.message.includes("529") || err.message.includes("rate"));
        if (isRetryable && retries <= 3) {
          const delay = retries * 2000;
          log("V2-PLANNER", `API error (retry ${retries}/3), waiting ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    const apiDuration = Date.now() - startTime;
    log("V2-PLANNER", `API call ${loopCount}: ${apiDuration}ms, stop=${response.stop_reason}`);
    log("V2-PLANNER", `Usage: in=${response.usage.input_tokens}, out=${response.usage.output_tokens}`);

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const textBlocks = response.content.filter((b) => b.type === "text");

    if (textBlocks.length > 0) {
      log("V2-PLANNER", `Text: ${textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("").substring(0, 200)}...`);
    }

    // No tool calls — return text
    if (toolUseBlocks.length === 0) {
      const text = textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("\n");
      log("V2-PLANNER", `Completed (text) in ${Date.now() - startTime}ms`);
      return { type: "text", message: text, toolCallsUsed: toolCallCount };
    }

    claudeMessages.push({ role: "assistant", content: response.content });
    const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const toolBlock = block as Anthropic.ToolUseBlock;
      toolCallCount++;
      log("V2-PLANNER", `Tool #${toolCallCount}: ${toolBlock.name}`);

      // ask_user — return to frontend
      if (toolBlock.name === "ask_user") {
        const input = toolBlock.input as { message: string };
        log("V2-PLANNER", `Ask user: ${input.message.substring(0, 100)}`);
        return { type: "ask_user", message: input.message, toolCallsUsed: toolCallCount };
      }

      // generate_wave — parse and return (include AI reasoning text)
      if (toolBlock.name === "generate_wave") {
        const input = toolBlock.input as { output: string };
        const reasoningText = textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("\n").trim();
        log("V2-PLANNER", `Wave output: ${input.output.length} chars, reasoning: ${reasoningText.length} chars`);
        try {
          const parsed = JSON.parse(input.output);
          log("V2-PLANNER", `Completed (wave) in ${Date.now() - startTime}ms, ${toolCallCount} tool calls`);
          return {
            type: "wave",
            message: reasoningText || undefined,
            wave: parsed.wave,
            analysis: parsed.analysis,
            toolCallsUsed: toolCallCount,
          };
        } catch (err) {
          logError("V2-PLANNER", "Failed to parse wave JSON", err);
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: "Error: Invalid JSON. Please fix and try again.",
          });
          continue;
        }
      }

      // Data tools — same as v1
      const result = executeTool(toolBlock.name, toolBlock.input as Record<string, unknown>, {
        dataDatasetIds: context.dataDatasetIds,
        exclusionDatasetIds: context.exclusionDatasetIds,
      });

      toolResultContents.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    if (toolResultContents.length > 0) {
      claudeMessages.push({ role: "user", content: toolResultContents });
    }
  }

  log("V2-PLANNER", `Hit max tool calls after ${Date.now() - startTime}ms`);
  return { type: "text", message: "Let me generate a wave with what I have.", toolCallsUsed: toolCallCount };
}
