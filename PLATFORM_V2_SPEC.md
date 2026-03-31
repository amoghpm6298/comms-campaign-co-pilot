# Platform v2 — Broadcast → Learn → Segment

## Overview

Platform v2 shifts from "AI segments upfront" to "start broad, learn from engagement, segment progressively." The campaign is a living pipeline of waves that continuously improves.

**v1 (current):** AI analyzes data → creates parallel segments → targets specific groups from day 1
**v2 (proposed):** AI designs a broadcast → observes engagement → proposes segments → marketer approves → repeat

Both modes available — marketer chooses at campaign creation: **"AI designs strategy"** (v1) or **"Start broad, refine from engagement"** (v2).

---

## Core Mental Model

A campaign is a **pipeline of waves**. Every customer enters at Wave 1 and progresses through the pipeline at their own pace.

```
[New eligible customers every day]
        ↓
   ┌─────────┐
   │ Wave 1  │  Broadcast to all — one channel, one message
   │  (v3)   │  Runs forever for new entrants
   └────┬────┘
        ↓  (after engagement observed, 2-3 days per customer)
   ┌─────────┐
   │ Wave 2  │  Segmented by Wave 1 engagement
   │  (v2)   │  High engagers → WhatsApp upsell
   │         │  Non-responders → SMS retry with new copy
   └────┬────┘
        ↓  (after Wave 2 results)
   ┌─────────┐
   │ Wave 3  │  Refined further — AI proposed based on cumulative data
   │  (v1)   │  Converters → exit. Rest → final push.
   └─────────┘
```

**Key properties:**
- **Open cohort** — new eligible customers enter Wave 1 every day, not just at campaign start
- **All waves are live simultaneously** — on any given day, some customers are in Wave 1, others in Wave 2, others in Wave 3
- **Each wave runs indefinitely** — Wave 1 never "finishes." It's always active for new entrants.
- **Customers flow through at their own pace** — customer who enters Day 1 might be in Wave 3 by Day 10, customer who enters Day 8 is still in Wave 1
- **Waves are a linked chain** — if Wave 3 is removed, customers in Wave 2 flow to Wave 4 (or whatever comes next). Not hardcoded to wave numbers.
- **Any wave can be edited anytime** — changes apply to future customers only. Already-processed customers are not affected.
- **Each wave is independently versioned** — Wave 1 can be on v3 while Wave 2 is still on v1.

---

## Campaign Creation Flow

### Step 1: Goal + Datasets
Same as v1 — marketer selects datasets, types goal.

### Step 2: AI Designs Wave 1
AI explores data, asks 1-2 clarifying questions (duration, priority), then generates:
- **Wave 1**: Full broadcast — audience (all eligible), channel, timing, copy/brief
- **Wave blueprint**: Rough roadmap of future waves (intent only, not detailed)

```json
{
  "wave_1": {
    "audience": "All 10,309 reachable customers",
    "channel": "SMS",
    "timing": "Day 1, 10:30 AM",
    "brief": "Hi {name}, convert your ₹{os_amount} outstanding to easy EMI...",
    "exit_condition": "After delivery"
  },
  "blueprint": {
    "wave_2": "Segment by engagement — target high engagers with WhatsApp, retry non-responders with SMS",
    "wave_3": "Refine based on conversion data — focus on high-intent non-converters",
    "wave_4_plus": "Ongoing optimization based on cumulative performance"
  }
}
```

### Step 3: Marketer Approves Wave 1
Can modify copy, channel, timing. Approves → Wave 1 goes live.

### Step 4: Wave 1 Runs
Customers receive Wave 1 comms. Engagement data flows in (opens, clicks, conversions). New eligible customers continue to enter Wave 1 daily.

### Step 5: Wave 2 — Three Paths to Definition

**Option A: Wait for data (blueprint mode)**
Marketer returns with performance data (types into chat for demo, auto-fed in production). AI analyzes engagement + business events → proposes Wave 2 with specific segments.

**Option B: Pre-define upfront**
At campaign creation, marketer says "I already know Wave 2 — WhatsApp to high engagers, SMS retry to non-responders." AI sets it up fully. Doesn't wait for Wave 1 data. Goes live as soon as customers complete Wave 1.

