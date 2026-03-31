import fs from "fs";
import path from "path";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [DATA-SVC] ${msg}`);
}

// --- Types ---

export interface DatasetMeta {
  id: string;
  title: string;
  type: "data" | "exclusion";
  fileName: string;
  rowCount: number;
  columns: { name: string; sample: string }[];
  sampleRows: Record<string, string>[];
}

interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

// --- CSV Parser ---

const DATA_DIR = path.join(process.cwd(), "data");
const csvCache = new Map<string, ParsedCSV>();

function parseCSV(fileName: string): ParsedCSV {
  if (csvCache.has(fileName)) {
    return csvCache.get(fileName)!;
  }
  log(`Parsing CSV: ${fileName}`);

  const filePath = path.join(DATA_DIR, fileName);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });

  const result = { headers, rows };
  csvCache.set(fileName, result);
  log(`Parsed ${fileName}: ${rows.length} rows, ${headers.length} columns`);
  return result;
}

// --- Dataset Registry ---

const DATASETS: Record<string, { title: string; type: "data" | "exclusion"; fileName: string }> = {
  // Short IDs
  "ds-1": { title: "Customer Master", type: "data", fileName: "customers.csv" },
  "ds-2": { title: "Transaction History", type: "data", fileName: "transactions.csv" },
  "ds-3": { title: "EMI Eligibility", type: "data", fileName: "emi_eligibility.csv" },
  "ds-4": { title: "NPA List", type: "exclusion", fileName: "npa_list.csv" },
  "ds-5": { title: "DNC Registry", type: "exclusion", fileName: "dnc_list.csv" },
  "ds-6": { title: "Fraud Flagged", type: "exclusion", fileName: "fraud_list.csv" },
  "ds-7": { title: "Cooling Off Period", type: "exclusion", fileName: "cooling_off_list.csv" },
  "ds-8": { title: "Recent Complaints", type: "exclusion", fileName: "complaint_list.csv" },
  // Seed IDs (from DB)
  "seed-customers.csv": { title: "Customer Master", type: "data", fileName: "customers.csv" },
  "seed-transactions.csv": { title: "Transaction History", type: "data", fileName: "transactions.csv" },
  "seed-emi_eligibility.csv": { title: "EMI Eligibility", type: "data", fileName: "emi_eligibility.csv" },
  "seed-npa_list.csv": { title: "NPA List", type: "exclusion", fileName: "npa_list.csv" },
  "seed-dnc_list.csv": { title: "DNC Registry", type: "exclusion", fileName: "dnc_list.csv" },
  "seed-fraud_list.csv": { title: "Fraud Flagged", type: "exclusion", fileName: "fraud_list.csv" },
  "seed-cooling_off_list.csv": { title: "Cooling Off Period", type: "exclusion", fileName: "cooling_off_list.csv" },
  "seed-complaint_list.csv": { title: "Recent Complaints", type: "exclusion", fileName: "complaint_list.csv" },
  // Axis Bank Seed IDs
  "axis-seed-customers_axis.csv": { title: "Customer Master", type: "data", fileName: "customers_axis.csv" },
  "axis-seed-transactions.csv": { title: "Transaction History", type: "data", fileName: "transactions.csv" },
  "axis-seed-emi_eligibility.csv": { title: "EMI Eligibility", type: "data", fileName: "emi_eligibility.csv" },
  "axis-seed-npa_list.csv": { title: "NPA List", type: "exclusion", fileName: "npa_list.csv" },
  "axis-seed-dnc_list.csv": { title: "DNC Registry", type: "exclusion", fileName: "dnc_list.csv" },
  "axis-seed-fraud_list.csv": { title: "Fraud Flagged", type: "exclusion", fileName: "fraud_list.csv" },
  "axis-seed-cooling_off_list.csv": { title: "Cooling Off Period", type: "exclusion", fileName: "cooling_off_list.csv" },
  "axis-seed-complaint_list.csv": { title: "Recent Complaints", type: "exclusion", fileName: "complaint_list.csv" },
};

// --- Tool Implementations ---

export function getDatasetSchema(datasetId: string): {
  title: string;
  type: string;
  columns: { name: string; sample: string }[];
  sampleRows: Record<string, string>[];
  rowCount: number;
} {
  const ds = DATASETS[datasetId];
  if (!ds) throw new Error(`Dataset ${datasetId} not found`);

  const csv = parseCSV(ds.fileName);
  const sampleRows = csv.rows.slice(0, 10);
  const columns = csv.headers.map((h) => ({
    name: h,
    sample: csv.rows[0]?.[h] || "",
  }));

  return {
    title: ds.title,
    type: ds.type,
    columns,
    sampleRows,
    rowCount: csv.rows.length,
  };
}

export function countRows(datasetId: string, filter?: string): number {
  const ds = DATASETS[datasetId];
  if (!ds) throw new Error(`Dataset ${datasetId} not found`);

  const csv = parseCSV(ds.fileName);

  if (!filter) return csv.rows.length;

  // Parse filter: "column=value" or "column>value" or "column<value" or compound with AND
  const conditions = filter.split(" AND ").map((f) => f.trim());

  return csv.rows.filter((row) => {
    return conditions.every((cond) => {
      const match = cond.match(/^(\w+)\s*(>=|<=|!=|>|<|=)\s*(.+)$/);
      if (!match) return true;

      const [, col, op, val] = match;
      const rowVal = row[col];
      if (rowVal === undefined) return false;

      // Try numeric comparison
      const numRow = parseFloat(rowVal);
      const numVal = parseFloat(val);
      const isNumeric = !isNaN(numRow) && !isNaN(numVal);

      switch (op) {
        case "=":
          return isNumeric ? numRow === numVal : rowVal.toLowerCase() === val.toLowerCase();
        case "!=":
          return isNumeric ? numRow !== numVal : rowVal.toLowerCase() !== val.toLowerCase();
        case ">":
          return isNumeric ? numRow > numVal : false;
        case "<":
          return isNumeric ? numRow < numVal : false;
        case ">=":
          return isNumeric ? numRow >= numVal : false;
        case "<=":
          return isNumeric ? numRow <= numVal : false;
        default:
          return true;
      }
    });
  }).length;
}

export function getDistribution(
  datasetId: string,
  column: string,
  buckets: number = 5
): { bucket: string; count: number }[] {
  const ds = DATASETS[datasetId];
  if (!ds) throw new Error(`Dataset ${datasetId} not found`);

  const csv = parseCSV(ds.fileName);
  const values = csv.rows.map((r) => r[column]).filter((v) => v !== undefined && v !== "");

  // Check if numeric
  const numericValues = values.map(Number).filter((n) => !isNaN(n));

  if (numericValues.length > values.length * 0.8) {
    // Numeric distribution
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const step = (max - min) / buckets;

    const result: { bucket: string; count: number }[] = [];
    for (let i = 0; i < buckets; i++) {
      const lo = min + step * i;
      const hi = min + step * (i + 1);
      const count = numericValues.filter((v) => (i === buckets - 1 ? v >= lo && v <= hi : v >= lo && v < hi)).length;
      result.push({
        bucket: `${Math.round(lo)}-${Math.round(hi)}`,
        count,
      });
    }
    return result;
  } else {
    // Categorical distribution
    const freq: Record<string, number> = {};
    values.forEach((v) => {
      freq[v] = (freq[v] || 0) + 1;
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([bucket, count]) => ({ bucket, count }));
  }
}

export function getExclusionSummary(
  dataDatasetIds: string[],
  exclusionDatasetIds: string[]
): {
  breakdown: { name: string; count: number }[];
  totalUnique: number;
} {
  // Get all customer IDs from data datasets
  const dataCustomerIds = new Set<string>();
  for (const dsId of dataDatasetIds) {
    const ds = DATASETS[dsId];
    if (!ds) continue;
    const csv = parseCSV(ds.fileName);
    csv.rows.forEach((r) => {
      const id = r.customer_id || r.id;
      if (id) dataCustomerIds.add(id);
    });
  }

  // Count exclusions
  const allExcludedIds = new Set<string>();
  const breakdown: { name: string; count: number }[] = [];

  for (const dsId of exclusionDatasetIds) {
    const ds = DATASETS[dsId];
    if (!ds) continue;
    const csv = parseCSV(ds.fileName);

    let count = 0;
    csv.rows.forEach((r) => {
      const id = r.customer_id || r.id;
      if (id && dataCustomerIds.has(id)) {
        count++;
        allExcludedIds.add(id);
      }
    });

    breakdown.push({ name: ds.title, count });
  }

  return {
    breakdown,
    totalUnique: allExcludedIds.size,
  };
}

// --- Utility ---

export function listDatasets(): DatasetMeta[] {
  return Object.entries(DATASETS).map(([id, ds]) => {
    const csv = parseCSV(ds.fileName);
    return {
      id,
      title: ds.title,
      type: ds.type,
      fileName: ds.fileName,
      rowCount: csv.rows.length,
      columns: csv.headers.map((h) => ({ name: h, sample: csv.rows[0]?.[h] || "" })),
      sampleRows: csv.rows.slice(0, 5),
    };
  });
}
