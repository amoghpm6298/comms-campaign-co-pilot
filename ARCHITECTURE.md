# Campaign Co-pilot — Architecture & Decisions

## Versions

### v1 — Hardcoded mockup
- Location: `../smart-nudges-prototype/`
- Dummy strategies, dummy chat responses, dummy templates
- Purpose: UI/UX validation, flow demonstration
- Status: Complete, archived

### v2 (current) — AI-powered
- Location: `smart-nudges-v2/` (this repo)
- Real Claude API calls, real data analysis, real strategy generation
- Prisma + SQLite database (production: Postgres)
- Two campaign modes: **v1** (upfront segmentation) and **v2** (wave pipeline)
- Purpose: Actual product demo with real data
- Status: v1 core flow working, v2 wave pipeline working (wave generation + feedback)

---

## Product Flow

### 1. Dataset Management (no AI)
- User uploads CSVs via Datasets page
- Each dataset has a **type**: `data` or `exclusion`
  - **Data**: customer info, transactions, eligibility — used for targeting
  - **Exclusion**: NPA list, DNC list, fraud flags — used for filtering out
- Datasets are managed independently (CRUD)
- Processing happens on upload (parse columns, count rows)

### 1.5 Issuer Context
- User logs in with email + password (auth not yet implemented — using seeded user)
- Issuer selector dropdown in the sidebar (above nav links)
- All data (datasets, templates, campaigns) is scoped to the selected issuer
- Switching issuer re-fetches all list data instantly via React context (`AppProvider`) — no page reload
- Selected issuer persisted in `localStorage` across sessions
- Seeded issuers: **Demo Bank** (generic datasets + templates) and **Axis Bank** (Axis-specific card types: Flipkart Axis Bank, Ace, Magnus, Privilege, MY Zone + own datasets/templates)
- User creation is backend-only (no self-signup)
- User can have different roles per issuer (admin, marketer, viewer)

### 2. Campaign Creation (AI-powered)

#### Step 0: Mode Selection
- User creates a new campaign and chooses mode: **v1** ("AI designs strategy") or **v2** ("Start broad, refine from engagement")
- Campaign `mode` field stored as `"v1"` or `"v2"`
- Mode determines which prompts, tools, and UI flow are used

#### Step 1: Dataset Selection
- Chat shows a widget to select datasets (checkboxes from uploaded datasets)
- User selects which data + exclusion datasets to use

#### Step 2: Goal Input
- User types their campaign goal in free text
- e.g., "Convert outstanding balance to EMI for high-value customers"

#### Step 3: AI Analysis (Planner Agent)
- Planner agent receives: dataset schemas + samples + aggregations + exclusion counts + goal
- Agent uses tools to explore data (count cohorts, get distributions)
- Agent asks **data-informed clarifying questions** (not hardcoded)
- User answers in chat
- Agent generates 2-3 strategies as structured JSON
- UI shows: "Analyzing your data..."

#### Step 4: AI Review (Reviewer Agent)
- Immediately after Planner completes, Reviewer runs automatically
- Validates: exclusions applied, segments reasonable, templates compliant, no path overlap
- **Auto-applies fixes** silently — user sees the improved output, not the review process
- UI shows: "Reviewing strategies..." (brief loading state)
- **User never sees unreviewed strategies**

#### Step 5: Strategy Display
- Strategies appear as tabs on the canvas — already reviewed and improved
- Most recommended is auto-selected (marked with "Recommended" tag)
- **No visible review annotations** — the Reviewer's improvements are baked into the strategy. The user sees a clean output, not a changelog.
- If the Reviewer blocks a strategy (critical error), that strategy is excluded from the results entirely
- Workflow visualizer renders the journey flow
- Summary bar shows: Audience | Excluded | Reachable | Impact

#### Step 6: User Feedback
- User can ask to adjust via chat
- Planner re-generates with feedback
- Reviewer re-checks automatically before showing updated strategy
- **Old strategies are archived** (`archived: true`) before new ones are saved — only active strategies show in the UI. Archived strategies are preserved for version history and future "compare versions" / "revert" features.
- Same pattern: user never sees unreviewed output

#### Step 7: Go Live
- User clicks "Go Live" → modal offers two options:
  - **Go live now** → status changes to `"live"`, `goLiveAt` set to current time
  - **Schedule for later** → user picks date + time, status changes to `"scheduled"`, `goLiveAt` set to chosen timestamp
- After confirmation, redirects to `/campaign/view?id=xxx`
- Go Live blocked if no templates assigned to any Send node