**Option C: AI pre-defines with approval**
AI is confident enough to fully specify Wave 2 at creation time (e.g., "based on typical engagement patterns, I recommend this Wave 2"). Marketer approves or modifies. Can still be updated later after real data comes in (version bump).

All three modes result in the same thing: a fully specified wave ready to go live. The flexibility lets the marketer choose how much control vs automation they want.

Example AI response:
> "After 3 days, here's what I see from Wave 1:
> - 2,340 opened + clicked (high intent) — 23% of audience
> - 4,120 opened but no click (aware but passive)
> - 3,849 didn't open (non-responders)
> - 89 converted EMI (remove from pipeline)
>
> For Wave 2, I recommend:
> - **High Intent** (2,340): WhatsApp with direct EMI link + urgency copy
> - **Passive** (4,120): Push notification with different value prop
> - **Non-responders** (3,849): SMS retry with shorter, punchier copy
>
> Approve?"

### Step 6: Marketer Approves/Adjusts → Wave 2 Goes Live
Can modify segments, channels, copy. Can add/remove segments. Approves → Wave 2 starts processing customers who completed Wave 1.

### Step 7: Continuous Loop
- Wave 3 proposed after Wave 2 data
- Any wave can be modified at any time (versioned)
- AI continuously suggests improvements based on cumulative data
- Campaign runs until marketer pauses/stops

---

## Wave Properties

| Property | Description |
|----------|-------------|
| Wave number | Position in the pipeline (1, 2, 3...) |
| Status | `blueprint` / `draft` / `live` / `paused` / `completed` |
| Definition mode | `blueprint` (waiting for data) / `pre-defined` (marketer set it upfront) / `ai-proposed` (AI defined after data) |
| Version | Independent version per wave (v1, v2, v3) |
| Audience rule | Wave 1: "all eligible". Wave 2+: segment rules based on previous wave engagement |
| Strategy | Reuses Strategy model — paths with steps |
| Entry condition | Wave 1: eligible + not excluded. Wave N: completed Wave N-1 + meets segment criteria |
| Exit condition | After all steps complete, or conversion event |

---

## Event System

Two categories of events drive wave intelligence:

### Engagement Events (from messaging platform)
- `delivered` — message reached device
- `opened` — message opened/read
- `clicked` — link in message clicked
- `unsubscribed` — customer opted out

### Business Events (from card processor — **our moat**)
- `emi_converted` — customer converted outstanding to EMI
- `payment_bounce` — payment failed/bounced
- `card_activated` — dormant card used for the first time
- `spend_threshold` — spend crossed a threshold in a category
- `utilization_change` — credit utilization changed significantly

**Business events are seeded per issuer** — configured as part of issuer setup, not created by marketers. The AI knows which events are available and references them in wave proposals.

**Combined intelligence:** "2,340 customers clicked the SMS link AND 180 of those also had a spend spike in the last 48 hours — these are your highest intent segment."

This is the differentiator. Generic marketing platforms (MoEngage, CleverTap) only see engagement events. We see financial behavior + engagement, enabling waves that no other platform can propose.

### Event Data Model

**For demo/local:** Manually uploaded CSV or marketer types results into chat.
**For production:** Webhook/API ingestion from card processor + messaging platform.

```
customer_id | campaign_id | wave | event_type    | timestamp           | metadata
C001        | camp-123    | 1    | sms_delivered | 2026-03-27 10:15:00 | {}
C001        | camp-123    | 1    | sms_opened    | 2026-03-27 10:22:00 | {}
C001        | camp-123    | 1    | emi_converted | 2026-03-27 14:30:00 | {amount: 45000}
```

---

## Versioning

### Per-wave versioning
Each wave has its own version history. Modifying Wave 1 copy bumps Wave 1 to v2 — doesn't affect Wave 2 or 3.

```
Campaign: "EMI Conversion Q1"
├── Wave 1 (live, v3)
│   ├── v1: Initial broadcast SMS — Mar 27
│   ├── v2: Changed copy to shorter CTA — Mar 30
│   └── v3: Switched to Push for non-WhatsApp users — Apr 2
├── Wave 2 (live, v2)
│   ├── v1: 3 segments by engagement — Mar 31
│   └── v2: Added "app opener" segment from biz event — Apr 3
└── Wave 3 (draft, v1)
    └── v1: AI proposed refinement — Apr 5
```

