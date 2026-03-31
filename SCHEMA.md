# Database Schema

## Overview

```
datasets ──────────┐
                   ├──→ campaign_datasets (join)
templates ─────────┤
                   ├──→ path_templates (join)
campaigns ─────────┤
  ├── strategies   │
  │   └── paths    │
  ├── versions     │
  ├── conversations│
  └── executions   │
```

---

## Tables

### datasets
Uploaded data and exclusion files.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| issuer_id | uuid | FK → issuers (multi-tenant) |
| title | varchar(255) | User-provided name |
| description | text | What this dataset contains |
| type | enum('data', 'exclusion') | Data for targeting, exclusion for filtering |
| file_name | varchar(255) | Original file name |
| file_size | bigint | Bytes |
| file_path | varchar(512) | S3/storage path |
| row_count | int | Computed after processing |
| columns | jsonb | Array of column names + inferred types |
| sample_rows | jsonb | First 10 rows (for AI context) |
| aggregations | jsonb | Pre-computed stats (distributions, counts) |
| status | enum('enabled', 'disabled') | User can toggle |
| processing_status | enum('pending', 'in_progress', 'successful', 'failed') | |
| processing_error | text | Null if successful |
| created_at | timestamp | |
| updated_at | timestamp | |
| created_by | uuid | FK → users |

**Indexes:** issuer_id, type, status, processing_status

---

### templates
Message templates managed by the user.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| issuer_id | uuid | FK → issuers |
| title | varchar(255) | |
| channel | enum('SMS', 'WhatsApp', 'Email', 'Push') | |
| type | enum('promotional', 'transactional', 'otp') | |
| description | text | |
| body | text | Template body with {personalization} tokens |
| subject | varchar(500) | Email only |
| dlt_template_id | varchar(50) | SMS only — TRAI DLT registered ID |
| header_type | enum('text', 'image', 'document') | WhatsApp only |
| cta_text | varchar(100) | WhatsApp only |
| cta_url | varchar(512) | WhatsApp only |
| push_title | varchar(255) | Push only |
| push_image_url | varchar(512) | Push only |
| status | enum('active', 'draft', 'archived') | |
| created_at | timestamp | |
| updated_at | timestamp | |
| created_by | uuid | FK → users |

**Indexes:** issuer_id, channel, type, status

---

### campaigns
Top-level campaign entity.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| issuer_id | uuid | FK → issuers |
| name | varchar(255) | Auto-generated or user-provided |
| goal | text | User's stated goal |
| goal_context | text | Additional context provided |
| status | enum('draft', 'live', 'paused', 'completed', 'archived') | |
| active_strategy_id | uuid | FK → strategies (currently selected) |
| active_version | int | Current version number |
| go_live_at | timestamp | When campaign went live |
| completed_at | timestamp | When campaign ended |
| created_at | timestamp | |
| updated_at | timestamp | |
| created_by | uuid | FK → users |

**Indexes:** issuer_id, status, created_at

---

### campaign_datasets
Many-to-many: which datasets are used in a campaign.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → campaigns |
| dataset_id | uuid | FK → datasets |
| role | enum('data', 'exclusion') | Role in this campaign (may differ from dataset.type) |
| created_at | timestamp | |

**Indexes:** campaign_id, dataset_id
**Unique:** (campaign_id, dataset_id)

---

### strategies
AI-generated strategies for a campaign. A campaign has 2-3 strategies.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → campaigns |
| name | varchar(255) | AI-generated name |
| approach | text | 1-2 sentence description |
| recommended | boolean | AI's recommendation |
| estimated_impact | varchar(255) | e.g., "180-240 conversions" |
| total_reach | int | Reachable after exclusions |
| exclusions | jsonb | { total, npa, dnc, fraud, cooling_off, complaint } |
| analysis | jsonb | AI's data analysis (cohorts, insights) |
| reviewer_fixes | jsonb | Audit log of what reviewer changed (not shown to user) |
| created_at | timestamp | |

**Indexes:** campaign_id, recommended

---

### paths
Individual paths within a strategy. Each path = a parallel segment + action.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| strategy_id | uuid | FK → strategies |
| name | varchar(255) | e.g., "Broad Reach", "High Propensity" |
| reasoning | text | AI's reasoning for this path |
| segment_description | text | Human-readable segment criteria |
| segment_query | jsonb | Machine-readable filter (for execution) |
| segment_size | int | Number of customers in this segment |
| channels | jsonb | Array of channels, e.g., ["SMS", "WhatsApp"] |
| timing | varchar(255) | e.g., "Day 1, 10:15 AM" |
| frequency | varchar(255) | e.g., "Daily × 7", "One-time" |
| evolution | text | How this path adapts over time |
| exit_condition | varchar(255) | When to stop |
| sort_order | int | Display order (left to right) |
| created_at | timestamp | |

**Indexes:** strategy_id, sort_order

---

### template_briefs
AI-suggested template briefs for a path.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| path_id | uuid | FK → paths |
| channel | enum('SMS', 'WhatsApp', 'Email', 'Push') | |
| content | text | Example copy with {tokens} |
| tone | varchar(100) | e.g., "urgency", "benefit", "reminder" |
| sort_order | int | |
| linked_template_id | uuid | FK → templates (null until user assigns) |
| created_at | timestamp | |

**Indexes:** path_id, linked_template_id

