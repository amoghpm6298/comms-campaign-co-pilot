import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // --- Issuer ---
  const issuer = await prisma.issuer.upsert({
    where: { slug: "demo-bank" },
    update: {},
    create: {
      name: "Demo Bank",
      slug: "demo-bank",
      config: JSON.stringify({ timezone: "Asia/Kolkata" }),
    },
  });
  console.log(`Issuer: ${issuer.name} (${issuer.id})`);

  // --- User ---
  const passwordHash = await bcrypt.hash("admin123", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@demobank.com" },
    update: {},
    create: {
      email: "admin@demobank.com",
      name: "Amogh P.",
      password: passwordHash,
    },
  });
  console.log(`User: ${user.email} (${user.id})`);

  // --- Second Issuer ---
  const issuer2 = await prisma.issuer.upsert({
    where: { slug: "amaza-bank" },
    update: {},
    create: {
      name: "AmazaBank",
      slug: "amaza-bank",
      config: JSON.stringify({ timezone: "Asia/Kolkata" }),
    },
  });
  console.log(`Issuer: ${issuer2.name} (${issuer2.id})`);

  // --- User-Issuer (Demo Bank) ---
  await prisma.userIssuer.upsert({
    where: { userId_issuerId: { userId: user.id, issuerId: issuer.id } },
    update: {},
    create: {
      userId: user.id,
      issuerId: issuer.id,
      role: "admin",
    },
  });

  // --- User-Issuer (AmazaBank) ---
  await prisma.userIssuer.upsert({
    where: { userId_issuerId: { userId: user.id, issuerId: issuer2.id } },
    update: {},
    create: {
      userId: user.id,
      issuerId: issuer2.id,
      role: "admin",
    },
  });

  // --- Datasets ---
  const datasets = [
    { title: "Customer Master", description: "Card holders with demographics, activation status, and contact details", type: "data", fileName: "customers.csv", fileSize: 5700000, rowCount: 50000, columns: ["customer_id","card_type","issue_date","activation_status","activation_date","credit_limit","phone","email","whatsapp_opted_in","push_enabled","preferred_language"] },
    { title: "Transaction History", description: "6 months of card transactions with MCC categories and merchant details", type: "data", fileName: "transactions.csv", fileSize: 41000000, rowCount: 857587, columns: ["customer_id","txn_date","txn_amount","mcc_category","merchant_name","emi_converted"] },
    { title: "EMI Eligibility", description: "Outstanding amounts, utilization, payment dates, and EMI propensity signals", type: "data", fileName: "emi_eligibility.csv", fileSize: 1800000, rowCount: 50000, columns: ["customer_id","outstanding_amount","current_utilization","min_due","payment_day","days_to_payment","existing_emi_count","past_emi_conversions","emi_eligible","max_emi_tenure"] },
    { title: "NPA List", description: "Non-performing asset flagged customers", type: "exclusion", fileName: "npa_list.csv", fileSize: 34000, rowCount: 1445, columns: ["customer_id","npa_date","npa_category"] },
    { title: "DNC Registry", description: "Do-not-contact registry — TRAI, internal, and customer requests", type: "exclusion", fileName: "dnc_list.csv", fileSize: 109000, rowCount: 3972, columns: ["customer_id","dnc_source","dnc_date"] },
    { title: "Fraud Flagged", description: "Customers flagged for suspicious activity or identity mismatch", type: "exclusion", fileName: "fraud_list.csv", fileSize: 23000, rowCount: 541, columns: ["customer_id","flag_date","fraud_type","severity"] },
    { title: "Cooling Off Period", description: "Customers in RBI-mandated cooling-off after closure or downgrade request", type: "exclusion", fileName: "cooling_off_list.csv", fileSize: 48000, rowCount: 1053, columns: ["customer_id","request_date","request_type","cooling_off_end"] },
    { title: "Recent Complaints", description: "Customers with open or recent complaints", type: "exclusion", fileName: "complaint_list.csv", fileSize: 33000, rowCount: 785, columns: ["customer_id","complaint_date","complaint_type","status"] },
  ];

  for (const ds of datasets) {
    await prisma.dataset.upsert({
      where: { id: `seed-${ds.fileName}` },
      update: {},
      create: {
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
  console.log(`Datasets: ${datasets.length} seeded`);

  // --- Templates ---
  const templates = [
    { title: "EMI Convert Urgency", channel: "SMS", type: "promotional", description: "Urgency-based EMI conversion", body: "{name}, payment due in {days} days. Convert ₹{os_amount} to EMI at 1.2% pm. One-tap convert → {link}", dltTemplateId: "1107161234567890" },
    { title: "EMI Convert Benefit", channel: "SMS", type: "promotional", description: "Benefit-focused EMI conversion", body: "Don't pay full ₹{os_amount}. Split into {tenure}m EMI of just ₹{emi_amount}/month. 0% processing fee → {link}", dltTemplateId: "1107161234567891" },
    { title: "EMI Convert Smart", channel: "SMS", type: "promotional", description: "Smart positioning", body: "Smart move: convert ₹{os_amount} to {tenure}m EMI. Your limit stays intact. Instant approval → {link}", dltTemplateId: "1107161234567892" },
    { title: "EMI Retarget", channel: "WhatsApp", type: "promotional", description: "Retargeting for EMI page visitors", body: "Hey {name}! 👋\n\nYou were checking EMI options for ₹{os_amount}. Good news — we've kept your offer active.\n\n✅ 0% processing fee\n✅ Choose 3/6/9/12 months\n✅ Instant approval\n\nComplete in 30 seconds →" },
    { title: "EMI Welcome", channel: "WhatsApp", type: "promotional", description: "First-time EMI outreach", body: "Hi {name}! 💳\n\nYour outstanding of ₹{os_amount} is eligible for easy EMI conversion.\n\n💰 Pay just ₹{emi_amount}/month\n📅 Choose your tenure\n⚡ One-tap conversion\n\nNo processing fee this month!" },
    { title: "EMI Activation Email", channel: "Email", type: "promotional", description: "Detailed EMI conversion email", body: "Dear {name},\n\nYour credit card has an outstanding balance of ₹{os_amount}. Convert to easy monthly installments.\n\nYour EMI options:\n• 3 months: ₹{emi_3m}/month\n• 6 months: ₹{emi_6m}/month\n• 12 months: ₹{emi_12m}/month", subject: "₹{os_amount} outstanding? Here's a smarter way to pay" },
    { title: "EMI Reminder Push", channel: "Push", type: "promotional", description: "Push notification for EMI reminder", body: "₹{os_amount} due soon. Convert to EMI — ₹{emi_amount}/month →" },
    { title: "EMI Confirmation", channel: "SMS", type: "transactional", description: "Confirmation after EMI conversion", body: "Your EMI conversion is confirmed. ₹{os_amount} converted to {tenure} EMIs of ₹{emi_amount}/month. First EMI on {first_emi_date}.", dltTemplateId: "1107161234567893" },
    { title: "Payment Reminder", channel: "SMS", type: "transactional", description: "EMI payment reminder", body: "Reminder: Your EMI of ₹{emi_amount} is due on {due_date}. Ensure sufficient balance. Pay now → {link}", dltTemplateId: "1107161234567894" },
    { title: "Last Day Offer", channel: "SMS", type: "promotional", description: "Last day urgency", body: "Last day: Convert ₹{os_amount} to EMI with 0% fee. Offer expires tonight. Tap → {link}", dltTemplateId: "1107161234567895" },
  ];

  for (const t of templates) {
    await prisma.template.upsert({
      where: { id: `seed-${t.title.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `seed-${t.title.toLowerCase().replace(/\s+/g, "-")}`,
        issuerId: issuer.id,
        title: t.title,
        channel: t.channel,
        type: t.type,
        description: t.description,
        body: t.body,
        subject: (t as unknown as Record<string, string>).subject || null,
        dltTemplateId: (t as unknown as Record<string, string>).dltTemplateId || null,
        status: "active",
        createdBy: user.id,
      },
    });
  }
  console.log(`Templates: ${templates.length} seeded`);

  console.log("\n✅ Seed complete");
  console.log(`   Login: admin@demobank.com / admin123`);
  console.log(`   Issuer: Demo Bank`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