#### Step 8: Live Optimization (ongoing)
- Campaign is running. User returns with insights from real performance.
- User provides input: "Engagement is low on Layer 1" or "SMS CTR dropped to 1.2%"
- Planner receives: current strategy + user's insight + conversation history
- Planner asks clarifying questions if needed ("What's the current CTR? How many days in?")
- Planner suggests specific modifications (not full regeneration)
- Reviewer validates with **stricter rules** (campaign is live, changes affect real users)
- User sees: suggested changes with diffs highlighted + review annotations
- User approves → new version created → strategy updated

### 2b. v2 Campaign Creation (Wave Pipeline)

When user selects v2 mode, the flow diverges after dataset selection:

- Chat route uses `wave_creation` mode with `V2_PLANNER_SYSTEM_PROMPT` + `V2_PLANNER_TOOLS`
- AI explores data, asks approach preference (broad blast / targeted / AI-suggested)
- AI generates Wave 1 via `generate_wave` tool (strategy-level output: segments + journeys)
- Server converts AI output to node tree via `convertWaveToJourneyTree()` (in `lib/wave-converter.ts`)
- Wave saved to `Wave` table with `journeyTree` JSON blob + `WaveVersion` snapshot
- Campaign `mode` set to `"v2"`, `waveBlueprint` updated
- Frontend renders wave pipeline sidebar (`WavePipeline.tsx`) + journey visualizer (`JourneyFlow`)
- User provides results in chat → mode switches to `wave_feedback` → AI proposes Wave 2+
- `V2_WAVE_FEEDBACK_CONTEXT` appended to system prompt in feedback mode

**Wave converter pipeline:** AI outputs segments/journeys in strategy format. `convertWaveToJourneyTree()` converts to `JourneyTreeNode[]` — handles single-segment linear journeys, multi-segment conditional splits, A/B tests as random splits, pause nodes between steps, and goal/exit nodes. The React Flow visualizer then renders the tree.

**7 v2 node types:** Segment, Send, Conditional Split, Random Split, Pause, Exit, Goal Exit. (Wait Until and Event Trigger deferred to v3.)

---

## Agent Modes

### v1 Agents

The same two agents operate in three modes:

| Mode | Trigger | Planner behavior | Reviewer behavior |
|---|---|---|---|
| **Creation** | New campaign | Full data exploration, ask questions, generate 2-3 strategies | Standard validation |
| **Feedback** | User adjusts draft | Modify selected strategy based on feedback, return full updated strategy | Standard validation |
| **Live optimization** | User reports live insights | Analyze insight against current strategy, suggest targeted modifications | **Stricter** — flag any change that increases reach >20%, changes channel mix, or modifies exclusions |

In live mode:
- Changes are shown as diffs (modified nodes get a "Modified" badge)
- User must explicitly approve before changes take effect
- Each approval creates a new version in version history
- Reviewer prompt includes: "This campaign is live and affecting real users. Be conservative with changes. Flag budget impact."

### v2 Agents

v2 uses a single V2 Planner agent (no separate Reviewer yet) in two modes:

| Mode | Trigger | Behavior |
|---|---|---|
| **wave_creation** | New v2 campaign | Data exploration, generate Wave 1 + blueprint |
| **wave_feedback** | User shares wave results | Analyze results, propose next wave with smarter segmentation |

V2 Planner uses `V2_PLANNER_SYSTEM_PROMPT` (shared domain knowledge + wave-specific rules) and `V2_PLANNER_TOOLS` (same data tools + `generate_wave` instead of `generate_strategies`).

---

## Version History

Every strategy change creates a version:

```json
{
  "versions": [
    { "version": 1, "initiator": "ai", "description": "Initial strategy generated", "timestamp": "...", "strategy_snapshot": {...} },
    { "version": 2, "initiator": "user", "description": "Changed Layer 2 to SMS only", "timestamp": "...", "strategy_snapshot": {...} },
    { "version": 3, "initiator": "ai", "description": "Live optimization: dropped Layer 1, expanded Layer 2", "timestamp": "...", "strategy_snapshot": {...} }
  ]
}
```

**UI:** Version history panel (slide-out from right or bottom of canvas):
- Timeline view: v1 → v2 → v3
- Each version shows: initiator (AI/User badge), description, timestamp
- Click any version to view its strategy snapshot
- Compare two versions side by side (deferred for prototype)
- Current/active version highlighted

**Version rules:**
- Creation mode: v1 is initial AI generation. Feedback creates v2, v3, etc.
- Go live: the current version at time of go-live is marked as "live"
- Live optimization: each approved change increments version
- Rejected suggestions are not versioned (discarded)

---

## Agent Architecture

### Two-agent pipeline

#### Agent 1: Planner
**Role:** Analyze data + generate campaign strategies
**Input:**
- Dataset schemas (column names + types)
- 10 sample rows per dataset
- Pre-computed aggregations (row counts, key distributions)
- Exclusion dataset row counts
- User's goal + context
- Conversation history

