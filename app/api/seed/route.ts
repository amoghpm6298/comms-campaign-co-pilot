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
    await prisma.issuer.create({
      data: { name: "AmazaBank", slug: "amaza-bank", config: JSON.stringify({ timezone: "Asia/Kolkata" }) },
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

export const dynamic = 'force-dynamic';
