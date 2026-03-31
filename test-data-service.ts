// Run with: npx tsx test-data-service.ts

import { getDatasetSchema, countRows, getDistribution, getExclusionSummary, listDatasets } from "./lib/data-service";

console.log("=== Testing Data Service ===\n");

// Test 1: List datasets
console.log("1. List datasets:");
const datasets = listDatasets();
datasets.forEach((ds) => {
  console.log(`   ${ds.id}: ${ds.title} (${ds.type}) — ${ds.rowCount} rows, ${ds.columns.length} columns`);
});

// Test 2: Schema
console.log("\n2. Customer schema:");
const schema = getDatasetSchema("ds-1");
console.log(`   Columns: ${schema.columns.map((c) => c.name).join(", ")}`);
console.log(`   Rows: ${schema.rowCount}`);
console.log(`   Sample: ${JSON.stringify(schema.sampleRows[0]).substring(0, 100)}...`);

// Test 3: Count rows
console.log("\n3. Count rows:");
console.log(`   Total customers: ${countRows("ds-1")}`);
console.log(`   Active customers: ${countRows("ds-1", "activation_status=active")}`);
console.log(`   Inactive customers: ${countRows("ds-1", "activation_status=inactive")}`);
console.log(`   EMI eligible: ${countRows("ds-3", "emi_eligible=true")}`);
console.log(`   OS > 10000: ${countRows("ds-3", "outstanding_amount>10000")}`);
console.log(`   OS > 25000: ${countRows("ds-3", "outstanding_amount>25000")}`);
console.log(`   Utilization > 80: ${countRows("ds-3", "current_utilization>80")}`);
console.log(`   High propensity (util>80 AND payment<=14): ${countRows("ds-3", "current_utilization>80 AND days_to_payment<=14")}`);
console.log(`   Electronics txns > 10K: ${countRows("ds-2", "mcc_category=electronics AND txn_amount>10000")}`);

// Test 4: Distribution
console.log("\n4. Outstanding amount distribution:");
const osDist = getDistribution("ds-3", "outstanding_amount", 5);
osDist.forEach((b) => console.log(`   ${b.bucket}: ${b.count}`));

console.log("\n5. MCC category distribution:");
const mccDist = getDistribution("ds-2", "mcc_category");
mccDist.forEach((b) => console.log(`   ${b.bucket}: ${b.count}`));

console.log("\n6. Card type distribution:");
const cardDist = getDistribution("ds-1", "card_type");
cardDist.forEach((b) => console.log(`   ${b.bucket}: ${b.count}`));

// Test 5: Exclusion summary
console.log("\n7. Exclusion summary:");
const exclusions = getExclusionSummary(["ds-1", "ds-2", "ds-3"], ["ds-4", "ds-5", "ds-6", "ds-7", "ds-8"]);
exclusions.breakdown.forEach((b) => console.log(`   ${b.name}: ${b.count}`));
console.log(`   Total unique excluded: ${exclusions.totalUnique}`);

console.log("\n=== All tests passed ===");
