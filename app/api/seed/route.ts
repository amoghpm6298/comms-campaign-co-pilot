import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// GET /api/seed — One-time seed for production
export async function GET() {
  try {
    // Check if already seeded
    const existing = await prisma.issuer.findFirst();
    if (existing) {
      return NextResponse.json({ message: "Already seeded", issuerId: existing.id });
    }

    // Issuer
    const issuer = await prisma.issuer.create({
      data: { name: "Demo Bank", slug: "demo-bank", config: JSON.stringify({ timezone: "Asia/Kolkata" }) },
    });

    // Second issuer
    const axisBank = await prisma.issuer.create({
      data: { name: "Axis Bank", slug: "axis-bank", config: JSON.stringify({ timezone: "Asia/Kolkata" }) },
    });

    // User
    const passwordHash = await bcrypt.hash("admin123", 10);
    const user = await prisma.user.create({
      data: { email: "admin@demobank.com", name: "Amogh P.", password: passwordHash },
    });

    // User-Issuer
    await prisma.userIssuer.create({
      data: { userId: user.id, issuerId: issuer.id, role: "admin" },
    });

    // Datasets
    const datasets = [
      { title: "Customer Master", description: "Card holders with demographics", type: "data", fileName: "customers.csv", fileSize: 5700000, rowCount: 50000, columns: ["customer_id","card_type","issue_date","activation_status","activation_date","credit_limit","phone","email","whatsapp_opted_in","push_enabled","preferred_language"] },
      { title: "Transaction History", description: "6 months of card transactions", type: "data", fileName: "transactions.csv", fileSize: 41000000, rowCount: 857587, columns: ["customer_id","txn_date","txn_amount","mcc_category","merchant_name","emi_converted"] },
      { title: "EMI Eligibility", description: "Outstanding amounts, utilization, EMI signals", type: "data", fileName: "emi_eligibility.csv", fileSize: 1800000, rowCount: 50000, columns: ["customer_id","outstanding_amount","current_utilization","min_due","payment_day","days_to_payment","existing_emi_count","past_emi_conversions","emi_eligible","max_emi_tenure"] },
      { title: "NPA List", description: "Non-performing asset flagged", type: "exclusion", fileName: "npa_list.csv", fileSize: 34000, rowCount: 1445, columns: ["customer_id","npa_date","npa_category"] },
      { title: "DNC Registry", description: "Do-not-contact registry", type: "exclusion", fileName: "dnc_list.csv", fileSize: 109000, rowCount: 3972, columns: ["customer_id","dnc_source","dnc_date"] },
      { title: "Fraud Flagged", description: "Suspicious activity flagged", type: "exclusion", fileName: "fraud_list.csv", fileSize: 23000, rowCount: 541, columns: ["customer_id","flag_date","fraud_type","severity"] },
      { title: "Cooling Off Period", description: "RBI cooling-off after closure", type: "exclusion", fileName: "cooling_off_list.csv", fileSize: 48000, rowCount: 1053, columns: ["customer_id","request_date","request_type","cooling_off_end"] },
      { title: "Recent Complaints", description: "Open or recent complaints", type: "exclusion", fileName: "complaint_list.csv", fileSize: 33000, rowCount: 785, columns: ["customer_id","complaint_date","complaint_type","status"] },
    ];

    for (const ds of datasets) {
      await prisma.dataset.create({
        data: {
          id: `seed-${ds.fileName}`,
          issuerId: issuer.id,
          title: ds.title,
          description: ds.description,
          type: ds.type,
          fileName: ds.fileName,
          fileSize: ds.fileSize,
          rowCount: ds.rowCount,
          columns: JSON.stringify(ds.columns),
          status: "enabled",
          processingStatus: "successful",
          createdBy: user.id,
        },
      });
    }

    // Axis Bank Datasets (own customer file, shared transactions/EMI/exclusions)
    const axisDatasets = [
      { title: "Customer Master", description: "Axis card holders with card tier, demographics", type: "data", fileName: "customers_axis.csv", fileSize: 5700000, rowCount: 50000, columns: ["customer_id","card_type","issue_date","activation_status","activation_date","credit_limit","phone","email","whatsapp_opted_in","push_enabled","preferred_language"] },
      { title: "Transaction History", description: "6 months of card transactions", type: "data", fileName: "transactions.csv", fileSize: 41000000, rowCount: 857587, columns: ["customer_id","txn_date","txn_amount","mcc_category","merchant_name","emi_converted"] },
      { title: "EMI Eligibility", description: "Outstanding amounts, utilization, EMI signals", type: "data", fileName: "emi_eligibility.csv", fileSize: 1800000, rowCount: 50000, columns: ["customer_id","outstanding_amount","current_utilization","min_due","payment_day","days_to_payment","existing_emi_count","past_emi_conversions","emi_eligible","max_emi_tenure"] },
      { title: "NPA List", description: "Non-performing asset flagged", type: "exclusion", fileName: "npa_list.csv", fileSize: 34000, rowCount: 1445, columns: ["customer_id","npa_date","npa_category"] },
      { title: "DNC Registry", description: "Do-not-contact registry", type: "exclusion", fileName: "dnc_list.csv", fileSize: 109000, rowCount: 3972, columns: ["customer_id","dnc_source","dnc_date"] },
      { title: "Fraud Flagged", description: "Suspicious activity flagged", type: "exclusion", fileName: "fraud_list.csv", fileSize: 23000, rowCount: 541, columns: ["customer_id","flag_date","fraud_type","severity"] },
      { title: "Cooling Off Period", description: "RBI cooling-off after closure", type: "exclusion", fileName: "cooling_off_list.csv", fileSize: 48000, rowCount: 1053, columns: ["customer_id","request_date","request_type","cooling_off_end"] },
      { title: "Recent Complaints", description: "Open or recent complaints", type: "exclusion", fileName: "complaint_list.csv", fileSize: 33000, rowCount: 785, columns: ["customer_id","complaint_date","complaint_type","status"] },
    ];

    for (const ds of axisDatasets) {
      await prisma.dataset.create({
        data: {
          id: `axis-seed-${ds.fileName}`,
          issuerId: axisBank.id,
          title: ds.title,
          description: ds.description,
          type: ds.type,
          fileName: ds.fileName,
          fileSize: ds.fileSize,
          rowCount: ds.rowCount,
          columns: JSON.stringify(ds.columns),
          status: "enabled",
          processingStatus: "successful",
          createdBy: user.id,
        },
      });
    }

    // Axis Bank Templates
    const axisTemplates: { title: string; channel: string; type: string; body: string; subject?: string; dltTemplateId?: string }[] = [
      { title: "EMI Convert Urgency", channel: "SMS", type: "promotional", body: "Payment due — convert to EMI", dltTemplateId: "1107161234567890" },
      { title: "EMI Convert Benefit", channel: "SMS", type: "promotional", body: "Split into easy EMI", dltTemplateId: "1107161234567891" },
      { title: "Card Activation Reminder", channel: "SMS", type: "promotional", body: "Activate your new Axis card today", dltTemplateId: "1107161234567896" },
      { title: "EMI Retarget", channel: "WhatsApp", type: "promotional", body: "Complete your EMI conversion" },
      { title: "Festive Spend Nudge", channel: "WhatsApp", type: "promotional", body: "Festive season rewards on your Axis card" },
      { title: "EMI Email", channel: "Email", type: "promotional", body: "Convert outstanding to EMI", subject: "EMI options for your Axis card" },
      { title: "Card Activation Email", channel: "Email", type: "promotional", body: "Welcome to Axis — activate your card", subject: "Your new Axis card is ready" },
    ];

    for (const t of axisTemplates) {
      await prisma.template.create({
        data: {
          issuerId: axisBank.id,
          title: t.title,
          channel: t.channel,
          type: t.type,
          body: t.body,
          subject: t.subject || null,
          dltTemplateId: t.dltTemplateId || null,
          status: "approved",
          createdBy: user.id,
        },
      });
    }

    // Templates
    const templates: { title: string; channel: string; type: string; body: string; subject?: string; dltTemplateId?: string }[] = [
      { title: "EMI Convert Urgency", channel: "SMS", type: "promotional", body: "Payment due — convert to EMI", dltTemplateId: "1107161234567890" },
      { title: "EMI Convert Benefit", channel: "SMS", type: "promotional", body: "Split into easy EMI", dltTemplateId: "1107161234567891" },
      { title: "EMI Retarget", channel: "WhatsApp", type: "promotional", body: "Complete your EMI conversion" },
      { title: "EMI Welcome", channel: "WhatsApp", type: "promotional", body: "Your outstanding is eligible for EMI" },
      { title: "EMI Email", channel: "Email", type: "promotional", body: "Convert outstanding to EMI", subject: "EMI options" },
    ];

    for (const t of templates) {
      await prisma.template.create({
        data: {
          issuerId: issuer.id,
          title: t.title,
          channel: t.channel,
          type: t.type,
          body: t.body,
          subject: t.subject || null,
          dltTemplateId: t.dltTemplateId || null,
          status: "approved",
          createdBy: user.id,
        },
      });
    }

    return NextResponse.json({ message: "Seeded successfully", issuerId: issuer.id, datasets: datasets.length, templates: templates.length });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: "Seed failed", details: String(err) }, { status: 500 });
  }
}

