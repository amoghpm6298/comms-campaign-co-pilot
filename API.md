# Campaign Co-pilot — API Reference

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | Send a message — triggers AI analysis, strategy generation, or feedback |
| GET | `/api/campaign?id=xxx` | Load full campaign state (conversation, strategies, versions) |
| PATCH | `/api/campaign` | Update campaign status (go live / schedule) |
| GET | `/api/issuers` | List all issuers |
| GET | `/api/campaigns?issuerId=xxx` | List campaigns (scoped to issuer) |
| GET | `/api/datasets?issuerId=xxx` | List datasets (scoped to issuer) |
| POST | `/api/datasets` | Upload a new dataset (multipart form) |
| GET | `/api/templates?issuerId=xxx` | List templates (scoped to issuer) |
| POST | `/api/templates` | Create a new template |

---

## POST `/api/chat`

Main endpoint for all AI interactions. Handles campaign creation, strategy feedback, and live optimization through a single route.

### Request Body

```typescript
{
  campaignId?: string;          // Omit for new campaign (creation mode)
  issuerId: string;             // Issuer UUID or slug (e.g., "demo-bank")
  mode: "creation" | "feedback" | "live" | "wave_creation" | "wave_feedback";
  campaignMode?: "v1" | "v2";  // v2 triggers wave pipeline flow
  message: string;              // User's chat message
  dataDatasetIds?: string[];    // Dataset IDs for targeting (optional — loaded from DB if omitted)
  exclusionDatasetIds?: string[]; // Dataset IDs for exclusion (optional — loaded from DB if omitted)
  selectedStrategyId?: string;  // Required for feedback/live mode — which strategy to modify
}
```

### Response

```typescript
{
  type: "ask_user" | "strategies" | "wave" | "text";
  message: string;              // AI's text response
  strategies?: Strategy[];      // Only present when type === "strategies" (v1)
  wave?: WaveResponse;          // Only present when type === "wave" (v2)
  campaignId: string;           // Always returned (created if new)
  toolCallsUsed: number;        // How many tool calls the Planner used
}
```

### Strategy Object

```typescript
{
  id: string;                   // DB-generated UUID
  name: string;                 // e.g., "Aggressive Multi-Channel"
  recommended: boolean;         // Exactly one strategy is true
  approach: string;             // 1-2 sentence description
  estimatedImpact: string;      // e.g., "180-240 conversions"
  totalReach: number;           // Sum of all path segment sizes
  exclusions: {                 // Server-computed, not from AI
    total: number;
    npa_list: number;
    dnc_registry: number;
    fraud_flagged: number;
    cooling_off_period: number;
    recent_complaints: number;
  };
  layers: Layer[];              // Transformed from paths[] — one per parallel segment
}
```

### Layer Object

```typescript
{
  name: string;                 // e.g., "High Propensity"
  segment: string;              // Segment description with criteria
  segmentSize: number;          // Post-exclusion reachable count
  channel: string[];            // Derived from steps: unique channels across all steps
  timing: string;               // Legacy — derived from first step
  frequency: string;            // Legacy — derived from step count + duration
  evolution: string;            // Legacy — empty for new campaigns
  exitCondition?: string;       // e.g., "After all steps complete or conversion"
  templates: number;            // Count of steps (or legacy template briefs)
  templateBriefs: TemplateBrief[];
  steps?: Step[];               // Multi-step journey (new format)
}
```

### Step Object

```typescript
{
  id?: string;                  // DB UUID (present when loaded from DB)
  day: number;                  // Day offset from campaign start (1, 3, 7...)
  channel: string;              // "SMS" | "WhatsApp" | "Email" | "Push"
  timing: string;               // Send time, e.g., "10:15 AM"
  brief: string;                // Content brief with {personalization} tokens
}
```

### TemplateBrief Object (legacy)

```typescript
{
  channel: string;              // "SMS" | "WhatsApp" | "Email" | "Push"
  content: string;              // Example copy with {personalization} tokens
}
```

### WaveResponse Object (v2)

