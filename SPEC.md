# Campaign Co-pilot — Prototype Spec

## What this is
An interactive prototype that demos the full campaign lifecycle: **Understand → Strategize → Configure → Execute (simulated) → Adapt**. Powered by Claude API against uploaded card data. Built for external bank demos.

---

## Design Language

### Approach
Stripe-inspired: minimalist, "show don't tell", bento grid layout, concise text, subtle animation, trust-oriented UI. Applied to Hyperface brand.

### Existing HF Dashboard Patterns (stay consistent)
- **Left sidebar:** White bg, grouped nav sections with chevrons for expandable items. Org switcher at top with HF logo. Collapsible. Outlined icons (not filled).
- **Content area:** White background, generous whitespace. Tab filters for list views (pill-style, blue active state). Status summary cards at top of list views.
- **Create flows:** Left sidebar stepper with progress indicators. Summary/Preview tabs top-right. Step-by-step wizard pattern.
- **Selection cards:** Clean cards with centered icons for type selection (e.g., offer type). Blue/teal highlight for selected.
- **Tables:** Clean, minimal borders. Row-level expand with chevrons. Filter dropdowns + side panel filter drawers.
- **Color usage:** Restrained — mostly white/grey. Blue/teal for interactive. Red for destructive. Green for success/active.
- **Overall:** Functional enterprise SaaS. Not flashy. Trust-oriented.

Campaign Co-pilot should feel like a natural extension of this dashboard, not a separate product. Same sidebar style, same card patterns, same color restraint — but with the addition of AI chat panel and bento-grid data views.

### Brand Colors (from hyperface.co)

| Token | Hex | Usage |
|---|---|---|
| Navy (primary dark) | `#0F1235` | Headings, dark sections, primary buttons |
| Light navy | `#171A42` | Card backgrounds in dark mode |
| Teal/Green (accent) | `#29D9C4` | Primary accent — active states, CTAs, success, highlights |
| Secondary green | `#0FD6BC` | Hover states, secondary accent |
| Purple | `#6B39D7` | Secondary accent — tags, AI-related elements |
| Dark text | `#051C31` | Body headings |
| Grey (body) | `#435565` | Body copy, muted text |
| Ghost white | `#F6F9FC` | Light backgrounds, cards |
| White | `#FFFFFF` | Page background |
| Error red | `#F9553E` | Errors, warnings, exclusion counts |

### Gradients
- Hero/dark sections: `linear-gradient(114deg, #05081E 0%, #060819 93.87%)`
- Card hover: `linear-gradient(329deg, #DBFAF6 11%, #FFFFFF 50%)`
- Accent border: teal-to-purple `linear-gradient(207deg, #10CBBA 0%, transparent 50%, #DBC0FE 100%)`

### Typography
- **Font:** Inter (Google Fonts), weights 400, 500, 600, 700, 800
- **Mono:** SF Mono, Menlo, monospace (for data/code)
- **Scale:** 13px (small/labels), 14px (body secondary), 15px (body), 16px (lead), 18px (h3), 24px (h2), 36px (h1)

### Components
- **Buttons:** Pill-shaped (border-radius 22-32px), 40px height. Primary: navy bg. Secondary: white with teal hover.
- **Cards:** border-radius 16px, subtle shadow `0 1px 3px rgba(0,0,0,0.04)`, ghost-white bg or white
- **Tags/badges:** Pill-shaped, small (10-11px), colored backgrounds at 10% opacity
- **Border:** `rgba(67, 85, 101, 0.2)` — very subtle
- **Shadows:** Light: `0 4px 6px -1px rgba(0,0,0,0.1)`. Heavy (dropdowns): `0 25px 50px -12px rgba(0,0,0,0.25)`
- **Spacing:** 8px grid system

### Interactions
- Subtle hover transitions (0.15-0.2s)
- No heavy animations — functional, not decorative
- Loading states with skeleton screens, not spinners
- AI responses stream in (typewriter effect for recommendations)

---

## Information Architecture

### App Shell (persistent across all views)