---

### campaign_versions
Version history — every change creates a new version.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → campaigns |
| version | int | Sequential (1, 2, 3...) |
| initiator | enum('ai', 'user') | Who triggered the change |
| description | text | What changed |
| strategy_snapshot | jsonb | Full strategy JSON at this point |
| metrics_snapshot | jsonb | Performance metrics at time of change (if live) |
| created_at | timestamp | |

**Indexes:** campaign_id, version
**Unique:** (campaign_id, version)

---

### conversations
Chat history for a campaign.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → campaigns |
| messages | jsonb | Array of { role, content, timestamp } |
| agent_state | jsonb | Internal state (conversation step, pending tool calls) |
| mode | enum('creation', 'feedback', 'live') | Current agent mode |
| updated_at | timestamp | |

**Indexes:** campaign_id
**Unique:** campaign_id (one conversation per campaign)

---

### executions
Scheduled and sent nudges for a live campaign.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → campaigns |
| path_id | uuid | FK → paths |
| template_id | uuid | FK → templates |
| name | varchar(255) | e.g., "High Propensity #3" |
| channel | enum('SMS', 'WhatsApp', 'Email', 'Push') | |
| audience_count | int | Number of customers targeted |
| scheduled_at | timestamp | When to send |
| sent_at | timestamp | When actually sent (null if not yet) |
| status | enum('scheduled', 'sent', 'failed', 'archived') | |
| archived_reason | text | Why archived (e.g., "Path paused in v3") |
| metrics | jsonb | { delivered, opened, clicked, converted } — populated after send |
| created_at | timestamp | |
| updated_at | timestamp | |

**Indexes:** campaign_id, path_id, status, scheduled_at

---

## Multi-tenancy & Auth

All data tables have `issuer_id` for multi-tenant isolation. Every query must filter by `issuer_id`. A user can belong to multiple issuers with different roles.

### issuers
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | varchar(255) | e.g., "IndusInd Bank" |
| slug | varchar(100) | UNIQUE, URL-safe, e.g., "indusind" |
| config | jsonb | Issuer-specific settings |
| created_at | timestamp | |

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email | varchar(255) | UNIQUE |
| name | varchar(255) | |
| password | varchar(255) | bcrypt hashed |
| created_at | timestamp | |

### user_issuers
Many-to-many: user can belong to multiple issuers. Role is per-issuer.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| issuer_id | uuid | FK → issuers |
| role | enum('admin', 'marketer', 'viewer') | Role within this issuer |
| created_at | timestamp | |

**Unique:** (user_id, issuer_id)

### Auth flow
1. User logs in with email + password
2. Backend returns list of issuers the user belongs to
3. User selects an issuer (or auto-selects if only one)
4. All subsequent requests include `issuer_id` in context
5. Sidebar shows issuer selector for users with multiple issuers

### UI: Issuer selector
- Located in left sidebar, above navigation items
- Dropdown showing issuer name + logo
- Switching issuer reloads all data (datasets, templates, campaigns)
- User creation is backend-only (no self-signup for v2.1)

---

## Key Queries

**Get all campaigns for an issuer:**
```sql
SELECT * FROM campaigns WHERE issuer_id = ? ORDER BY created_at DESC;
```

**Get campaign with active strategy + paths:**
```sql
SELECT c.*, s.*, p.*
FROM campaigns c
JOIN strategies s ON s.id = c.active_strategy_id
JOIN paths p ON p.strategy_id = s.id
WHERE c.id = ?
ORDER BY p.sort_order;
```

**Get template briefs with linked templates:**
```sql
SELECT tb.*, t.title as template_title, t.body as template_body
FROM template_briefs tb
LEFT JOIN templates t ON t.id = tb.linked_template_id
WHERE tb.path_id = ?
ORDER BY tb.sort_order;
```

**Check Go Live readiness (all paths have at least one template):**
```sql
SELECT p.id, p.name,
  EXISTS(
    SELECT 1 FROM template_briefs tb
    WHERE tb.path_id = p.id AND tb.linked_template_id IS NOT NULL
  ) as has_template
FROM paths p
WHERE p.strategy_id = ?;
```

**Get execution schedule for live campaign:**
```sql
SELECT e.*, p.name as path_name, t.title as template_title
FROM executions e
JOIN paths p ON p.id = e.path_id
JOIN templates t ON t.id = e.template_id
WHERE e.campaign_id = ?
ORDER BY e.scheduled_at;
```

**Get exclusion counts for a campaign:**
```sql
SELECT d.title, d.row_count
FROM campaign_datasets cd
JOIN datasets d ON d.id = cd.dataset_id
WHERE cd.campaign_id = ? AND cd.role = 'exclusion';
```

---

## Notes

- **jsonb for flexibility**: `analysis`, `exclusions`, `metrics`, `messages`, `columns`, `aggregations` are all jsonb. Avoids schema migrations as the AI output evolves.
- **strategy_snapshot in versions**: Full JSON snapshot, not FK to strategy. This way versions are immutable even if the current strategy changes.
- **segment_query in paths**: Machine-readable filter that the execution engine uses. Separate from `segment_description` which is human-readable.
- **template_briefs.linked_template_id**: Null until user assigns. Go Live checks this.
- **No soft deletes**: Use `status = 'archived'` for datasets, templates, campaigns. Hard delete only for test data.