```typescript
{
  id: string;                   // DB-generated UUID
  waveNumber: number;           // Position in pipeline (1, 2, 3...)
  name: string;                 // e.g., "Broadcast — EMI Awareness"
  status: string;               // "draft"
  version: number;              // 1 on creation
  journeyTree: JourneyTreeNode[]; // Node tree for React Flow rendering
  audienceCount: number;        // Post-exclusion reachable
  blueprint: string;            // Free text roadmap for future waves
}
```

### JourneyTreeNode Object (v2)

```typescript
{
  id: string;                   // e.g., "w1-entry", "w1-s0-send-0"
  type: "segment" | "send" | "conditional_split" | "random_split" | "pause" | "exit" | "goal_exit";
  label: string;                // Display label
  config: {                     // Type-specific config
    desc?: string;
    detail?: string;
    channel?: string;           // For send nodes
  };
  branches?: {                  // For split nodes
    label: string;
    color: string;
    nodes: JourneyTreeNode[];
  }[];
}
```

### Behavior by Mode

| Mode | What happens |
|------|-------------|
| `creation` (no campaignId) | Creates campaign + conversation in DB, links datasets, runs Planner → Reviewer pipeline |
| `creation` (with campaignId) | Continues conversation, Planner may ask questions or generate strategies |
| `feedback` | Sends current strategy + user feedback to Planner, re-generates and re-reviews |
| `live` | Planner gets live mode context, suggests targeted modifications (not full regeneration) |
| `wave_creation` (no campaignId) | Creates v2 campaign, runs V2 Planner → generates Wave 1 + blueprint |
| `wave_creation` (with campaignId) | Continues v2 conversation, V2 Planner may ask questions or generate wave |
| `wave_feedback` | Sends previous wave summary + user results to V2 Planner, proposes next wave |

### Response Types

| `type` | Meaning | `strategies` present? | `wave` present? |
|--------|---------|----------------------|-----------------|
| `ask_user` | AI is asking a clarifying question | No | No |
| `strategies` | AI generated/updated strategies (v1) | Yes | No |
| `wave` | AI generated a wave (v2) | No | Yes |
| `text` | Generic text response (or mock mode) | No | No |

### Side Effects

- **New campaign**: Creates `Campaign`, `Conversation`, `CampaignDataset` records
- **Strategy generation (v1)**: Creates `Strategy`, `Path`, `TemplateBrief`, `CampaignVersion` records. Sets `activeStrategyId` on campaign to the recommended strategy.
- **Wave generation (v2)**: Creates `Wave` + `WaveVersion` records. Updates campaign `mode` to `"v2"` and `waveBlueprint`. Server runs `convertWaveToJourneyTree()` to convert AI strategy output to node tree before saving.
- **Exclusion computation**: Server computes exclusion counts from actual CSV data (not from AI output)
- **Segment size adjustment**: Server **always** applies proportional exclusion reduction to every path's segment_size: `adjusted = raw × (1 - totalExcluded/totalEligible)`. Sizes exceeding total reachable are capped.

### Error Responses

```typescript
// 400 — Missing campaign or conversation
{ "error": "No campaign or conversation found" }

// 500 — Server error
{ "error": "Something went wrong. Please try again.", "details": "..." }
```

### Mock Mode

Set `MOCK_AI=true` in environment to skip Claude API calls. Returns:
```typescript
{ "type": "text", "message": "Mock AI is enabled...", "campaignId": "mock-campaign" }
```

### Example: Create a New Campaign

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "issuerId": "demo-bank",
    "mode": "creation",
    "message": "Convert outstanding balance to EMI for high-value customers",
    "dataDatasetIds": ["seed-customers.csv", "seed-transactions.csv", "seed-emi_eligibility.csv"],
    "exclusionDatasetIds": ["seed-npa_list.csv", "seed-dnc_list.csv", "seed-fraud_list.csv", "seed-cooling_off_list.csv", "seed-complaint_list.csv"]
  }'
```

### Example: Send Feedback

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "clxyz...",
    "issuerId": "demo-bank",
    "mode": "feedback",
    "message": "Make path 2 SMS only, remove WhatsApp",
    "selectedStrategyId": "strategy-uuid"
  }'
```

