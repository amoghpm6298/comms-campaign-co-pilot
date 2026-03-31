"""
Generate exclusion CSVs from the customers.csv flags.
Also prints summary stats.
"""

import csv
from datetime import date, timedelta
import random

random.seed(42)

DATA_DIR = "/Users/amoghpachpor/Documents/Claude/nudges/marketing-automation/smart-nudges-prototype/data"

# Read customers
customers = []
with open(f"{DATA_DIR}/customers.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        customers.append(row)

print(f"Total customers: {len(customers)}")

# Extract exclusion lists
exclusion_types = {
    "npa": {"flag": "npa_flag", "title": "NPA List"},
    "dnc": {"flag": "dnc_flag", "title": "DNC Registry"},
    "fraud": {"flag": "fraud_flag", "title": "Fraud Flagged"},
    "cooling_off": {"flag": "cooling_off", "title": "Cooling Off Period"},
    "complaint": {"flag": "complaint_recent", "title": "Recent Complaints"},
}

ref_date = date(2026, 3, 24)

for key, config in exclusion_types.items():
    flagged = [c for c in customers if c[config["flag"]].lower() == "true"]

    rows = []
    for c in flagged:
        row = {"customer_id": c["customer_id"]}

        if key == "npa":
            days_ago = random.randint(30, 180)
            row["npa_date"] = str(ref_date - timedelta(days=days_ago))
            row["npa_category"] = random.choice(["SMA-1", "SMA-2", "NPA", "NPA"])
        elif key == "dnc":
            row["dnc_source"] = random.choice(["TRAI", "TRAI", "Internal", "Customer Request"])
            days_ago = random.randint(10, 365)
            row["dnc_date"] = str(ref_date - timedelta(days=days_ago))
        elif key == "fraud":
            row["flag_date"] = str(ref_date - timedelta(days=random.randint(5, 90)))
            row["fraud_type"] = random.choice(["Suspicious Transaction", "Identity Mismatch", "Disputed Charge", "Account Takeover"])
            row["severity"] = random.choice(["high", "high", "medium", "critical"])
        elif key == "cooling_off":
            row["request_date"] = str(ref_date - timedelta(days=random.randint(1, 25)))
            row["request_type"] = random.choice(["Closure Request", "Downgrade Request", "Closure Request"])
            row["cooling_off_end"] = str(ref_date + timedelta(days=random.randint(5, 30)))
        elif key == "complaint":
            row["complaint_date"] = str(ref_date - timedelta(days=random.randint(1, 14)))
            row["complaint_type"] = random.choice(["Service Issue", "Billing Dispute", "Unauthorized Charge", "Fee Complaint"])
            row["status"] = random.choice(["Open", "Open", "Under Review", "Resolved"])

        rows.append(row)

    if rows:
        filename = f"{DATA_DIR}/{key}_list.csv"
        with open(filename, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print(f"{key}_list.csv: {len(rows)} rows")
    else:
        print(f"{key}: 0 flagged customers, skipped")

# Summary
print("\n--- Exclusion Summary ---")
total_excluded_ids = set()
for key, config in exclusion_types.items():
    flagged = [c["customer_id"] for c in customers if c[config["flag"]].lower() == "true"]
    total_excluded_ids.update(flagged)
    print(f"  {config['title']}: {len(flagged)}")
print(f"  Total unique excluded: {len(total_excluded_ids)}")