**Tools available:**

| Tool | Input | Output |
|---|---|---|
| `get_dataset_schema` | dataset_id | Column names, types, 10 sample rows |
| `count_rows` | dataset_id, filter (optional) | Integer count |
| `get_distribution` | dataset_id, column_name | Buckets with counts |
| `get_exclusion_summary` | — | Total excluded, breakdown by list |
| `ask_user` | question text | Pauses and waits for user response |

**Output (structured JSON):**
```json
{
  "analysis": {
    "total_eligible": 732,
    "exclusions": { "total": 132, "breakdown": {...} },
    "reachable": 600,
    "key_cohorts": [...],
    "insights": [...]
  },
  "strategies": [
    {
      "id": "strategy_1",
      "name": "...",
      "recommended": true,
      "approach": "...",
      "estimated_impact": "...",
      "paths": [
        {
          "name": "High Propensity",
          "reasoning": "why this path exists — what data signal drove it",
          "segment": "OS > 10K, active customers",
          "segment_size": 732,
          "exit_condition": "After all steps complete or conversion",
          "steps": [
            { "day": 1, "channel": "SMS", "timing": "10:15 AM", "brief": "SMS copy with {personalization}..." },
            { "day": 3, "channel": "WhatsApp", "timing": "11:00 AM", "brief": "Follow-up copy..." },
            { "day": 7, "channel": "Email", "timing": "9:00 AM", "brief": "Final escalation copy..." }
          ]
        }
      ]
    }
  ]
}
```

**Two levels of structure:**
1. **Paths are parallel** — each targets a different customer segment simultaneously.
2. **Steps are sequential within a path** — each path has a multi-step journey (Day 1: SMS → Day 3: WhatsApp → Day 7: Email).

**DB model:** `Strategy → Path → Step → TemplateBrief`
- `Path`: segment, segment_size, reasoning, exit_condition
- `Step`: day_offset, channel, timing, brief (one touchpoint)
- `TemplateBrief`: linked to both Path and Step (stepId optional for backward compat)

Legacy fields (`channels`, `timing`, `frequency`, `evolution`) remain on Path for backward compatibility with old campaigns. New campaigns use `steps[]` exclusively.

**Server-side transform (paths → layers):**
```typescript
function pathsToLayers(paths) {
  return paths.map(path => {
    const steps = path.steps || [];
    const channels = [...new Set(steps.map(s => s.channel))];
    return {
      name: path.name,
      segment: path.segment,
      segmentSize: path.segment_size,
      channel: channels,
      exitCondition: path.exit_condition,
      steps: steps.map(s => ({ day: s.day, channel: s.channel, timing: s.timing, brief: s.brief })),
      // Legacy fields derived from steps
      timing: steps[0] ? `Day ${steps[0].day}` : path.timing,
      frequency: steps.length > 1 ? `${steps.length} steps over ${steps[steps.length-1].day} days` : "One-time",
      templates: steps.length,
      templateBriefs: steps.map(s => ({ channel: s.channel, content: s.brief })),
    };
  });
}
```

#### Agent 2: Reviewer
**Role:** Validate strategies, flag issues, add confidence
**Input:**
- Planner's output (strategies JSON)
- Dataset context (schemas, exclusion lists)
- User's goal

**Output:**
```json
{
  "review": {
    "updated_strategies": [...],    // Strategies with fixes applied
    "excluded_strategies": ["..."], // Strategy IDs removed due to critical issues
    "fixes_applied": [              // Server-side audit log, not shown in UI
      { "strategy_id": "...", "fix": "Narrowed segment from 732 to 420" }
    ]
  }
}
```

**No tools** — Reviewer only analyzes and modifies, doesn't query data.

---

## Data Flow

### v1 Flow
```
Uploaded CSVs → parsed on server (headers, samples, row counts)
                    ↓
User selects datasets + types (data/exclusion) via checkbox widget in chat
                    ↓
Campaign created in DB (mode="v1") → datasets linked via CampaignDataset table
                    ↓
Planner explores data via tool calls (get_dataset_schema, count_rows, get_distribution, get_exclusion_summary)
                    ↓
Planner asks max 2 clarifying questions → user answers in chat
                    ↓
Planner generates strategies via generate_strategies tool (structured JSON)
                    ↓
Strategies → Reviewer auto-fixes silently
                    ↓
Server: compute exclusions from actual data (override AI's numbers)
Server: adjust segment_sizes if AI didn't subtract exclusions (proportional safety net)
Server: save strategies + paths + template briefs + version to DB
Server: transform paths[] → layers[] for UI
                    ↓
Render: strategy tabs + workflow visualizer + template brief panel
```

