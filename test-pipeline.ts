// Run with: npx tsx test-pipeline.ts
// Tests the full Planner → Reviewer pipeline without the API route

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { runPlanner, runReviewer } from "./lib/claude";

async function main() {
  console.log("=== Testing Planner → Reviewer Pipeline ===\n");
  console.log(`API Key: ${process.env.ANTHROPIC_API_KEY?.substring(0, 20)}...`);
  console.log(`MOCK_AI: ${process.env.MOCK_AI}\n`);

  const dataDsIds = ["ds-1", "ds-2", "ds-3"];
  const exclDsIds = ["ds-4", "ds-5", "ds-6", "ds-7", "ds-8"];

  // Step 1: Send goal to Planner
  console.log("--- Step 1: Planner (initial goal) ---");
  const result1 = await runPlanner(
    [{ role: "user", content: "I want to convert outstanding balances to EMI for eligible customers" }],
    { dataDatasetIds: dataDsIds, exclusionDatasetIds: exclDsIds, mode: "creation" }
  );

  console.log(`Type: ${result1.type}`);
  console.log(`Tool calls: ${result1.toolCallsUsed}`);

  if (result1.type === "ask_user") {
    console.log(`\nPlanner asks: ${result1.message}\n`);

    // Step 2: Answer the question
    console.log("--- Step 2: Planner (user answers) ---");
    const result2 = await runPlanner(
      [
        { role: "user", content: "I want to convert outstanding balances to EMI for eligible customers" },
        { role: "assistant", content: result1.message! },
        { role: "user", content: "Use default thresholds, prefer SMS for cost, no timing constraints" },
      ],
      { dataDatasetIds: dataDsIds, exclusionDatasetIds: exclDsIds, mode: "creation" }
    );

    console.log(`Type: ${result2.type}`);
    console.log(`Tool calls: ${result2.toolCallsUsed}`);

    if (result2.type === "strategies") {
      console.log("\n--- Planner generated strategies ---");
      console.log(JSON.stringify(result2.strategies, null, 2).substring(0, 2000));
      console.log("...(truncated)\n");

      // Step 3: Run Reviewer
      console.log("--- Step 3: Reviewer ---");
      const reviewResult = await runReviewer(result2.strategies, {
        dataDatasetIds: dataDsIds,
        exclusionDatasetIds: exclDsIds,
      });

      console.log(`Fixes applied: ${reviewResult.fixesApplied.length}`);
      console.log(`Excluded: ${reviewResult.excludedStrategies.length}`);
      if (reviewResult.fixesApplied.length > 0) {
        reviewResult.fixesApplied.forEach((f) => console.log(`  - ${f.fix}`));
      }
      console.log("\n✅ Pipeline complete");
    } else if (result2.type === "ask_user") {
      console.log(`Planner asks again: ${result2.message}`);
      console.log("\n⚠️ Planner asked more questions — pipeline needs more rounds");
    } else {
      console.log(`Planner text: ${result2.message}`);
    }
  } else if (result1.type === "strategies") {
    console.log("\n--- Planner generated strategies directly ---");
    console.log(JSON.stringify(result1.strategies, null, 2).substring(0, 2000));

    // Run Reviewer
    console.log("\n--- Reviewer ---");
    const reviewResult = await runReviewer(result1.strategies, {
      dataDatasetIds: dataDsIds,
      exclusionDatasetIds: exclDsIds,
    });
    console.log(`Fixes: ${reviewResult.fixesApplied.length}`);
    console.log("\n✅ Pipeline complete");
  } else {
    console.log(`Planner text: ${result1.message}`);
  }
}

main().catch((err) => {
  console.error("Pipeline test failed:", err);
  process.exit(1);
});