---

## GET `/api/campaign`

Loads the full state of a campaign — used by the frontend on page load/refresh to restore UI state.

### Query Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Campaign UUID |

### Response

```typescript
{
  campaign: {
    id: string;
    name: string;
    goal: string;
    status: string;                // "draft" | "live" | "completed"
    activeStrategyId: string | null;
  };
  strategies: Strategy[];          // Same shape as POST /api/chat response
  messages: Message[];             // Full conversation history
  versions: CampaignVersion[];    // Ordered by version number (ascending)
}
```

### Message Object

```typescript
{
  id: string;                     // Timestamp-based ID
  role: "ai" | "user";
  content: string;
}
```

### CampaignVersion Object

```typescript
{
  id: string;
  campaignId: string;
  version: number;                // Auto-incrementing (1, 2, 3...)
  initiator: string;              // "ai" | "user"
  description: string;            // e.g., "Initial strategies generated"
  strategySnapshot: string;       // JSON snapshot of strategies at this version
  createdAt: string;
}
```

### Error Responses

```typescript
// 400 — Missing ID
{ "error": "Missing campaign id" }

// 404 — Campaign not found
{ "error": "Campaign not found" }

// 500 — Server error
{ "error": "Failed to load campaign" }
```

### Example

```bash
curl "http://localhost:3000/api/campaign?id=clxyz..."
```

---

## PATCH `/api/campaign`

Update campaign status (go live or schedule).

### Request Body

```typescript
{
  campaignId: string;           // Required
  status: "live" | "scheduled"; // Required
  scheduledAt?: string;         // ISO datetime, required when status === "scheduled"
}
```

### Response

```typescript
{
  campaign: {
    id: string;
    status: string;
    goLiveAt: string | null;
  }
}
```

### Side Effects

- `status: "live"` → sets `goLiveAt` to current time
- `status: "scheduled"` → sets `goLiveAt` to `scheduledAt` value

---

## GET `/api/issuers`

Lists all issuers available to the user. Used by the sidebar issuer selector.

### Response

```typescript
{
  issuers: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}
```

---

## GET `/api/campaigns`

Lists all campaigns, ordered by most recent first. Scoped by `issuerId` if provided.

### Response

```typescript
{
  campaigns: Array<{
    id: string;
    name: string;
    goal: string;
    status: string;             // "draft" | "live" | "completed" | "paused"
    createdAt: string;
    updatedAt: string;
    _count: { strategies: number };
  }>;
}
```

### Example

```bash
curl "http://localhost:3000/api/campaigns"
```

---

## GET `/api/datasets`

Lists all datasets, ordered by type (data first) then title.

### Response

```typescript
{
  datasets: Array<{
    id: string;
    title: string;
    type: string;               // "data" | "exclusion"
    fileName: string;
    fileSize: number;           // bytes
    rowCount: number;
    status: string;             // "enabled" | "disabled"
    createdAt: string;
  }>;
}
```

### Example

```bash
curl "http://localhost:3000/api/datasets"
```

---

## POST `/api/datasets`

Upload a new dataset (CSV file). Saves file to `data/` directory, parses headers and row count, creates DB record.

### Request (multipart/form-data)

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Dataset title |
| `description` | No | What the dataset contains |
| `type` | Yes | `"data"` or `"exclusion"` |
| `file` | Yes | CSV file |

### Response

```typescript
{
  dataset: {
    id: string;
    title: string;
    type: string;
    fileName: string;
    fileSize: number;
    rowCount: number;
    columns: string;        // JSON array of column names
    status: string;
    processingStatus: string;
    createdAt: string;
  }
}
```

---

## GET `/api/templates`

Lists all templates, ordered by channel then title.

### Response

```typescript
{
  templates: Array<{
    id: string;
    title: string;
    channel: string;            // "SMS" | "WhatsApp" | "Email" | "Push"
    type: string;               // "promotional" | "transactional" | "service-implicit" | "service-explicit"
    body: string;               // Template content
    status: string;             // "approved" | "draft" | "pending"
    dltTemplateId: string | null; // SMS only — TRAI DLT ID
    subject: string | null;     // Email only
    ctaText: string | null;     // WhatsApp only
    pushTitle: string | null;   // Push only
    createdAt: string;
  }>;
}
```