### Version rules
- Editing a wave creates a new version
- New version applies to **future customers only** — customers already processed through that wave version are not re-sent
- Version history shows who made the change (AI proposed vs marketer edited)
- Can compare versions side-by-side

---

## Wave Chain Management

### Adding a wave
AI proposes or marketer requests. Inserted at the end of the chain.

### Removing a wave
If Wave 3 is removed:
- Customers currently in Wave 2 will flow to Wave 4 (or exit if Wave 3 was the last)
- Customers already in Wave 3 complete their current step, then exit or flow to Wave 4

### Reordering waves
Not supported for now — waves are strictly sequential in the order created. Removing + re-adding achieves the same effect.

### Pausing a wave
- Customers currently in the wave finish their current step, then hold
- No new customers enter the wave
- Downstream waves also pause (no new entries)
- Upstream waves continue — customers queue up waiting for the paused wave

---

## UI Changes from v1

### Campaign Creation
New choice: **"AI designs strategy"** (v1) vs **"Start broad, refine from engagement"** (v2)

### Workflow Visualizer
v1: Parallel paths shown simultaneously
v2: Waves shown as sequential stages, each expandable to show its strategy (paths/steps)

```
Campaign Pipeline
├── [Wave 1] Broadcast — 10,309 customers — Live (v3)
│   └── [expand to see: 1 path, 1 step, SMS at 10:30 AM]
├── [Wave 2] Engagement Segments — 3 paths — Live (v2)
│   └── [expand to see: High Intent → WhatsApp, Passive → Push, Non-responders → SMS]
├── [Wave 3] Refinement — Draft (v1)
│   └── [expand to see: AI proposal, not yet approved]
└── [+ Add Wave] or [AI suggests next wave]
```

### Campaign View (Live)
- **Pipeline tab** replaces Strategy tab — shows wave chain with status per wave
- **Wave detail** — click a wave to see its strategy, paths, steps (reuses WorkflowVisualizer)
- **Performance tab** — shows per-wave metrics + cumulative funnel
- **Chat** — marketer inputs results, AI proposes wave changes

### Campaign List
- v1 campaigns show "Strategy" type
- v2 campaigns show "Pipeline" type with wave count

---

## Data Model Changes

### Wave model (implemented)
```
model Wave {
  id                  String   @id @default(uuid())
  campaignId          String
  waveNumber          Int
  name                String   @default("")
  status              String   @default("draft") // blueprint, draft, live, paused, completed
  version             Int      @default(1)
  journeyTree         String   @default("[]")    // JSON: JourneyTreeNode[] — full node tree
  templateAssignments String   @default("{}")     // JSON: { nodeId: templateId }
  audienceCount       Int      @default(0)
  blueprint           String   @default("")       // Free text for blueprint waves
  metrics             String   @default("{}")     // JSON: { sent, opened, clicked, converted }
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  campaign Campaign      @relation(fields: [campaignId], references: [id])
  versions WaveVersion[]

  @@unique([campaignId, waveNumber])
}
```

Journey is stored as a JSON blob (`journeyTree`) rather than normalized node/edge tables. AI outputs strategy-level segments + journeys; the server converts to `JourneyTreeNode[]` via `lib/wave-converter.ts` before saving.

### WaveVersion model (implemented)
```
model WaveVersion {
  id               String   @id @default(uuid())
  waveId           String
  version          Int
  initiator        String   // "ai" | "user"
  description      String
  journeySnapshot  String   @default("[]") // JSON: snapshot of journeyTree at this version
  createdAt        DateTime @default(now())

  wave Wave @relation(fields: [waveId], references: [id])

  @@unique([waveId, version])
}
```

### Campaign model additions (implemented)
```
// Added to Campaign:
mode              String   @default("v1")  // "v1" | "v2"
waveBlueprint     String   @default("{}") // JSON: AI's initial wave roadmap
globalExclusions  String   @default("[]") // JSON: segmentId[] for campaign-wide exclusions
waves             Wave[]
```

