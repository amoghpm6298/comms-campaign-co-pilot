# Campaign Co-pilot — Project Plan

## Goal

**v2.1 (Production-ready):** User uploads datasets → sets a goal → AI analyzes data, asks clarifying questions, generates strategies → user sees strategies with workflow + template briefs → assigns templates → goes live.

**What works end-to-end:** Dataset CRUD, Template CRUD, Campaign creation via AI, strategy generation with real data, reviewer auto-fix, template assignment, Go Live.

**What's simulated:** Execution (nudge scheduling/sending), Performance metrics.

---

## Team

- You (product + review + testing)
- Claude Code (build everything)

---

## Milestones

### M0: Foundation
**Goal:** Database, project setup, dev environment

| Task |Details |
|---|---|---|
| Set up Postgres database | Local + staging |
| Run schema migrations (all 13 tables) | From SCHEMA.md (including issuers, users, user_issuers) |
| Set up environment variables | ANTHROPIC_API_KEY, DATABASE_URL, MOCK_AI |
| Set up API project structure | /lib/claude.ts, /lib/prompts.ts, /lib/data-service.ts, /lib/tools.ts |
| Simple auth: login with email + password | JWT token, no self-signup. User creation via backend/seed. |
| Issuer selector in sidebar | Dropdown above nav items. Switching reloads all data. |
| Seed: create default issuer + user | e.g., "Demo Bank" issuer, admin user |
| Seed: synthetic datasets under default issuer | 8 datasets (3 data + 5 exclusion) |
| Seed: default templates under default issuer | 10 templates from current dummy data |

**Done when:** `npm run dev` starts, database connects, seed data visible in the app.

---

### M1: Data Service Layer
**Goal:** CSV parsing + tool implementations that query real data

| Task |Details |
|---|---|---|
| CSV upload → parse headers, count rows, store to DB | On upload: parse file, compute columns, row_count, sample_rows |
| Compute aggregations on upload | Basic stats per column (min, max, avg, distribution). Store in datasets.aggregations |
| Implement `get_dataset_schema` tool | Returns columns + 10 sample rows from DB |
| Implement `count_rows` tool | Supports filter expressions (e.g., "activation_status=active AND credit_limit>100000") |
| Implement `get_distribution` tool | Returns bucketed distribution for a column |
| Implement `get_exclusion_summary` tool | Joins exclusion datasets with data datasets on customer_id, returns counts |
| Write test script for all tools | Test each tool against seed data, verify counts match |

**Done when:** All 4 tools return correct data from the database. Test script passes.

**Test:**
```bash
npm run test:data-service
# count_rows(customers, "activation_status=active") → 28486
# get_exclusion_summary() → { npa: 1445, dnc: 3972, ... total_unique: 7401 }
```

---

### M2: Claude API Integration
**Goal:** Planner and Reviewer agents work with tool use

| Task |Details |
|---|---|---|
| Claude API client wrapper | Anthropic SDK, tool use support, error handling, retry |
| Planner agent implementation | System prompt + tools + conversation loop |
| `ask_user` tool implementation | Pauses agent, returns question to chat, resumes on user response |
| `generate_strategies` tool implementation | Parses structured JSON, validates schema |
| Reviewer agent implementation | Takes Planner output, applies fixes, returns updated strategies |
| Server-side transform: paths[] → layers[] | Map AI output to UI schema |
| MOCK_AI mode | Env toggle: returns hardcoded strategies without Claude calls |
| Test: Planner alone via curl | Send goal, verify tool calls + strategy output |
| Test: Reviewer alone via curl | Send strategy, verify fixes applied |
| Test: Full pipeline via curl | Goal → Planner → Reviewer → valid UI-ready JSON |

**Done when:** `curl POST /api/chat` with a goal returns valid strategy JSON with real numbers from the data.

**Test:**
```bash
# Planner test
curl -X POST localhost:3000/api/chat \
  -d '{"datasets":["ds-1","ds-2","ds-3"], "exclusions":["ds-4","ds-5","ds-6","ds-7","ds-8"], "messages":[{"role":"user","content":"Convert OS to EMI"}]}'
# Should return: clarifying questions with real data numbers

# Full pipeline test
# After answering questions → should return strategies with paths[]
```

---

### M3: Chat API Route
**Goal:** Single `/api/chat` endpoint managing full conversation lifecycle