### v2 Flow
```
Uploaded CSVs → parsed on server
                    ↓
User selects datasets → Campaign created (mode="v2")
                    ↓
V2 Planner explores data via tool calls (same tools as v1)
                    ↓
V2 Planner generates wave via generate_wave tool (strategy-level JSON: segments + journeys)
                    ↓
Server: convertWaveToJourneyTree() converts strategy → JourneyTreeNode[]
Server: save Wave + WaveVersion to DB (journeyTree as JSON blob)
Server: update campaign mode + waveBlueprint
                    ↓
Render: WavePipeline sidebar + JourneyFlow (React Flow + dagre layout)
                    ↓
User shares results → wave_feedback mode → V2 Planner proposes Wave 2+
```

### Exclusion-Adjusted Segment Sizes

All segment sizes shown in the UI represent **post-exclusion reachable audience**, not raw counts.

**Two-layer approach:**
1. **Prompt instruction** — Planner system prompt tells AI to call `get_exclusion_summary` first and subtract exclusions from every `segment_size`. Formula: `segment_size = raw_count × (1 - total_excluded / total_eligible)`.
2. **Server-side enforcement** — After AI generates strategies, server **always** applies the proportional exclusion reduction to every path's `segment_size`. Each path is adjusted: `adjusted = raw × (1 - exclusionRatio)`. If any path's size exceeds the total reachable population, it's capped to reachable. This runs unconditionally — not as a conditional safety net.

**Why always apply?** AI is non-deterministic — it may or may not follow the prompt instruction. Even if the AI already subtracted exclusions, applying the ratio again is acceptable (slightly conservative counts are better than inflated ones). The server is the single source of truth for segment sizes.

---

## Claude API Configuration