### Event definition (deferred — not yet in schema)
Planned for v3 when Event Trigger nodes are implemented. Will be seeded per issuer.

---

## AI Prompt Changes for v2 (implemented)

Prompts live in `lib/prompts.ts`. Shared base is reused across v1/v2:

| Export | Used by |
|---|---|
| `DOMAIN_KNOWLEDGE` | Shared — Indian banking context, channels, compliance, exclusions |
| `SHARED_BEHAVIORAL_RULES` | Shared — data exploration rules, tone |
| `V2_PLANNER_SYSTEM_PROMPT` | `wave_creation` mode — wave pipeline with segment/journey output |
| `V2_WAVE_FEEDBACK_CONTEXT` | `wave_feedback` mode — appended when user shares wave results |
| `V2_PLANNER_TOOLS` | Same data tools as v1 + `generate_wave` (instead of `generate_strategies`) |

Key design: AI is told to stay in the **strategy layer** (segments + journeys). It does NOT think in nodes/graphs. The server converts its output to `JourneyTreeNode[]` via `wave-converter.ts`.

---

## Demo Flow

1. Create campaign → choose "Start broad, refine from engagement"
2. AI asks about goal + duration → generates Wave 1 broadcast + blueprint
3. Approve Wave 1 → goes live
4. Type into chat: "Wave 1 results: 23% open rate, 4.2% CTR, 89 EMI conversions"
5. AI proposes Wave 2 with 3 segments
6. Approve Wave 2
7. Type: "Wave 2 running well. High intent segment has 12% conversion. Non-responders still flat."
8. AI proposes: "Modify Wave 2 non-responder segment to switch from SMS to WhatsApp" + "Wave 3: target passive segment with limited-time offer"
9. Approve both → version bumps

This shows: AI intelligence from day 1, progressive learning, continuous optimization, marketer always in control.

---

## Journey Nodes

v2 implements 7 of 9 journey node types. Full spec in `NODE_SPEC.md`.

**v2 nodes:** Segment, Send, Conditional Split, Random Split, Pause, Exit, Goal Exit
**Deferred to v3:** Wait Until (Pause + Conditional Split covers it), Event Trigger (needs real-time infrastructure)

The AI outputs journeys using these 7 nodes. Each wave's journey is a tree of nodes that the visualizer renders using React Flow + dagre.

**v0 prototype** (`smart-nudges-prototype/campaign/pipeline`) has all 9 nodes hardcoded for full vision demos.

## Implementation Status

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Schema (Wave + WaveVersion + Campaign mode)** | DONE | `journeyTree` JSON blob approach, per-wave versioning |
| 2 | **v2 planner prompt** | DONE | Shared base (`DOMAIN_KNOWLEDGE`, `SHARED_BEHAVIORAL_RULES`) + `V2_PLANNER_SYSTEM_PROMPT` + `V2_WAVE_FEEDBACK_CONTEXT` |
| 3 | **Wave converter** | DONE | `lib/wave-converter.ts` — AI strategy output → `JourneyTreeNode[]` |
| 4 | **React Flow visualizer** | DONE | Ported from v0. `components/journey/layout.ts` (tree → flat + dagre), `components/journey/nodes.tsx` (7 node types) |
| 5 | **Wave 1 generation** | DONE | `generate_wave` tool, chat route creates Wave + WaveVersion, runs converter |
| 6 | **Chat route v2 handling** | DONE | `wave_creation` + `wave_feedback` modes in `/api/chat` |
| 7 | **Pipeline sidebar** | DONE | `components/WavePipeline.tsx` — wave list with status |
| 8 | **v1/v2 toggle** | DONE | Campaign `mode` field, mode selection at creation time |
| 9 | **Wave 2+ proposal from chat** | DONE | `wave_feedback` mode, `V2_WAVE_FEEDBACK_CONTEXT` appended |
| 10 | **Per-wave versioning** | Pending | Schema supports it (WaveVersion), UI for edit + version bump not built |
| 11 | **Event definitions** | Pending | Deferred to v3 with Event Trigger node |
| 12 | **Wave chain management (pause/remove/reorder)** | Pending | Spec defined above, not yet implemented |