| Task |Details |
|---|---|---|
| Conversation state management | Server-side session store (memory for prototype, DB for production) |
| Route: creation mode | Dataset selection → goal → Planner (with tool calls) → Reviewer → response |
| Route: feedback mode | Selected strategy + user feedback → Planner (modify) → Reviewer → response |
| Route: live mode | Current strategy + user insight → Planner (optimize) → Reviewer → response |
| Session management | Session ID in URL, 30-min TTL, cleanup |
| Error handling | Malformed JSON → retry. Timeout → error message. Reviewer fail → skip review. |

**Done when:** Full conversation works: goal → questions → answers → strategies → feedback → updated strategies.

---

### M4: Wire UI to Real API
**Goal:** v2 campaign page uses real Claude API instead of dummy data

| Task |Details |
|---|---|---|
| Create /campaign/v2/page.tsx | Copy from /campaign/new, replace dummy responses with API calls |
| Dataset selector → sends selected dataset IDs to API | Checkboxes populate API request |
| Chat messages → API calls | Each user message hits /api/chat, response renders in chat |
| Strategy response → renders workflow | Parse strategies JSON, pass paths (as layers) to WorkflowVisualizer |
| Template briefs from API → preview panel | Dynamic briefs, not hardcoded |
| Clarifying questions → chat | AI asks_user → appears as AI message, user responds → continues |
| Loading states | "Analyzing..." → "Building strategies..." → "Reviewing..." |
| Summary bar from real data | Audience, excluded, reachable, impact from API response |

**Done when:** Full flow works in browser with real Claude API calls and real data.

---

### M5: Persistence Layer
**Goal:** Campaigns, strategies, versions saved to database

| Task |Details |
|---|---|---|
| Save campaign on creation | Insert into campaigns, campaign_datasets |
| Save strategies on generation | Insert into strategies, paths, template_briefs |
| Save conversation messages | Update conversations table on each message |
| Template assignment → DB | Update template_briefs.linked_template_id |
| Go Live → update campaign status | Set status='live', go_live_at, create initial executions |
| Version history → DB | Insert into campaign_versions on each change |
| Campaign list from DB | Replace dummy list with DB query |
| Campaign view from DB | Load strategy + paths + executions from DB |
| Dataset CRUD → DB | Replace React state with API calls |
| Template CRUD → DB | Replace React state with API calls |

**Done when:** Refresh the page → data persists. Campaign list shows real campaigns.

---

### M6: Polish + Deploy
**Goal:** Production-ready demo

| Task |Details |
|---|---|---|
| UI polish pass | Spacing, transitions, loading states, error states |
| Edge case handling | Empty datasets, 0 exclusions, very long goals, API timeout |
| Deploy to Railway/Vercel | Database, API, frontend — single deploy |
| Environment setup (staging) | Staging env with seed data |
| Demo rehearsal | Run through full flow, fix any issues |
| Competitive watch check | Quick scan of MoEngage/CleverTap for recent BFSI features |

**Done when:** Sharable URL, full flow works, survives a demo without crashing.

---

## Dependency Graph

```
M0 (Foundation)
 ├── M1 (Data Service)
 │    └── M2 (Claude API) ← needs tools from M1
 │         └── M3 (Chat Route) ← needs agents from M2
 │              └── M4 (Wire UI) ← needs API from M3
 │                   └── M5 (Persistence)
 │                        └── M6 (Polish + Deploy)
 └── M5 can start schema/migrations parallel with M1
```

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Claude returns bad strategies | High | MOCK_AI fallback, manual review before demo |
| Tool call counts are wrong | High | Test data service thoroughly (M1 tests) |
| API timeout (>30s for Planner) | Medium | Streaming partial responses, loading states |
| Reviewer over-modifies strategies | Medium | Conservative prompt, compare before/after in logs |
| Schema changes mid-build | Low | jsonb fields for flexibility, avoid rigid schemas |
| Vercel timeout on free tier | Medium | Use Pro ($20/mo) or Railway |

---

## v2.1 Scope (What's IN vs OUT)

### IN (must work)
- Dataset upload + CRUD + persistence
- Template CRUD + persistence
- Campaign creation via AI chat
- Real data analysis with tool calls
- 2-3 strategies with real numbers
- Reviewer auto-fix (silent)
- Workflow visualization of strategies
- Template brief preview + assignment
- Go Live gating (all paths need templates)
- Campaign list with status
- Version history
- Conversation persistence (survives refresh)

### OUT (simulated or deferred)
- Actual nudge sending / message delivery
- Real-time performance metrics
- Event-based triggers
- Non-Hyperface data connectors
- Multi-user / role-based access (single user for demo)
- Campaign A/B testing
- Automated performance monitoring