```
┌─────────────────────────────────────────────────────────────────┐
│ [HF Logo]  Campaign Co-pilot          [Campaign Name ▾]  [? ]  │
├────────┬────────────────────────────────────────────────────────┤
│        │                                                        │
│  NAV   │                    MAIN CONTENT                        │
│        │                                                        │
│        │                                                        │
│        │                                                        │
│        │                                                        │
│        │                                                        │
│        │                                                        │
│        ├────────────────────────────────────────────────────────┤
│        │              CO-PILOT PANEL (collapsible)              │
└────────┴────────────────────────────────────────────────────────┘
```

### Layout Components

**Top bar (56px height)**
- Left: Hyperface logo + "Campaign Co-pilot" wordmark
- Center: Current campaign name (dropdown to switch campaigns)
- Right: Help / settings

**Left sidebar (240px, collapsible to 64px icons-only)**
- Navigation for the campaign lifecycle steps
- Each step shows completion state (empty, in-progress, done)
- Version history toggle at bottom

**Main content area**
- Changes based on active step
- Max-width 1200px, centered
- Bento grid layout for dashboards, single-column for forms/configs

**Co-pilot panel (bottom, collapsible)**
- Persistent AI chat/feedback interface
- User can type feedback, ask questions, request changes at any step
- AI responses stream in
- Collapsed state: thin bar showing last AI message, click to expand
- Expanded state: 300px height, scrollable conversation

### Left Sidebar Navigation

Follows HF dashboard pattern: grouped sections, outlined icons, chevrons for expandable, completion state per step.

```
┌──────────────────────┐
│  [HF Logo]           │
│  Campaign Co-pilot ▾ │  ← Org/campaign switcher (matches HF pattern)
│                      │
│  Campaign Setup      │  ← Section header (like "Product Setup" in HF)
│    ○ Data Overview   │  ← Empty circle = not started
│    ◉ Goal            │  ← Filled circle = complete
│    ◐ Strategy        │  ← Half circle = in progress
│    ○ Templates       │
│                      │
│  Execution           │  ← Section header (like "Operations" in HF)
│    ○ Campaign        │
│    ○ Results         │
│                      │
│  ─────────────────── │
│    Versions          │  ← Slides open version panel
│    Settings          │  ← Guardrails, channel config
└──────────────────────┘
```

Steps 3-4 (strategy generation + user feedback) are combined in one "Strategy" view — the co-pilot panel handles the feedback/refinement conversation.

### Page Layouts per Step

**Data Overview (bento grid)**
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Total Cards │  Activation  │  Avg Spend   │  Dormancy    │
│    78,420    │    Rate 57%  │  Rs 17,060   │     31%      │
├──────────────┴──────────────┼──────────────┴──────────────┤
│                             │                             │
│   Spend Distribution        │   Utilization Breakdown     │
│   (bar chart by month)      │   (histogram)               │
│                             │                             │
├─────────────────────────────┼─────────────────────────────┤
│                             │                             │
│   Lifecycle Segments        │   AI Insights               │
│   (heatmap / treemap)       │   • "42% cards not active"  │
│                             │   • "Spend declining 13%"   │
│                             │   • "18K eligible for EMI"  │
└─────────────────────────────┴─────────────────────────────┘
```

**Goal (centered, minimal)**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│            What do you want to achieve?                     │
│                                                             │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│   │ Activate │ │ Increase │ │ Convert  │ │ Reduce   │     │
│   │  Cards   │ │  Spend   │ │  to EMI  │ │ Dormancy │     │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│   ┌──────────┐ ┌──────────┐                                │
│   │ Cross-   │ │  Custom  │                                │
│   │  sell    │ │  Goal    │                                │
│   └──────────┘ └──────────┘                                │
│                                                             │
│   Add context (optional):                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ "Payment cycle is 5th, prefer SMS, festival next wk"│   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   → Relevant data slice appears below after selection       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Strategy (side-by-side plans)**
```
┌─────────────────────────────────────────────────────────────┐
│  AI generated 3 experiment plans                            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Plan A      │  │  Plan B      │  │  Plan C      │       │
│  │  Aggressive  │  │  Conservative│  │  Progressive │       │
│  │             │  │             │  │             │        │
│  │  3 layers   │  │  1 layer    │  │  Starts B,  │        │
│  │  18K reach  │  │  6K reach   │  │  expands to │        │
│  │  SMS+WA     │  │  SMS only   │  │  A if >X%   │        │
│  │             │  │             │  │             │        │
│  │  Guardrails:│  │  Guardrails:│  │  Guardrails:│        │
│  │  -2,400 excl│  │  -800 excl  │  │  -2,400 excl│        │
│  │             │  │             │  │             │        │
│  │ [Select]    │  │ [Select]    │  │ [Select]    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Compare plans side by side                [Compare] │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