- **Model for Planner:** `claude-sonnet-4-20250514` (fast, good at tool use)
- **Model for Reviewer:** `claude-sonnet-4-20250514` (validation doesn't need Opus)
- **API key:** stored in `.env.local` as `ANTHROPIC_API_KEY`
- **Client initialization:** Lazy via `getClient()` — created on first use, not at module load (avoids env timing issues)
- **Endpoints:**
  - `/api/chat` (POST) — Single API route handling all conversations (creation, feedback, live)
  - `/api/campaign` (GET) — Load campaign state (conversation + strategies + versions) for URL-based persistence
- **Tool use:** Planner uses agentic tool loop (max 15 tool calls), structured output via `generate_strategies` tool
- **Retry logic:** Exponential backoff on 529/overload errors (2s, 4s, 6s), max 3 retries
- **Streaming:** Not yet implemented — full response wait

---

## System Prompts

Prompts live in `lib/prompts.ts` with a shared base + mode-specific additions:

| Export | Used by |
|---|---|
| `DOMAIN_KNOWLEDGE` | Shared — Indian banking context, channels, compliance, exclusions |
| `SHARED_BEHAVIORAL_RULES` | Shared — data exploration rules, tone |
| `PLANNER_SYSTEM_PROMPT` | v1 creation/feedback — upfront segmentation with parallel paths |
| `REVIEWER_SYSTEM_PROMPT` | v1 — silent auto-fix agent |
| `LIVE_MODE_CONTEXT` | v1 live — appended when campaign is live |
| `V2_PLANNER_SYSTEM_PROMPT` | v2 wave_creation — wave pipeline with segment/journey output |
| `V2_WAVE_FEEDBACK_CONTEXT` | v2 wave_feedback — appended when user shares wave results |
| `PLANNER_TOOLS` | v1 tools (includes `generate_strategies`) |
| `V2_PLANNER_TOOLS` | v2 tools (includes `generate_wave` instead of `generate_strategies`) |

Key domain knowledge encoded: MCC codes, utilization, DLT compliance (9AM-9PM), channel costs, exclusion rules (NPA, DNC, fraud, cooling-off, complaints).

---

## UI Mapping

| Claude Output | UI Component |
|---|---|
| `strategies[].recommended` | "Recommended" tag on strategy tab |
| `strategies[].name` | Strategy tab label |
| `strategies[].layers` | WorkflowVisualizer nodes |
| `strategies[].layers[].templates` | Right slide-out panel |
| `strategies[].layers[].channels` | Channel labels on Send nodes |
| `strategies[].layers[].timing` | Schedule badge in Send nodes |
| `strategies[].estimated_impact` | Summary bar |
| `totalReach + exclusions.total` | Workflow → Entrance node (pre-exclusion total) |
| `exclusions.total` | Workflow → Guardrails node + Summary bar → Excluded |
| `totalReach` | Summary bar → Reach (post-exclusion) |
| `review.fixes` | Applied silently to strategy — not displayed in UI |
| `review.excluded_strategies` | Strategies removed from results if critically flawed |
| Planner `ask_user` tool | Chat message from AI |
| Text responses | Chat messages |

---

## File Structure (v2)

```
app/
  campaign/
    new/page.tsx         ← Campaign builder (chat + canvas + workflow). Handles v1/v2 mode toggle.
    view/page.tsx        ← Live/scheduled campaign view (Strategy + Execution + Performance tabs)
    page.tsx             ← Campaign list (draft→builder, live/scheduled→view)
  data/page.tsx          ← Dataset list (data + exclusion sections)
  templates/page.tsx     ← Template list (card grid with channel filter)
  api/
    chat/route.ts        ← POST — AI chat (creation, feedback, live, wave_creation, wave_feedback)
    campaign/route.ts    ← GET — Load single campaign state
    campaigns/route.ts   ← GET — List campaigns (scoped by issuerId)
    datasets/route.ts    ← GET/POST — List + upload datasets (scoped by issuerId)
    templates/route.ts   ← GET/POST — List + create templates (scoped by issuerId)
    issuers/route.ts     ← GET — List all issuers (for sidebar selector)
lib/
  claude.ts              ← Claude API client (runPlanner, runReviewer, runV2Planner)
  prompts.ts             ← Shared base + v1 prompts + v2 prompts + tool definitions
  wave-converter.ts      ← AI strategy output → JourneyTreeNode[] converter
  data-service.ts        ← CSV parser + tool implementations (countRows, getDistribution, etc.)
  db.ts                  ← Prisma client singleton
components/
  AppProvider.tsx         ← React context for issuer state (shared across pages)
  WorkflowVisualizer.tsx ← Vertical journey builder for v1 (CleverTap-style)
  WavePipeline.tsx       ← Wave pipeline sidebar for v2 (wave list + status)
  Sidebar.tsx            ← Issuer selector dropdown + nav links
  Topbar.tsx             ← Header bar
  journey/
    JourneyFlow.tsx      ← React Flow canvas for v2 journey visualization
    JourneyFlowWrapper.tsx ← Wrapper with ReactFlowProvider
    layout.ts            ← Tree → flat nodes/edges + dagre auto-layout
    nodes.tsx            ← Custom React Flow node components (7 types)
prisma/
  schema.prisma          ← DB schema: Campaign (with mode field), Wave, WaveVersion + v1 tables
  seed.ts                ← Demo Bank issuer, admin user, 8 datasets, 10 templates
data/
  customers.csv          ← 50K customers (5.7MB)
  transactions.csv       ← 857K transactions (41MB)
  emi_eligibility.csv    ← 50K rows (1.8MB)
  npa_list.csv           ← 1,445 excluded
  dnc_list.csv           ← 3,972 excluded
  fraud_list.csv         ← 541 excluded
  cooling_off_list.csv   ← 1,053 excluded
  complaint_list.csv     ← 785 excluded
```

---

## Key Decisions

1. **Two agents, not three** — Planner (analyze + generate) and Reviewer (validate). Three adds latency without proportional value for prototype.

2. **Dataset type (data/exclusion)** — User marks each dataset. Exclusion lists are applied automatically, not analyzed by AI.

3. **Agentic tool use** — Planner uses tool calls in a loop (max 15) to explore data autonomously. Tools implemented server-side against actual CSVs. Output via `generate_strategies` tool ensures valid JSON.

4. **Paths with multi-step journeys** — AI outputs `paths[]` with `steps[]` inside each path. Paths are parallel (different segments), steps are strictly sequential within a path (Day 1: SMS → Day 3: WhatsApp → Day 7: Email). **No branching or conditional logic within a path** — each path is one vertical sequence of touchpoints. Light conditions may appear in step descriptions (e.g., "if no click") but there are no explicit if/else branches in the structure. Server transforms to `layers[]` for UI.

5. **Domain knowledge is facts only** — Prompt contains channel costs, DLT rules, exclusion rules. No goal-specific strategy advice. AI discovers patterns from data.

6. **Single API route** — All chat goes through `/api/chat`. Server manages conversation state, decides which agent to call. Mode (`creation`/`feedback`/`live`) sent by frontend.

7. **Sonnet for both agents** — `claude-sonnet-4-20250514`. Fast enough for demo. Opus not needed for this task complexity.

8. **Reviewer is silent** — Auto-applies fixes before user sees strategies. No visible annotations, changelogs, or badges.

9. **Template briefs, not templates** — AI suggests briefs. User links actual templates from library. Go Live gated until every Send node has a template assigned.

10. **Segment sizes are post-exclusion** — AI is instructed to subtract exclusions from all segment counts. Server applies a proportional safety net: if sum of segment_sizes exceeds (total_eligible - total_excluded) × 1.1, all sizes are reduced by the exclusion ratio. Workflow nodes always show reachable audience, not raw counts.

11. **Exclusions computed server-side** — Don't rely on AI to report exclusion counts. Server calls `getExclusionSummary()` from actual data after strategies are generated, overriding AI's exclusion numbers.

12. **DB-backed persistence** — Prisma + SQLite. Conversations, strategies, versions all persisted. Campaign ID in URL (`/campaign/new?id=xxx`) survives refresh. No in-memory state for critical data.

13. **Dataset ID aliasing** — DB seeds datasets with IDs like `seed-customers.csv`. Data service maps both short IDs (`ds-1`) and seed IDs to the same underlying files. Prevents mismatch between DB and tools.

14. **Auto-incrementing versions** — Each strategy generation/update creates a new `CampaignVersion`. Version number computed from DB (last version + 1), not hardcoded.

15. **v1/v2 mode toggle** — Campaign `mode` field is `"v1"` or `"v2"`. Determines which prompts, tools, chat modes, and UI components are used. Chosen at campaign creation time.

16. **Wave = JSON blob** — Wave journeys stored as `journeyTree` JSON in the Wave table (not normalized into node/edge tables). Simpler to iterate on, AI output → JSON → DB in one step. `WaveVersion` stores snapshots of `journeyTree` at each version.

17. **AI outputs strategy, server converts to nodes** — V2 Planner outputs segments + journeys (strategy-level thinking). `wave-converter.ts` on the server converts to `JourneyTreeNode[]` for React Flow. This keeps the AI prompt clean and node-type-agnostic.

18. **Shared prompt base** — `DOMAIN_KNOWLEDGE` and `SHARED_BEHAVIORAL_RULES` are shared between v1 and v2 planners. Mode-specific behavior lives in `PLANNER_SYSTEM_PROMPT` (v1) and `V2_PLANNER_SYSTEM_PROMPT` (v2).

19. **React Flow + dagre for v2 visualization** — Ported from v0 prototype. `components/journey/layout.ts` converts `JourneyTreeNode[]` tree to flat nodes + edges, then applies dagre auto-layout. Custom node components in `components/journey/nodes.tsx` for the 7 node types.

---

## Multi-Step Paths — Implementation Status

### Done
- **Prisma schema**: `Step` model added under `Path` (id, pathId, channel, timing, dayOffset, brief, sortOrder). `TemplateBrief` has optional `stepId`. Migration applied.
- **Planner prompt**: Updated output format — paths have `steps[]` instead of flat `channels`/`timing`/`frequency`/`evolution`/`template_briefs`. Steps have `day`, `channel`, `timing`, `brief`.
- **Planner behavioral rules**: Deeper data exploration (6-10 tool calls), always ask about campaign duration and success metric, step design guidelines (2-4 steps, start cheap escalate rich). Explicit no-branching constraint.
- **Reviewer prompt**: Updated to validate step sequences — day ordering, channel escalation, step count sanity.
- **Chat route**: `pathsToLayers()` derives channels/timing/frequency from steps. Path-saving loop creates `Step` records + `TemplateBrief` per step with `stepId`. Falls back to legacy flat format if AI outputs old schema.
- **Campaign load route**: Prisma include fetches steps ordered by sortOrder. Layer transform includes `steps[]`, derives channels/templates from steps when present.
- **Frontend types**: `steps[]` and `exitCondition` added to layer type in both `new/page.tsx` and `view/page.tsx`.
- **WorkflowVisualizer**: `Layer` interface includes `StepData[]`. Multi-step branch rendering shows vertical sequence of [Day badge → Send node] per step. Legacy single-Send fallback preserved. Preview panel handles step-level briefs (`layerName__stepN` format).

### Pending
- **Cleanup**: Remove hardcoded `layerTemplates` from WorkflowVisualizer once all campaigns use multi-step format
- **Template assignment per step**: Currently assignment UX works at path level — needs updating to assign per-step once templates are being assigned in production

---

## Phase 2 (Future)

### Event-based paths
Currently all paths are **scheduled** — define a segment, set timing, send. Phase 2 adds **event-triggered** paths where a real-time event initiates the nudge.

**Examples:**
- Trigger EMI nudge within 2 hours of electronics purchase > ₹10K
- Send activation reminder when card issued but no transaction after 7 days
- Push notification when payment bounces

**What's needed:**
- Real-time event streaming infrastructure
- Event listener / webhook system
- New path type in AI output: `"trigger": "event"` vs `"trigger": "scheduled"`
- UI: event paths shown with trigger icon + event description instead of timing
- Planner prompt update to suggest event paths when relevant

**Not building for prototype** — requires infrastructure beyond the AI layer.

### Adaptive Campaign Intelligence (high value — 10x differentiator)

Three levels of increasing sophistication. Each builds on the previous.

**Level 2: Exit conditions + path reassignment**
- Each step gets an optional `exitCondition` field (e.g., "skip if converted", "skip if clicked previous step")
- AI suggests these conditions based on data patterns
- Customers who convert exit the path immediately — no more nudging converters
- Non-engagers after Day X get reassigned to a different path (e.g., Broad Reach → Retargeting)
- Visualizer: straight vertical lines stay the same. Path reassignment shown as dotted arrow between paths.
- **This is the killer feature** — banks currently do this manually with ops teams. AI auto-suggesting "move non-responders from Path A to Path B after Day 3" and executing it is genuinely differentiated vs MoEngage/CleverTap where the user designs branching logic manually.

**Exit conditions are path-level** — already in the model (`exitCondition` on Path). These define when a customer leaves the path entirely (e.g., "After EMI conversion or all 30 days complete"). Not per-step.

**Schema change needed for Level 2:** Add `reassignmentRule: String @default("{}")` to Path model (JSON: `{ "afterDay": 3, "condition": "no_engagement", "targetPathName": "Retargeting" }`). Skip conditions (per-step) can be a simple text field on Step for the AI to describe, but not structural — execution engine interprets them.

**Level 3: Event-triggered branching**
- Real-time events (OTP initiated, payment bounce, app open, transaction) trigger new branches or path switches
- AI suggests event rules from data: "12% of customers open app within 2h of SMS — add push trigger for app openers"
- New step type: `"trigger": "event"` vs `"trigger": "scheduled"`
- Requires: real-time event streaming, webhook/listener infrastructure, event schema definition
- Visualizer: event-triggered steps shown with lightning bolt icon instead of clock

**Not building for prototype** — Level 2 is achievable with current architecture (schema + prompt changes only). Level 3 requires real-time infrastructure.

### Other Phase 2 items
- Non-Hyperface data ingestion (connectors for Zeta, M2P, in-house)
- Campaign A/B testing (compare two strategies against each other)
- Automated performance monitoring (AI watches metrics without user input)
- Live mode Co-pilot chat (user shares performance insights, AI suggests targeted modifications)

---

## Edge Cases & Design Decisions

### 1. Conversation State

**Problem:** What happens on page refresh, navigation away, or multiple campaigns?

**Approach:**
- Conversations stored in Prisma DB (`Conversation` table), keyed by `campaignId`
- Campaign ID stored in URL query param (`/campaign/new?id=xxx`)
- On refresh: `useEffect` loads conversation + strategies from `/api/campaign?id=xxx`
- On navigation away: state persists in DB indefinitely
- Multiple campaigns: each gets its own conversation record
- Messages stored as JSON array in the `messages` column
- Agent state (for future use) stored in `agentState` column

### 2. Planner Stopping Condition

**Problem:** Agent could loop forever exploring data and asking questions.

**Approach:**
- System prompt encodes explicit rules:
  - "Explore data with max 5 tool calls before asking the user"
  - "Ask max 2 clarifying questions before generating strategies"
  - "If the user says 'go ahead', 'generate', 'start', or similar — stop asking and generate immediately"
- Hardcoded server-side limit: max 15 tool calls per Planner invocation. If exceeded, force generate with what's available.
- After user answers a clarifying question, the next Planner call should generate strategies (not ask more questions), unless the answer was ambiguous.

### 3. Reviewer Behavior

**Problem:** What happens when the Reviewer finds issues?

**Approach: Silent auto-fix**
- Reviewer applies fixes directly to the strategy before showing to the user
- The user sees a clean, optimized output — no flags, no changelogs, no badges
- Reviewer improvements are invisible to the user (baked into the strategy)
- If a critical error exists that can't be auto-fixed (e.g., all customers are in exclusion lists), the strategy is excluded from results entirely
- The Reviewer's changes are logged server-side for audit but not displayed in the UI
- **No visible annotations** — the product feels confident, not uncertain

### 4. Template Generation

**Problem:** If a layer has 8 templates, generating all upfront is expensive (~3K tokens per strategy).

**Approach: Lazy generation**
1. Planner generates **2 templates per layer** in the initial strategy output (enough to show the approach)
2. When user clicks "Preview" on a Send node, if more templates are needed:
   - Fire a lightweight API call: "Generate {N} more templates for this layer with this context"
   - Show a loading state in the preview panel
   - Templates appear as they stream in
3. Template count in the layer metadata shows the intended count (e.g., "8 templates") even if only 2 are generated initially
4. Preview panel shows: "Showing 2 of 8 templates. [Generate remaining →]" button

**Token budget per initial strategy generation:**
- 3 strategies × 3 layers × 2 templates = 18 templates
- ~50 tokens per template = ~900 tokens for all templates
- Acceptable.

### 5. Exclusion Dataset Join

**Problem:** How do we know which customers in data datasets match exclusion datasets?

**Approach:**
- On upload, we parse the exclusion CSV and extract the join key column
- **Convention:** The first column of any exclusion CSV is treated as the join key (typically `customer_id`)
- On campaign creation, when user selects datasets:
  - We identify the common key across data + exclusion datasets (match by column name)
  - Count the intersection: how many unique IDs from data datasets appear in each exclusion dataset
  - Send to Planner: `{ "npa_list": { "excluded": 42, "join_key": "customer_id" }, "dnc_list": { "excluded": 58, "join_key": "customer_id" } }`
- **If no common key found:** show a warning in the dataset selection step — "No matching column found between {data dataset} and {exclusion dataset}. Please ensure both have a common identifier."
- For prototype: assume `customer_id` is always the join key. Skip the matching logic.

### 6. Journey Structure

**Design constraint:** No branching or conditional logic within a path. Each path is a strictly sequential journey.

**Structure:**
```
Entrance (all eligible) → Guardrails (apply exclusions) → Split by Segment
  → Path A: [Step 1: Day 1 SMS] → [Step 2: Day 3 WhatsApp] → [Step 3: Day 7 Email] → Exit
  → Path B: [Step 1: Day 1 SMS] → [Step 2: Day 5 SMS] → Exit
```

- Multiple paths = parallel segments (different audiences)
- Each path = one vertical sequence of steps (no branching, no if/else)
- Each step = one channel + one timing + one brief
- Light conditions allowed in step descriptions (e.g., "if no click, try WhatsApp") but NOT as structural branches
- Graph-based workflows with arbitrary branching deferred to Phase 2

### 7. Feedback & Partial Updates

**Problem:** User says "make layer 2 SMS only." How does Planner handle partial changes?

**Approach:**
- On feedback, send to Planner:
  - Full current strategy JSON (the one selected)
  - User's feedback message
  - System prompt addition: "The user wants to modify the existing strategy. Make only the requested changes. Keep everything else the same. Return the complete updated strategy."
- Planner returns a **full updated strategy** (not a diff)
- UI replaces the selected strategy with the updated version
- A new version is created in the version history: "v2 — User: Changed Layer 2 to SMS only"
- Previous version is preserved (user can compare)
- **No diff-based updates** — full replacement is simpler and less error-prone for prototype.

### 8. Error Handling

**Problem:** Claude returns malformed JSON, tool call fails, API timeout.

**Approach:**

| Error | User sees | Technical handling |
|---|---|---|
| Malformed JSON from Planner | "Something went wrong. Let me try again." | Retry once with same input. If still fails, show error. |
| Tool call fails (e.g., dataset parsing error) | "I couldn't process that dataset. Check the format." | Log error, return error message in chat. |
| API timeout (>30s) | "This is taking longer than expected..." | Show after 10s. Abort after 30s with error message. |
| Reviewer fails | Skip review, show strategies without review annotations | Log warning. Strategies still usable. |
| Rate limit | "Too many requests. Please wait a moment." | Exponential backoff, max 3 retries. |

- All errors are non-fatal — the chat never breaks. User can always type another message.
- Errors are logged to console for debugging.

### 9. Campaign Storage

**Problem:** Where do AI-created campaigns live?

**Approach (implemented):**
- Prisma + SQLite database (production: Postgres)
- `Campaign` table: id, name, goal, status, activeStrategyId, activeVersion, issuerId
- `Strategy` table: id, campaignId, name, approach, recommended, estimatedImpact, totalReach, exclusions (JSON), analysis (JSON), reviewerFixes (JSON)
- `Path` table: id, strategyId, name, reasoning, segmentDescription, segmentSize, channels (JSON), timing, frequency, evolution, exitCondition, sortOrder
- `TemplateBrief` table: id, pathId, channel, content, tone, sortOrder
- `CampaignVersion` table: id, campaignId, version (auto-incrementing), initiator, description, strategySnapshot (JSON)
- `Conversation` table: id, campaignId, messages (JSON), agentState (JSON), mode
- Full schema in `prisma/schema.prisma` (13 tables total including Issuer, User, Dataset, Template, Execution)

### 10. Token Budget & Cost

**Estimated tokens per campaign creation:**

| Call | Input tokens | Output tokens | Cost (Sonnet) |
|---|---|---|---|
| Planner: data exploration (3-5 tool calls) | ~4K | ~2K | ~$0.02 |
| Planner: strategy generation | ~6K | ~4K | ~$0.04 |
| Reviewer | ~5K | ~1K | ~$0.02 |
| **Total per campaign** | **~15K** | **~7K** | **~$0.08** |

Additional costs per feedback iteration: ~$0.04
Template lazy generation: ~$0.01 per batch

**For a demo session (5 campaigns):** ~$0.50. Negligible.
