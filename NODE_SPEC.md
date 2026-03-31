# Journey Node Specification

## Scope

| Node | v2 (build) | v3 (future) | Notes |
|------|:---:|:---:|-------|
| Segment | Yes | | Every wave entry |
| Send | Yes | | Core action |
| Conditional Split | Yes | | Wave segmentation — v2 differentiator |
| Random Split | Yes | | A/B testing — widely used by banks |
| Pause | Yes | | Spacing between touchpoints |
| Exit | Yes | | Terminal with reason for pipeline routing |
| Goal Exit | Yes | | Conversion tracking + auto-exclusion |
| Wait Until | | Yes | Pause + Conditional Split covers it for now |
| Event Trigger | | Yes | Needs real-time event ingestion infrastructure |

**v0 prototype** has all 9 nodes hardcoded for full vision demo.
**v2 build** implements 7 nodes with AI-driven journey generation.

## Node Definitions

| Node | Category | Inputs | Outputs | Description |
|------|----------|--------|---------|-------------|
| **Segment** | Entry | `segmentId`: string, `exclusions?`: segmentId[] (wave-specific, on top of global) | `users[]`, `metadata { count, timestamp }` | Entry point. References a pre-defined segment. Global + optional wave-specific exclusions applied automatically. |
| **Event Trigger** | Entry | `eventType`: string, `eventFilters`: conditions on event data, `issuerId`: string | `users[]`, `metadata { eventType, timestamp }` | Real-time entry. Customer enters when business event fires. Events seeded per issuer. |
| **Send** | Action | `channel`: "SMS" \| "WhatsApp" \| "Email", `templateId`: string, `brief`: string, `dltTemplateId?`: string (SMS only) | `sent_users[]`, `failed_users[]`, `metadata { message_id, timestamp }` | Sends immediately. Use Pause before to control timing. Failed users can be routed separately. |
| **Conditional Split** | Decisioning | `conditionType`: "engagement" \| "attribute" \| "event", `rules`: [{ label, condition }] | Per branch: `users[]`, `metadata { rule_matched }`. Default output: `users[]` (no rule matched) | Instant evaluation. Each customer → exactly one branch. Unmatched → default output. |
| **Random Split** | Experimentation | `splits`: [{ label, percentage }] (e.g., [{ "SMS", 40 }, { "WhatsApp", 40 }, { "Control", 20 }]) | Per split: `users[]`, `metadata { split_label, percentage }` | Random assignment. Control group modeled as a regular split with label "Control" — execution engine skips sending. |
| **Pause** | Flow Control | `duration`: number, `unit`: "hours" \| "days", `startReference`: "after_execution" \| "after_delivery" | `users[]`, `metadata { pause_start, pause_end }` | Fixed wait. Respects global quiet hours. `after_delivery` = pause starts when previous Send delivers, not when triggered. |
| **Wait Until** | Flow Control | `condition`: { type: "event" \| "time", event?: string, time?: string }, `timeout`: { duration, unit }, `checkFrequency?`: { interval, unit } | **Two outputs**: (1) Condition met: `users[]`, `metadata { condition, met_at }` (2) Timeout: `users[]`, `metadata { timed_out_at }` | Waits for action or time. Condition checked at `checkFrequency` intervals. Timeout triggers fallback path. |
| **Exit** | Exit | `reason`: string (e.g., "wave_complete", "exhausted_attempts", "unresponsive") | Terminal — `metadata { reason, exited_at }` | Terminal node. Wave pipeline reads `reason` to decide downstream routing (next wave, drop, etc.). |
| **Goal Exit** | Exit | `goalEvent`: string, `goalCondition?`: filter rules, `evaluationWindow`: { duration, unit } | Terminal — `metadata { goalEvent, achieved_at }` | Customer achieved objective within evaluation window. Exits entire campaign. Counted as conversion. |

## Global Campaign Settings

| Setting | Type | Description |
|---------|------|-------------|
| `globalExclusions` | segmentId[] | NPA, DNC, fraud, cooling-off, complaints. Applied to every wave, every node, automatically. Non-negotiable regulatory exclusions. |
| `quietHours` | { start: "21:00", end: "09:00" } | DLT compliance. Any Send that would fire during quiet hours is delayed to 9AM next day. |
| `goalEvent` | string | Campaign-level conversion goal (e.g., "emi_converted"). Referenced by Goal Exit nodes. |
| `maxWaves` | number (optional) | Safety limit. Campaign auto-pauses after N waves if no goal reached. |

## Exclusion Layers

Exclusions are applied at two levels:

1. **Global (campaign-level):** `globalExclusions` segmentId[]. Applies to every wave, every node. A customer in any global exclusion list never enters any part of the campaign. These are the non-negotiable regulatory exclusions — NPA, DNC, fraud flagged, cooling-off period, recent complaints.

2. **Node-level (Segment node):** `exclusions?` segmentId[]. Additional exclusions specific to that wave's entry, applied on top of global exclusions. Examples:
   - Exclude customers who converted in previous waves
   - Exclude customers already in another active campaign
   - Exclude a specific test cohort

Both layers are cumulative — a customer must pass both global AND node-level exclusion checks to enter a wave.

## Channels

Three supported channels:

| Channel | Cost | Delivery Rate | Notes |
|---------|------|---------------|-------|
| SMS | ₹0.10-0.25 | 95%+ delivery | Requires DLT template ID. Send window 9AM-9PM (quiet hours). |
| WhatsApp | ₹1.09/msg | 98% open rate | Requires opted-in customers. Rich media supported. |
| Email | ₹0.05-0.50 | 20-34% open | Subject line required. No DLT restriction. |

## Pre-defined Condition Types (for Conditional Split)

### Engagement conditions
- `opened` — customer opened previous Send
- `clicked` — customer clicked a link in previous Send
- `converted` — customer completed the goal event
- `not_opened` — customer did not open previous Send
- `not_clicked` — customer opened but did not click

### Attribute conditions
- Any customer field comparison: `utilization > 80%`, `card_type = "platinum"`, `outstanding_amount > 50000`

### Event conditions
- Any business event: `payment_bounce`, `emi_converted`, `card_activated`, `spend_threshold`

## Output Standardization

All node outputs follow a consistent structure:

**Linear nodes** (Segment, Event Trigger, Send, Pause):
```json
{
  "users": ["cust_001", "cust_002", ...],
  "metadata": { ... }
}
```

**Split nodes** (Conditional Split, Random Split, Wait Until):
```json
{
  "branches": [
    { "label": "Clicked", "users": ["cust_001", ...], "metadata": { "rule_matched": "clicked" } },
    { "label": "Not clicked", "users": ["cust_003", ...], "metadata": { "rule_matched": "not_clicked" } }
  ],
  "default": { "users": ["cust_005", ...] }
}
```

**Terminal nodes** (Exit, Goal Exit):
```json
{
  "metadata": { "reason": "wave_complete", "exited_at": "2026-03-30T10:00:00Z" }
}
```