Selected plan expands into detail view:
┌─────────────────────────────────────────────────────────────┐
│  Plan A — Aggressive                          [v1] [Edit]   │
│                                                             │
│  Layer 1: Generic hook                                      │
│  ├─ Segment: OS > 10K (12,400 reachable)                   │
│  ├─ Channel: SMS + WhatsApp                                 │
│  ├─ Timing: Day 1, 10:15 AM + 3:45 PM                     │
│  └─ Evolution: one-time, no repeat                          │
│                                                             │
│  Layer 2: Smart targeting                                   │
│  ├─ Segment: Utilization >80% + Payment <7d (4,200)        │
│  ├─ Channel: SMS                                            │
│  ├─ Timing: Daily, 1:00 PM                                 │
│  ├─ Templates: 8 variants, rotating by performance          │
│  └─ Evolution: drop bottom 3 templates after day 5          │
│                                                             │
│  Layer 3: Retargeting                                       │
│  ├─ Segment: Landed on EMI journey, didn't complete         │
│  ├─ Channel: WhatsApp                                       │
│  ├─ Timing: EOD same day                                    │
│  └─ Evolution: stop after 2 attempts per user               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Campaign / Simulation**
```
┌─────────────────────────────────────────────────────────────┐
│  Campaign: EMI Conversion Q1          [v3]  ▶ Running       │
│                                                             │
│  ┌─ Simulation Controls ──────────────────────────────────┐ │
│  │ [+1 day] [+3 days] [+7 days]    [Override metrics ▾]  │ │
│  │ [Trigger: Festival] [Trigger: Competitor]   [Reset]    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Day 5 of campaign                                          │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │  Sent        │  Delivered   │  Converted    │            │
│  │  24,600      │  23,100      │  1,840        │            │
│  ├──────────────┴──────────────┴──────────────┤            │
│  │                                             │            │
│  │   Per-branch metrics (table + sparklines)   │            │
│  │   Layer 1: 12.4K sent, 4.2% CTR            │            │
│  │   Layer 2: 8.1K sent, 6.8% CTR ⬆           │            │
│  │   Layer 3: 4.1K sent, 8.1% CTR ⬆⬆          │            │
│  │                                             │            │
│  ├─────────────────────────────────────────────┤            │
│  │                                             │            │
│  │   Channel breakdown (SMS vs WA bar chart)   │            │
│  │                                             │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  ┌─ AI Recommendation ────────────────────────────────────┐ │
│  │ "Layer 2 outperforming Layer 1 by 62%. Recommend:      │ │
│  │  → Shift 40% of Layer 1 budget to Layer 2              │ │
│  │  → Drop templates 4, 6, 8 (below 2% CTR)              │ │
│  │  → Test WhatsApp for Layer 2 (SMS saturating)"         │ │
│  │                                                        │ │
│  │  [Approve] [Modify] [Reject]                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Results / Attribution**
```
┌─────────────────────────────────────────────────────────────┐
│  Campaign Results — EMI Conversion Q1                       │
│                                                             │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ Incr.    │ Incr.    │ Cost per │   ROI    │             │
│  │ Converts │ Revenue  │ Convert  │          │             │
│  │  3,200   │ Rs 4.8Cr │  Rs 47   │   22x    │             │
│  ├──────────┴──────────┴──────────┴──────────┤             │
│  │                                            │             │
│  │   Nudge group vs Control group             │             │
│  │   (side-by-side bar chart)                 │             │
│  │                                            │             │
│  ├────────────────────────────────────────────┤             │
│  │                                            │             │
│  │   Version journey: v1 → v2 → v3           │             │
│  │   "v1 projected Rs 2.1Cr, final v3        │             │
│  │    achieved Rs 4.8Cr — 129% improvement    │             │
│  │    from AI optimization"                   │             │
│  │                                            │             │
│  ├────────────────────────────────────────────┤             │
│  │                                            │             │
│  │   Top learnings (AI-generated):            │             │
│  │   • SMS morning > afternoon by 2.3x       │             │
│  │   • High-util segment converted 3x better │             │
│  │   • Template 3 was top performer           │             │
│  │                                            │             │
│  └────────────────────────────────────────────┘             │
│                                                             │
│  [Export Report]  [Create Similar Campaign]                  │
└─────────────────────────────────────────────────────────────┘
```

### Version History Panel (slides in from right)
```
┌──────────────────────────┐
│  Version History          │
│                          │
│  ● v3 — Day 5           │
│  │ AI: Shifted budget    │
│  │ to Layer 2, dropped   │
│  │ 3 templates           │
│  │ [View] [Diff] [Revert]│
│  │                       │
│  ● v2 — Day 0           │
│  │ User: Changed to      │
│  │ SMS only for Layer 2  │
│  │ [View] [Diff] [Revert]│
│  │                       │
│  ● v1 — Day 0           │
│  │ AI: Initial strategy  │
│  │ generated             │
│  │ [View]                │
│                          │
└──────────────────────────┘
```

### Co-pilot Panel (bottom, persistent)
```
┌─────────────────────────────────────────────────────────────┐
│  ▴ Co-pilot                                                 │
│  ─────────────────────────────────────────────────────────  │
│  AI: Based on your data, high-utilization customers near    │
│      payment date are your best EMI conversion target...    │
│                                                             │
│  You: make layer 2 SMS only, we want to keep costs low      │
│                                                             │
│  AI: Updated. Layer 2 now SMS-only. This reduces reach by   │
│      ~12% but cuts channel cost by 60%. New projection...   │
│                                                             │
│  ┌─────────────────────────────────────────────────── [Send]│
│  │ Type feedback, ask questions, or request changes...      │
│  └──────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────┘
```

---

## Core Flow

### Step 1: Upload & Understand
**What happens:** User uploads a CSV with card/transaction data. AI ingests, auto-detects fields, and presents a financial health overview.

**UI:**
- Drag-and-drop upload area
- Field mapping screen (auto-detected, user can correct)
- **Financial health dashboard** (bento grid layout):
  - Total cards, activation rate, avg spend, dormancy %
  - Spend distribution chart
  - Utilization breakdown
  - Segment heatmap (lifecycle stage × card type)
- This is the "aha" moment — bank sees their data understood instantly

**AI role:** Detect field types, calculate financial metrics, surface top 3-4 insights ("42% of your cards issued in last 90 days haven't activated — that's Rs 1.2Cr in wasted CAC")

### Step 2: Set Goal
**What happens:** User picks a business objective.

**UI:**
- Goal cards: Activate, Increase Spend, Convert to EMI, Reduce Dormancy, Cross-sell, Custom
- Optional context input: free text ("our payment cycle is 5th of month", "we prefer SMS for cost reasons", "festival season starts next week")
- AI acknowledges goal + context, shows relevant data slice

**AI role:** Filter and highlight data relevant to chosen goal. "For EMI conversion: 18,400 customers have OS > 10K. Here's how they distribute by utilization, payment proximity, and spend patterns."

### Step 3: AI Strategy Generation
**What happens:** AI analyzes the data against the goal and generates 2-3 experiment plans.

**UI:**
- 2-3 strategy cards side by side, each showing:
  - Strategy name and approach summary
  - Segment breakdown with sizes
  - Channel recommendation with reasoning
  - Timing/frequency plan
  - Branch logic (if X then Y)
  - **Guardrail exclusions shown**: "Total eligible: 18,400 → After exclusions (NPA: 800, DNC: 1,200, fraud: 140, cooling-off: 260): **16,000 reachable**"
  - Estimated impact range
- Compare view — differences highlighted
- Each plan shows how it will **evolve**: "After day 3, if WhatsApp CTR > X%, shift volume..."

**AI role:** This is the core AI work. Analyze data patterns, generate segment logic, recommend channels based on data distribution, propose timing based on behavioral patterns, design experiment branches with evolution criteria.

### Step 4: User Feedback & Refinement
**What happens:** User selects a plan, provides feedback, AI adjusts.

**UI:**
- Selected plan expands into editable detail view
- Chat/feedback panel: user can type "make it SMS only" or "add a layer for high-value customers" or "I want to test morning vs evening"
- AI updates the plan in real-time
- **Version created**: v1 → v2 with diff view (what changed and why)

**AI role:** Interpret feedback, adjust strategy, regenerate affected branches, update exclusion counts, recalculate projections.

### Step 5: Template Configuration
**What happens:** User reviews and edits message templates for each branch.

**UI:**
- Templates grouped by branch/layer
- For each template: channel badge (SMS/WhatsApp/Push), preview, character count, DLT compliance indicator
- Edit inline
- AI can suggest template copy if asked

**AI role:** Optional — generate template suggestions based on goal, segment, and channel constraints (DLT character limits etc.)

### Step 6: Campaign Launch → Simulation Mode
**What happens:** User "starts" the campaign. Enters simulation mode.

**UI:**
- Campaign status dashboard
- **Simulation controls:**
  - `Advance X days` button (1, 3, 7 days)
  - Metric override sliders: open rate, CTR, conversion rate (per branch)
  - Event triggers: "competitor launched similar campaign", "festival started", "RBI policy change"
  - Reset button
- **Live metrics panel:**
  - Per-branch: sent, delivered, opened, clicked, converted
  - Guardrail exclusions running total
  - Cost tracker (per channel)
  - Conversion funnel visualization

**AI role:** Not active yet — waiting for metrics to accumulate.

### Step 7: AI Adaptive Recommendations
**What happens:** After user advances time, AI analyzes simulated metrics and suggests campaign adjustments.

**UI:**
- AI recommendation card appears: "Based on 3-day performance..."
  - What's working, what's not (with data)
  - Specific changes recommended
  - Projected impact of changes
- User can: Approve (creates new version), Modify (chat with AI to adjust), Reject (keep current), or manually edit the campaign
- **Version history sidebar:** v1 → v2 → v3 with diffs — what changed, why, who decided (AI suggested vs user changed)

**AI role:** Analyze metrics, identify winners/losers, generate specific adjustment recommendations with reasoning, project impact of changes.

### Step 8: Attribution View
**What happens:** At the end of simulation, show the financial impact.

**UI:**
- Summary dashboard:
  - Nudge group vs control group comparison
  - Incremental conversions (activations, EMI conversions, etc.)
  - Incremental spend in Rs
  - Cost per incremental conversion
  - ROI calculation
- Version comparison: "v1 would have achieved X, final v3 achieved Y — AI optimization improved results by Z%"
- Exportable report

---

## Versioning System

Every campaign change creates a new version:
- **v1:** Initial AI-generated strategy
- **v2:** After user feedback/refinement
- **v3:** After first AI adaptive recommendation
- **v4+:** Subsequent adaptations

Each version stores:
- Full campaign config (segments, channels, timing, templates, guardrails)
- What changed from previous version
- Who initiated the change (AI recommendation vs user edit)
- Metrics at time of change (for adaptive versions)
- Rollback capability

UI: version timeline sidebar, click any version to see its state, diff view between any two versions.

---

## Guardrails (always visible)

Exclusions applied automatically at every step:
- NPA / delinquent
- DNC registry
- Fraud-flagged
- Cooling-off period
- Recent complaint

Shown as a persistent bar/badge wherever segment sizes appear:
> Total eligible: 18,400 → Excluded: 2,400 (NPA: 800, DNC: 1,200, fraud: 140, cooling-off: 260) → **Reachable: 16,000**

User can click to see breakdown. Override requires explicit approval (logged in version history).

---

## Synthetic Dataset

~50-80K cards, 6 months of transaction history:

| Field | Type | Distribution |
|---|---|---|
| card_id | string | Unique |
| issue_date | date | Spread over 12 months |
| activation_status | boolean | 57% activated (industry avg) |
| activation_date | date | Null for inactive |
| card_type | enum | Classic/Gold/Platinum/Business |
| credit_limit | number | 25K-10L, skewed toward 50K-2L |
| current_utilization | percentage | 0-100%, clustered around 30-40% and 75-85% |
| outstanding_amount | number | Derived from utilization × limit |
| last_transaction_date | date | Spread, with dormancy clusters |
| monthly_spend (6 months) | number[] | With seasonal patterns (Oct-Nov spike) |
| mcc_categories | string[] | Dining, fuel, grocery, travel, online, utilities |
| payment_date | number | Day of month (clustered around 1st, 5th, 15th) |
| days_to_payment | number | Derived |
| emi_count | number | 0-5 |
| channel_preference | enum | SMS/WhatsApp/Push/Email |
| npa_flag | boolean | ~3% |
| dnc_flag | boolean | ~8% |
| fraud_flag | boolean | ~1% |
| cooling_off | boolean | ~2% |
| complaint_recent | boolean | ~1.5% |

---

## Tech Stack

- **Frontend:** HTML/CSS/JS (or React if preferred) — Stripe-inspired design
- **Backend:** Python (Flask/FastAPI) or Node — lightweight
- **AI:** Claude API (claude-sonnet-4-6 for speed, claude-opus-4-6 for complex strategy generation)
- **Data:** CSV upload → parsed in-memory (pandas/similar)
- **Charts:** Chart.js or D3 (lightweight)
- **No database needed** — prototype runs in-memory per session

---

## Scope: Core vs Deferred

Everything is architected to support the full version. Deferred items are stubbed/simplified, not skipped — so they can be built out without refactoring.

### Core (ship in v1)
- CSV upload + auto field detection + field mapping
- Financial health dashboard with charts
- Goal selection (preset goals: Activate, Increase Spend, Convert to EMI, Reduce Dormancy, Cross-sell)
- AI strategy generation (real Claude API, 2-3 plans)
- Co-pilot chat panel for feedback/refinement
- Basic template view (pre-configured templates, inline edit)
- Simulation with advance days + AI adaptive recommendations
- Attribution summary view
- Version list with state tracking
- Guardrail exclusions visible at every step

### Deferred (stubbed, build out later)
- **Upload:** Drag-and-drop animation, multi-file support, SFTP/API ingestion
- **Dashboard:** Complex chart interactions (drill-down, cross-filtering), exportable charts
- **Goal:** Custom goal with free-form input (currently preset only)
- **Strategy:** Side-by-side compare view for plans, visual branch editor
- **Co-pilot:** Streaming typewriter effect for AI responses, message history persistence
- **Templates:** Full template builder with DLT character counter, multi-language, preview per channel
- **Simulation:** Metric override sliders, event triggers ("competitor launched", "festival started"), per-branch metric editing
- **Adaptation:** Complex branching updates (currently AI suggests, user approves/rejects — no partial branch edits)
- **Attribution:** Exportable PDF report, version comparison chart ("v1 would have achieved X, v3 achieved Y")
- **Versioning:** Visual diff view between versions, rollback with confirmation, who-changed-what audit
- **General:** Mobile responsive, dark mode, skeleton loading states, error boundaries

### Out of scope (not building)
- Actual message sending/triggering
- Real-time data ingestion from live systems
- User authentication / multi-user / roles
- Non-Hyperface data connectors
- Database persistence (prototype runs in-memory per session)

---

## Logo
![Hyperface](../HF.png)
Use Hyperface logo (HF.png) in top-left nav. Product name: **Campaign Co-pilot**.