// POST /api/seed — Seed demo campaigns for an issuer
export async function POST(req: Request) {
  try {
    const { issuerId } = await req.json();
    if (!issuerId) return NextResponse.json({ error: "issuerId required" }, { status: 400 });

    const issuer = await prisma.issuer.findUnique({ where: { id: issuerId } });
    if (!issuer) return NextResponse.json({ error: "Issuer not found" }, { status: 404 });

    // ── Campaign 1: Live with 3 waves (2 completed, 1 live) ──
    const c1 = await prisma.campaign.create({
      data: {
        issuerId, name: "Flipkart Axis Card Activation", goal: "Activate new Flipkart Axis Bank cards",
        mode: "v2", status: "live", goLiveAt: new Date("2026-03-20"),
      },
    });
    // Wave 1 — completed with metrics
    const w1_1 = await prisma.wave.create({
      data: {
        campaignId: c1.id, waveNumber: 1, name: "Broad Activation Push", status: "completed", version: 2,
        audienceCount: 4200,
        metrics: JSON.stringify({ sent: 4200, delivered: 3948, opened: 1422, clicked: 687, converted: 312 }),
        journeyTree: JSON.stringify([
          { id: "seg-1", type: "segment", label: "Fresh Inactives (0-15d)", data: { count: 2100, condition: "card_type = 'Flipkart Axis Bank' AND activation_status = 'inactive' AND issue_date >= '2026-03-16'" }, children: ["rsplit-1"] },
          { id: "rsplit-1", type: "random_split", label: "A/B Test: Activation Angle", data: { splits: [{ label: "Cashback Hook", pct: 50 }, { label: "Urgency Hook", pct: 50 }] }, children: ["send-1a", "send-1b"] },
          { id: "send-1a", type: "send", label: "WhatsApp: Cashback Hook", data: { channel: "WhatsApp", timing: "Day 1, 10:00 AM", brief: "Cashback-led — activate and get 5% unlimited cashback on Flipkart, show ₹ amount on a sample ₹5K purchase" }, children: ["pause-1a"] },
          { id: "pause-1a", type: "pause", label: "Wait 24 hours", data: { duration: "24h" }, children: ["send-2a"] },
          { id: "send-2a", type: "send", label: "SMS: Cashback Reminder", data: { channel: "SMS", timing: "Day 2, 6:00 PM", brief: "Reinforce cashback — your ₹500 welcome cashback is waiting, activate in 30 seconds" }, children: ["exit-1a"] },
          { id: "exit-1a", type: "exit", label: "Exit", data: {}, children: [] },
          { id: "send-1b", type: "send", label: "SMS: Urgency Hook", data: { channel: "SMS", timing: "Day 1, 10:00 AM", brief: "Aggressive urgency — your Flipkart Axis card benefits expire in 72 hours, activate now or lose access" }, children: ["pause-1b"] },
          { id: "pause-1b", type: "pause", label: "Wait 24 hours", data: { duration: "24h" }, children: ["send-2b"] },
          { id: "send-2b", type: "send", label: "WhatsApp: Last Chance", data: { channel: "WhatsApp", timing: "Day 2, 11:00 AM", brief: "Visual countdown — 48 hours left, show card benefits they'll miss, one-tap activate button" }, children: ["exit-1b"] },
          { id: "exit-1b", type: "exit", label: "Exit", data: {}, children: [] },
          { id: "seg-2", type: "segment", label: "Stale Inactives (15-45d)", data: { count: 2100, condition: "card_type = 'Flipkart Axis Bank' AND activation_status = 'inactive' AND issue_date < '2026-03-16'" }, children: ["send-3"] },
          { id: "send-3", type: "send", label: "SMS: Direct Activation CTA", data: { channel: "SMS", timing: "Day 1, 11:00 AM", brief: "Aggressive reactivation — your card has been inactive for X days, you've missed ₹Y in cashback, activate now before offer expires" }, children: ["pause-2"] },
          { id: "pause-2", type: "pause", label: "Wait 2 days", data: { duration: "48h" }, children: ["send-4"] },
          { id: "send-4", type: "send", label: "WhatsApp: Visual Benefits", data: { channel: "WhatsApp", timing: "Day 3, 10:00 AM", brief: "Rich media card showcase — top 5 benefits with amounts, exclusive Flipkart sale access, instant activation deeplink" }, children: ["pause-3"] },
          { id: "pause-3", type: "pause", label: "Wait 2 days", data: { duration: "48h" }, children: ["send-5"] },
          { id: "send-5", type: "send", label: "SMS: Final Push", data: { channel: "SMS", timing: "Day 5, 6:00 PM", brief: "Last chance — activation bonus expires tonight, one tap to activate, don't lose your card benefits permanently" }, children: ["exit-2"] },
          { id: "exit-2", type: "exit", label: "Exit", data: {}, children: [] },
        ]),
      },
    });
    // Wave 2 — completed
    const w1_2 = await prisma.wave.create({
      data: {
        campaignId: c1.id, waveNumber: 2, name: "Re-engage Non-Responders", status: "completed", version: 1,
        audienceCount: 2800,
        metrics: JSON.stringify({ sent: 2800, delivered: 2632, opened: 842, clicked: 394, converted: 178 }),
        journeyTree: JSON.stringify([
          { id: "seg-1", type: "segment", label: "WhatsApp Non-Responders", data: { count: 1500, condition: "Received Wave 1 WhatsApp, did not activate" }, children: ["send-1"] },
          { id: "send-1", type: "send", label: "SMS: Direct CTA", data: { channel: "SMS", timing: "Day 1, 11:00 AM", brief: "Short direct SMS — activate now, get ₹200 cashback on first txn" }, children: ["exit-1"] },
          { id: "exit-1", type: "exit", label: "Exit", data: {}, children: [] },
          { id: "seg-2", type: "segment", label: "Email Non-Openers", data: { count: 1300, condition: "Received Wave 1 Email, did not open" }, children: ["send-2"] },
          { id: "send-2", type: "send", label: "WhatsApp: Visual Card Benefits", data: { channel: "WhatsApp", timing: "Day 1, 10:00 AM", brief: "Rich media WhatsApp — card image, top 3 benefits, activate button" }, children: ["exit-2"] },
          { id: "exit-2", type: "exit", label: "Exit", data: {}, children: [] },
        ]),
      },
    });
    // Wave 3 — live
    await prisma.wave.create({
      data: {
        campaignId: c1.id, waveNumber: 3, name: "High-Value Segment Push", status: "live", version: 1,
        audienceCount: 1200,
        metrics: JSON.stringify({ sent: 1200, delivered: 1140 }),
        journeyTree: JSON.stringify([
          { id: "seg-1", type: "segment", label: "High Credit Limit Inactives", data: { count: 1200, condition: "card_type = 'Flipkart Axis Bank' AND activation_status = 'inactive' AND credit_limit >= 200000" }, children: ["send-1"] },
          { id: "send-1", type: "send", label: "WhatsApp: Premium Benefits", data: { channel: "WhatsApp", timing: "Day 1, 10:00 AM", brief: "Premium positioning — highlight higher cashback tier, priority support, exclusive Flipkart sale access" }, children: ["pause-1"] },
          { id: "pause-1", type: "pause", label: "Wait 24 hours", data: { duration: "24h" }, children: ["send-2"] },
          { id: "send-2", type: "send", label: "SMS: Personal Follow-up", data: { channel: "SMS", timing: "Day 2, 12:00 PM", brief: "Personal touch — your premium Flipkart card is waiting, activate for instant rewards" }, children: ["exit-1"] },
          { id: "exit-1", type: "exit", label: "Exit", data: {}, children: [] },
        ]),
      },
    });
    // Conversation — longer, with back-and-forth
    await prisma.conversation.create({
      data: {
        campaignId: c1.id,
        mode: "wave_creation",
        messages: JSON.stringify([
          { role: "user", content: "Activate new Flipkart Axis Bank cards", timestamp: "2026-03-20T09:00:00Z" },
          { role: "assistant", content: "Let me explore your data to understand the Flipkart Axis Bank activation landscape.\n\nHere's what I found:\n- **17,568 total Flipkart Axis Bank cardholders** — your largest co-brand segment\n- **4,200 are currently inactive** (never activated after issuance)\n- Of those, **2,100 were issued in the last 15 days** — these are hot leads\n- Channel reachability: 78% WhatsApp opted-in, 62% push enabled\n- After exclusions (NPA: 82, DNC: 214, Fraud: 31, Cooling-off: 18), reachable audience is **3,873**\n\nI've designed Wave 1 with two segments:\n\n**Fresh Inactives (0-15 days)** — 2,100 customers\n- WhatsApp activation nudge → 48hr wait → SMS urgency follow-up\n- These are warm leads, likely still in the Flipkart buying flow\n\n**Stale Inactives (15-45 days)** — 2,100 customers\n- Email feature showcase → 3 day wait → SMS last chance\n- Need more convincing, leading with card benefits education\n\n**Filter criteria:**\n```\ncard_type = 'Flipkart Axis Bank'\nAND activation_status = 'inactive'\nEXCLUDE: NPA, DNC, Fraud, Cooling-off\n```", timestamp: "2026-03-20T09:01:00Z" },
          { role: "user", content: "can we be more aggressive on the fresh inactives? they just got the card, we should push harder", timestamp: "2026-03-20T09:05:00Z" },
          { role: "assistant", content: "Agreed — fresh inactives have the highest intent. I've updated the journey to be more aggressive:\n\n**Fresh Inactives — Updated:**\n- **Day 1, 10 AM**: WhatsApp with strong cashback hook (5% unlimited on Flipkart)\n- **Day 2, 6 PM**: SMS urgency — \"Your ₹500 welcome cashback expires in 48 hours\"\n- **Day 3, 11 AM**: If still inactive, push notification with one-tap activate deeplink\n\nTighter follow-up cadence — 24hr gaps instead of 48hr. The first 72 hours after card issuance are the activation sweet spot based on industry benchmarks.\n\nUpdated the journey — check the canvas.", timestamp: "2026-03-20T09:06:00Z" },
          { role: "user", content: "Wave 1 done. Results: 312 activations. WhatsApp got 11.2% activation rate, Email path only got 4.8%. SMS follow-ups had best CTR.", timestamp: "2026-03-25T10:00:00Z" },
          { role: "assistant", content: "**312 activations — 7.4% conversion rate.** Strong for activation campaigns.\n\nKey learnings:\n- **WhatsApp dominated** — 11.2% vs Email's 4.8%. Makes sense for a mobile-first audience that got the card through Flipkart's app\n- **SMS follow-ups had best CTR** — short, urgent copy works for this segment\n- Email underperformed likely because stale inactives need a more aggressive push, not education\n\nFor **Wave 2**, I'm targeting the **2,800 non-activators** with channel-swap strategy:\n- WhatsApp non-responders → switch to SMS (direct, short CTA + ₹200 cashback hook)\n- Email non-openers → switch to WhatsApp (rich media card benefits, visual)\n\nDropping email entirely for this audience — data says it doesn't work for Flipkart card activation.", timestamp: "2026-03-25T10:01:00Z" },
          { role: "user", content: "makes sense. Wave 2 got 178 more activations. Total 490. Let's do a final push for high-value inactives only.", timestamp: "2026-03-28T14:00:00Z" },
          { role: "assistant", content: "**490 total activations across 2 waves — 11.7% cumulative conversion.** That's above the 8-10% industry benchmark for co-brand activation.\n\nFor **Wave 3**, narrowing to **high-value inactives only** — credit limit ≥ ₹2L. Found **1,200 customers** matching this criteria.\n\nThese are premium Flipkart users — likely higher income, more to lose by not activating. Going aggressive with premium positioning:\n- WhatsApp: exclusive sale access + higher cashback tier\n- 24hr wait → SMS: personal touch, \"your premium card is waiting\"\n\nThis is your highest-ROI segment — even a 10% activation here means 120 premium cardholders entering the spending funnel.", timestamp: "2026-03-28T14:01:00Z" },
        ]),
      },
    });

    // ── Campaign 2: Draft with 1 wave ──
    const c2 = await prisma.campaign.create({
      data: {
        issuerId, name: "Festive Spend Drive — Ace Cards", goal: "Drive festive spend on Ace cards",
        mode: "v2", status: "draft",
      },
    });
    await prisma.wave.create({
      data: {
        campaignId: c2.id, waveNumber: 1, name: "Festive Activation", status: "draft", version: 1,
        audienceCount: 7800,
        journeyTree: JSON.stringify([
          { id: "seg-1", type: "segment", label: "Active High Spenders", data: { count: 3200, condition: "card_type = 'Ace' AND avg monthly spend > ₹25,000" }, children: ["send-1"] },
          { id: "send-1", type: "send", label: "WhatsApp: Festive Cashback", data: { channel: "WhatsApp", timing: "Day 1, 10:00 AM", brief: "Festive season cashback accelerator — 2x rewards on electronics and fashion this week" }, children: ["pause-1"] },
          { id: "pause-1", type: "pause", label: "Wait 3 days", data: { duration: "72h" }, children: ["send-2"] },
          { id: "send-2", type: "send", label: "Email: Spend Dashboard", data: { channel: "Email", timing: "Day 4, 9:00 AM", brief: "Personal spend dashboard — show festive spend vs last year, reward points earned, unlock next tier" }, children: ["exit-1"] },
          { id: "exit-1", type: "exit", label: "Exit", data: {}, children: [] },
          { id: "seg-2", type: "segment", label: "Low-Frequency Ace Holders", data: { count: 4600, condition: "card_type = 'Ace' AND less than 3 txns in last 30 days" }, children: ["rsplit-1"] },
          { id: "rsplit-1", type: "random_split", label: "A/B Test Messaging", data: { splits: [{ label: "Cashback Angle", pct: 50 }, { label: "FOMO Angle", pct: 50 }] }, children: ["send-3", "send-4"] },
          { id: "send-3", type: "send", label: "SMS: Cashback Angle", data: { channel: "SMS", timing: "Day 1, 11:00 AM", brief: "Cashback-focused — earn 5% back on festive shopping, show ₹ amount they'd earn" }, children: ["exit-2"] },
          { id: "send-4", type: "send", label: "SMS: FOMO Angle", data: { channel: "SMS", timing: "Day 1, 11:00 AM", brief: "FOMO-driven — Ace members spent ₹X crore this festive season, don't miss out" }, children: ["exit-3"] },
          { id: "exit-2", type: "exit", label: "Exit", data: {}, children: [] },
          { id: "exit-3", type: "exit", label: "Exit", data: {}, children: [] },
        ]),
      },
    });
    await prisma.conversation.create({
      data: {
        campaignId: c2.id,
        mode: "wave_creation",
        messages: JSON.stringify([
          { role: "user", content: "Drive festive spend on Ace cards", timestamp: "2026-03-30T14:00:00Z" },
          { role: "assistant", content: "Exploring your Ace cardholder data for festive spend potential.\n\nHere's the landscape:\n- **9,924 total Ace cardholders** — your premium cashback segment\n- **3,200 active high spenders** (avg monthly spend > ₹25K) — already engaged, need a festive multiplier\n- **4,600 low-frequency users** (< 3 txns in last 30 days) — dormant, high reactivation potential\n- **2,124 remaining** are moderate spenders\n- Top MCC categories: online shopping (32%), electronics (22%), dining (18%)\n- Average txn value: ₹4,850 for active, ₹1,200 for low-frequency\n- After exclusions: **7,800 reachable**\n\nI've designed Wave 1 with two distinct strategies:\n\n**Active High Spenders (3,200)** — reward acceleration\n- WhatsApp festive cashback hook → 3 day wait → Email spend dashboard\n- These customers already spend — show them how festive spend earns 2x\n\n**Low-Frequency Holders (4,600)** — A/B test\n- **Test A (50%)**: Cashback angle — \"earn 5% back on festive shopping\"\n- **Test B (50%)**: FOMO angle — \"Ace members spent ₹X crore this season, don't miss out\"\n- Both via SMS for maximum reach\n\nThe A/B will tell us what messaging resonates for reactivation — we'll use the winner in Wave 2.\n\n**Filter criteria:**\n```\ncard_type = 'Ace'\nactive_spenders: avg_monthly_spend > 25000\nlow_freq: txn_count_30d < 3\nEXCLUDE: NPA, DNC, Fraud, Cooling-off, Complaints\n```", timestamp: "2026-03-30T14:01:00Z" },
          { role: "user", content: "love the a/b test. can we also test WhatsApp vs SMS for the high spenders? they might respond better to richer messaging", timestamp: "2026-03-30T14:10:00Z" },
          { role: "assistant", content: "Smart call — high spenders are likely more WhatsApp-active. But we should validate, not assume.\n\nUpdated the high spender segment with a **channel A/B test**:\n- **Test A (50%)**: WhatsApp rich message — festive cashback accelerator with spend category breakdown\n- **Test B (50%)**: SMS — punchy one-liner with cashback amount they'd earn\n\nBoth followed by the Email spend dashboard on Day 4 regardless.\n\nSo now we have **two A/B tests running in parallel** — messaging angle for low-frequency, channel preference for high spenders. Wave 2 will use both winners.\n\nUpdated the journey — take a look.", timestamp: "2026-03-30T14:11:00Z" },
          { role: "user", content: "perfect. should we be more aggressive with the FOMO messaging?", timestamp: "2026-03-30T14:15:00Z" },
          { role: "assistant", content: "Absolutely. For the FOMO variant, I'd push harder:\n\n**Updated FOMO brief:**\n\"Ace members have earned ₹2.3 Cr in cashback this festive season. Your card has earned ₹0. Every day you wait is money left on the table.\"\n\nDirect, slightly provocative. For a cashback card audience, showing the gap between what they *could* earn vs what they *are* earning is the strongest trigger.\n\nThe cashback variant stays benefit-positive. This way we're testing two genuinely different emotional triggers — aspiration vs loss aversion.\n\nBrief updated.", timestamp: "2026-03-30T14:16:00Z" },
        ]),
      },
    });

    // ── Campaign 3: Completed ──
    const c3 = await prisma.campaign.create({
      data: {
        issuerId, name: "EMI Conversion — High Utilization", goal: "Convert outstanding to EMI for high-utilization customers",
        mode: "v2", status: "completed", goLiveAt: new Date("2026-03-10"), completedAt: new Date("2026-03-28"),
      },
    });
    await prisma.wave.create({
      data: {
        campaignId: c3.id, waveNumber: 1, name: "Initial EMI Outreach", status: "completed", version: 1,
        audienceCount: 8500,
        metrics: JSON.stringify({ sent: 8500, delivered: 8075, opened: 3230, clicked: 1534, converted: 612 }),
        journeyTree: JSON.stringify([
          { id: "seg-1", type: "segment", label: "High Utilization + EMI Eligible", data: { count: 5500, condition: "current_utilization > 70% AND emi_eligible = true AND outstanding_amount > 20000" }, children: ["send-1"] },
          { id: "send-1", type: "send", label: "SMS: EMI Urgency", data: { channel: "SMS", timing: "Day 1, 10:00 AM", brief: "Payment due angle — convert ₹X to easy EMI before due date, save on interest" }, children: ["pause-1"] },
          { id: "pause-1", type: "pause", label: "Wait 2 days", data: { duration: "48h" }, children: ["send-2"] },
          { id: "send-2", type: "send", label: "WhatsApp: EMI Calculator", data: { channel: "WhatsApp", timing: "Day 3, 11:00 AM", brief: "Interactive EMI breakdown — show exact monthly amount for 3/6/9/12 month tenures" }, children: ["exit-1"] },
          { id: "exit-1", type: "exit", label: "Exit", data: {}, children: [] },
          { id: "seg-2", type: "segment", label: "Moderate Utilization + Past EMI", data: { count: 3000, condition: "current_utilization 40-70% AND past_emi_conversions > 0" }, children: ["send-3"] },
          { id: "send-3", type: "send", label: "WhatsApp: Repeat EMI", data: { channel: "WhatsApp", timing: "Day 1, 10:00 AM", brief: "Repeat EMI user angle — you've done this before, same easy process, better rates this time" }, children: ["exit-2"] },
          { id: "exit-2", type: "exit", label: "Exit", data: {}, children: [] },
        ]),
      },
    });
    await prisma.wave.create({
      data: {
        campaignId: c3.id, waveNumber: 2, name: "Non-Converter Follow-up", status: "completed", version: 1,
        audienceCount: 5200,
        metrics: JSON.stringify({ sent: 5200, delivered: 4940, opened: 1976, clicked: 890, converted: 423 }),
        journeyTree: JSON.stringify([
          { id: "seg-1", type: "segment", label: "Opened But Didn't Convert", data: { count: 2600, condition: "Opened Wave 1 message, did not convert to EMI" }, children: ["send-1"] },
          { id: "send-1", type: "send", label: "Email: Detailed EMI Benefits", data: { channel: "Email", timing: "Day 1, 9:00 AM", brief: "Detailed comparison — full payment vs EMI, interest saved, credit limit freed up" }, children: ["exit-1"] },
          { id: "exit-1", type: "exit", label: "Exit", data: {}, children: [] },
          { id: "seg-2", type: "segment", label: "Didn't Open Wave 1", data: { count: 2600, condition: "Did not open Wave 1 message" }, children: ["send-2"] },
          { id: "send-2", type: "send", label: "SMS: Simple CTA", data: { channel: "SMS", timing: "Day 1, 6:00 PM", brief: "Short and direct — ₹X outstanding, convert to ₹Y/month, one tap" }, children: ["exit-2"] },
          { id: "exit-2", type: "exit", label: "Exit", data: {}, children: [] },
        ]),
      },
    });
    await prisma.conversation.create({
      data: {
        campaignId: c3.id,
        mode: "wave_feedback",
        messages: JSON.stringify([
          { role: "user", content: "Convert outstanding to EMI for high-utilization customers", timestamp: "2026-03-10T10:00:00Z" },
          { role: "assistant", content: "Analyzing your EMI conversion opportunity across the portfolio.\n\n**Data exploration results:**\n- **50,000 total cardholders** across all tiers\n- **17,710 are EMI eligible** (35.4% of base)\n- **5,500 high-utilization** (>70% utilization + outstanding > ₹20K) — these are under payment pressure, highest conversion potential\n- **3,000 moderate utilization** (40-70%) with past EMI history — proven EMI users, easier conversion\n- Average outstanding in high-util segment: **₹1,42,000**\n- Payment due within 7 days for **2,100** of the high-util segment — urgency window\n- After exclusions: **8,500 reachable** across both segments\n\nWave 1 strategy — **two segments, aggressive on timing:**\n\n**High Utilization + EMI Eligible (5,500)**\n- Day 1, 10 AM: SMS urgency — payment due, convert now, show exact EMI amount\n- Day 3, 11 AM: WhatsApp EMI calculator — interactive breakdown by tenure\n- Leading with SMS because urgency messages need to be short and immediate\n\n**Moderate Utilization + Past EMI Converters (3,000)**\n- Day 1, 10 AM: WhatsApp — \"you've done this before\" repeat user angle\n- Single touch — these users know the flow, don't need hand-holding\n\n**Filter criteria:**\n```\nhigh_util: current_utilization > 70 AND emi_eligible = true AND outstanding_amount > 20000\nmod_util: current_utilization BETWEEN 40 AND 70 AND past_emi_conversions > 0\nEXCLUDE: NPA, DNC, Fraud, Cooling-off\n```", timestamp: "2026-03-10T10:01:00Z" },
          { role: "user", content: "looks good. for the high util segment, can we be more aggressive? these people are about to pay full amount, we need to catch them before that", timestamp: "2026-03-10T10:10:00Z" },
          { role: "assistant", content: "100%. For the **2,100 customers with payment due within 7 days**, we should hit them before they make the full payment.\n\nUpdated high-util journey — **tighter cadence, harder CTA:**\n- **Day 1, 8 AM**: SMS — \"₹1.4L due in 5 days. Why pay full? Convert to ₹12,800/month. One tap →\"\n- **Day 1, 6 PM**: Push notification if push enabled — reinforce with amount saved\n- **Day 2, 11 AM**: WhatsApp with EMI calculator — if they haven't converted yet\n\nFor the remaining 3,400 high-util customers (payment not imminent), keeping the original 2-day cadence.\n\nThe key insight: **payment proximity = urgency = conversion**. The closer they are to the due date, the more aggressive we should be.\n\nUpdated journey on the canvas.", timestamp: "2026-03-10T10:11:00Z" },
          { role: "user", content: "Wave 1 results: 612 conversions from 8,500 sent. SMS urgency got 9.2% conversion, WhatsApp repeat EMI got 5.1%. Non-openers were 48%.", timestamp: "2026-03-22T11:00:00Z" },
          { role: "assistant", content: "**612 conversions — 7.2% overall conversion rate.** Solid.\n\nBreaking it down:\n- **SMS urgency: 9.2% conversion** — the aggressive payment-due messaging worked. Customers respond when you show them the exact amount they can save\n- **WhatsApp repeat EMI: 5.1%** — decent but underperformed vs SMS. Repeat users may prefer the quick SMS format over rich media\n- **48% non-openers** — nearly half didn't engage at all. Big opportunity for Wave 2\n\n**Wave 2 strategy — target the 5,200 non-converters:**\n\n**Opened But Didn't Convert (2,600)**\n- They saw the offer but didn't act → need a different angle\n- Email with detailed comparison: full payment vs EMI, total interest, credit limit impact\n- More information might push them over the edge\n\n**Didn't Open Wave 1 (2,600)**\n- Channel problem, not message problem\n- Switch to SMS with a simpler, more direct CTA\n- Evening send (6 PM) — they might've missed the morning message\n\n**Dropping WhatsApp for repeat EMI users** — data says SMS works better for this audience. No point persisting with an underperforming channel.", timestamp: "2026-03-22T11:01:00Z" },
          { role: "user", content: "Wave 2 got 423 more. Total 1,035 EMI conversions from the campaign. Solid results, lets close this one out.", timestamp: "2026-03-28T09:00:00Z" },
          { role: "assistant", content: "**1,035 total EMI conversions across 2 waves — 7.5% cumulative conversion rate.**\n\nCampaign summary:\n- **Wave 1**: 612 conversions (7.2%) — SMS urgency was the clear winner\n- **Wave 2**: 423 conversions (8.1%) — channel-swap strategy actually *improved* conversion rate\n- **Estimated EMI value**: ~₹14.7 Cr in outstanding converted to EMI (avg ₹1.42L × 1,035)\n\n**Key learnings for future EMI campaigns:**\n1. SMS + urgency outperforms WhatsApp for EMI — keep it short and show the numbers\n2. Payment proximity matters — customers within 7 days of due date convert 2.3x more\n3. Non-openers respond well to channel switch — don't retry the same channel\n4. Repeat EMI users don't need rich media — they know the flow, just give them the CTA\n\nMarking campaign as completed.", timestamp: "2026-03-28T09:01:00Z" },
        ]),
      },
    });

    return NextResponse.json({ message: "Demo campaigns created", campaigns: [c1.id, c2.id, c3.id] });
  } catch (err) {
    console.error("Seed campaigns error:", err);
    return NextResponse.json({ error: "Failed", details: String(err) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