### Example

```bash
curl "http://localhost:3000/api/templates"
```

---

## POST `/api/templates`

Create a new message template.

### Request Body

```typescript
{
  title: string;                // Required
  channel: string;              // "SMS" | "WhatsApp" | "Email" | "Push"
  type: string;                 // "promotional" | "transactional" | "otp"
  description?: string;
  body: string;                 // Required — template content
  subject?: string;             // Email only
  dltTemplateId?: string;       // SMS only — TRAI DLT ID
  ctaText?: string;             // WhatsApp only
  ctaUrl?: string;              // WhatsApp only
  pushTitle?: string;           // Push only
}
```

### Response

```typescript
{
  template: {
    id: string;
    title: string;
    channel: string;
    type: string;
    body: string;
    status: "draft";
    // ... all fields
  }
}
```

---

## Internal: AI Agent Pipeline

The `/api/chat` route orchestrates a two-agent pipeline. Not directly exposed as APIs, but documented here for context.

### Planner Agent

**Model:** `claude-sonnet-4-20250514`
**Max tool calls:** 15 per invocation
**Retry:** 3 attempts with exponential backoff (2s, 4s, 6s) on 529/overload

**Tools available to the AI:**

| Tool | Input | Output | Purpose |
|------|-------|--------|---------|
| `get_dataset_schema` | `dataset_id` | Columns, types, 10 sample rows, row count | Understand available data |
| `count_rows` | `dataset_id`, `filter?` | Integer count | Count cohorts with filters like `outstanding_amount>10000 AND activation_status=active` |
| `get_distribution` | `dataset_id`, `column`, `buckets?` | Bucket/count pairs | Analyze data spread (numeric or categorical) |
| `get_exclusion_summary` | — | Breakdown by exclusion type + total unique | Compute how many customers are excluded |
| `ask_user` | `message` | Pauses pipeline, returns to user | Clarifying questions (max 2) |
| `generate_strategies` | `output` (JSON string) | Terminates pipeline | Final structured strategy output with paths containing `steps[]` |

**Filter syntax for `count_rows`:**
- Single: `column=value`, `column>value`, `column>=value`, `column!=value`
- Compound: `column1=value1 AND column2>value2`
- Operators: `=`, `!=`, `>`, `<`, `>=`, `<=`

### Reviewer Agent

**Model:** `claude-sonnet-4-20250514`
**No tools** — single-call analysis only

**Input:** Raw strategies from Planner + dataset context
**Output:** Fixed strategies + list of fixes applied + list of excluded strategies

**What it checks:** DLT compliance, segment overlap, exclusion coverage, cost sanity, timing windows, template count adequacy.

---

## Dataset ID Reference

The data service accepts both short IDs and seed IDs (from DB):

| Short ID | Seed ID | Dataset | Type | Rows |
|----------|---------|---------|------|------|
| `ds-1` | `seed-customers.csv` | Customer Master | data | 50,000 |
| `ds-2` | `seed-transactions.csv` | Transaction History | data | 857,000 |
| `ds-3` | `seed-emi_eligibility.csv` | EMI Eligibility | data | 50,000 |
| `ds-4` | `seed-npa_list.csv` | NPA List | exclusion | 1,445 |
| `ds-5` | `seed-dnc_list.csv` | DNC Registry | exclusion | 3,972 |
| `ds-6` | `seed-fraud_list.csv` | Fraud Flagged | exclusion | 541 |
| `ds-7` | `seed-cooling_off_list.csv` | Cooling Off Period | exclusion | 1,053 |
| `ds-8` | `seed-complaint_list.csv` | Recent Complaints | exclusion | 785 |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key (stored in `.env.local`) |
| `MOCK_AI` | No | `false` | Set to `"true"` to skip Claude API calls |
| `DATABASE_URL` | Yes | `file:./dev.db` | Prisma database URL |
