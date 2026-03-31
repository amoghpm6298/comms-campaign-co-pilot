"""
Dataset Generator for Campaign Co-pilot
========================================
Generates synthetic CSV datasets for any card issuer.

Usage:
  python scripts/generate-data.py                          # Default config (Demo Bank)
  python scripts/generate-data.py --config axis            # Axis Bank preset
  python scripts/generate-data.py --config custom.json     # Custom config file

Output: data/ directory with all CSVs
"""

import csv
import random
import json
import sys
import os
from datetime import datetime, timedelta

# ──────────────────────────────────────────────────────────────
# PRESETS — add new issuers here
# ──────────────────────────────────────────────────────────────

PRESETS = {
    "demo": {
        "name": "Demo Bank",
        "output_prefix": "",  # customers.csv
        "num_customers": 50000,
        "card_types": {
            "Classic": 0.40,
            "Gold": 0.35,
            "Platinum": 0.20,
            "Business": 0.05,
        },
        "credit_limits": {
            "Classic": (25000, 150000),
            "Gold": (100000, 400000),
            "Platinum": (200000, 750000),
            "Business": (300000, 1000000),
        },
    },
    "axis": {
        "name": "Axis Bank",
        "output_prefix": "_axis",  # customers_axis.csv
        "num_customers": 50000,
        "card_types": {
            "MY Zone": 0.40,
            "Flipkart Axis Bank": 0.35,
            "Ace": 0.20,
            "Privilege": 0.025,
            "Magnus": 0.025,
        },
        "credit_limits": {
            "MY Zone": (25000, 150000),
            "Flipkart Axis Bank": (50000, 300000),
            "Ace": (150000, 500000),
            "Privilege": (300000, 750000),
            "Magnus": (500000, 1000000),
        },
    },
}

# ──────────────────────────────────────────────────────────────
# SHARED CONSTANTS
# ──────────────────────────────────────────────────────────────

LANGUAGES = {"en": 0.65, "hi": 0.25, "ta": 0.04, "mr": 0.03, "te": 0.03}

MCC_CATEGORIES = {
    "grocery": 0.25,
    "online_shopping": 0.20,
    "fuel": 0.15,
    "dining": 0.15,
    "electronics": 0.10,
    "travel": 0.08,
    "utilities": 0.05,
    "others": 0.02,
}

MERCHANTS = {
    "grocery": ["DMart", "BigBazaar", "Reliance Fresh", "Spencer's", "More Megastore", "Nature's Basket", "Star Bazaar"],
    "online_shopping": ["Amazon", "Flipkart", "Myntra", "Ajio", "Nykaa", "Tata Cliq", "Meesho"],
    "fuel": ["Indian Oil", "HP Petroleum", "Bharat Petroleum", "Shell", "Nayara Energy"],
    "dining": ["Zomato", "Swiggy", "Dominos", "McDonalds", "Pizza Hut", "Barbeque Nation", "Haldirams"],
    "electronics": ["Croma", "Reliance Digital", "Vijay Sales", "Samsung Store", "Apple Store"],
    "travel": ["MakeMyTrip", "Goibibo", "IRCTC", "Cleartrip", "Yatra", "EaseMyTrip"],
    "utilities": ["Jio Recharge", "Airtel Recharge", "BESCOM", "Tata Power", "Mahanagar Gas"],
    "others": ["BookMyShow", "Decathlon", "Lenskart", "Apollo Pharmacy", "Urban Company"],
}

TXN_AMOUNT_RANGES = {
    "grocery": (200, 8000),
    "online_shopping": (300, 30000),
    "fuel": (500, 5000),
    "dining": (200, 8000),
    "electronics": (1000, 150000),
    "travel": (2000, 100000),
    "utilities": (200, 5000),
    "others": (100, 15000),
}

NPA_CATEGORIES = {"SMA-1": 0.23, "SMA-2": 0.24, "NPA": 0.53}
DNC_SOURCES = {"TRAI": 0.51, "Customer Request": 0.25, "Internal": 0.24}
FRAUD_TYPES = ["Suspicious Transaction", "Account Takeover", "Identity Mismatch", "Disputed Charge"]
FRAUD_SEVERITIES = {"critical": 0.18, "high": 0.50, "medium": 0.32}
COOLING_OFF_TYPES = {"Closure Request": 0.66, "Downgrade Request": 0.34}
COMPLAINT_TYPES = ["Fee Complaint", "Billing Dispute", "Unauthorized Charge", "Service Issue"]
COMPLAINT_STATUSES = {"Open": 0.50, "Under Review": 0.25, "Resolved": 0.25}


def weighted_choice(options: dict) -> str:
    items = list(options.keys())
    weights = list(options.values())
    return random.choices(items, weights=weights, k=1)[0]


def random_date(start: datetime, end: datetime) -> str:
    delta = (end - start).days
    return (start + timedelta(days=random.randint(0, delta))).strftime("%Y-%m-%d")


def generate_customers(config: dict, data_dir: str) -> list[str]:
    """Generate customers CSV. Returns list of customer IDs."""
    num = config["num_customers"]
    card_types = config["card_types"]
    credit_limits = config["credit_limits"]
    prefix = config.get("output_prefix", "")
    filename = f"customers{prefix}.csv"

    now = datetime(2026, 3, 31)
    issue_start = now - timedelta(days=540)  # ~18 months back

    customer_ids = [f"C{10001 + i}" for i in range(num)]
    rows = []

    for cid in customer_ids:
        card_type = weighted_choice(card_types)
        issue_date = random_date(issue_start, now)
        is_active = random.random() < 0.57
        activation_status = "active" if is_active else "inactive"
        activation_date = ""
        if is_active:
            issue_dt = datetime.strptime(issue_date, "%Y-%m-%d")
            activation_date = random_date(issue_dt, min(issue_dt + timedelta(days=30), now))

        lo, hi = credit_limits[card_type]
        credit_limit = round(random.randint(lo, hi) / 5000) * 5000

        whatsapp = "true" if random.random() < 0.72 else "false"
        push = "true" if random.random() < 0.57 else "false"
        language = weighted_choice(LANGUAGES)

        # Flags (used for quick filtering; actual exclusion lists generated separately)
        rows.append({
            "customer_id": cid,
            "card_type": card_type,
            "issue_date": issue_date,
            "activation_status": activation_status,
            "activation_date": activation_date,
            "credit_limit": credit_limit,
            "phone": f"91XXXXX{random.randint(1000,9999)}",
            "email": f"{cid.lower()}***@gmail.com",
            "whatsapp_opted_in": whatsapp,
            "push_enabled": push,
            "preferred_language": language,
            "npa_flag": "false",
            "dnc_flag": "false",
            "fraud_flag": "false",
            "cooling_off": "false",
            "complaint_recent": "false",
        })

    filepath = os.path.join(data_dir, filename)
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"  {filename}: {len(rows)} customers")
    return customer_ids


def generate_transactions(customer_ids: list[str], data_dir: str, avg_txns_per_customer: int = 17):
    """Generate 6 months of transaction history."""
    now = datetime(2026, 3, 31)
    start = now - timedelta(days=180)

    rows = []
    for cid in customer_ids:
        # Not all customers transact; ~85% have at least one txn
        if random.random() > 0.85:
            continue
        num_txns = max(1, int(random.gauss(avg_txns_per_customer, 8)))
        for _ in range(num_txns):
            mcc = weighted_choice(MCC_CATEGORIES)
            merchant = random.choice(MERCHANTS[mcc])
            lo, hi = TXN_AMOUNT_RANGES[mcc]
            amount = random.randint(lo, hi)
            emi = "true" if random.random() < 0.03 else "false"
            rows.append({
                "customer_id": cid,
                "txn_date": random_date(start, now),
                "txn_amount": amount,
                "mcc_category": mcc,
                "merchant_name": merchant,
                "emi_converted": emi,
            })

    # Shuffle so it's not ordered by customer
    random.shuffle(rows)

    filepath = os.path.join(data_dir, "transactions.csv")
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["customer_id", "txn_date", "txn_amount", "mcc_category", "merchant_name", "emi_converted"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"  transactions.csv: {len(rows)} transactions")


def generate_emi_eligibility(customer_ids: list[str], data_dir: str):
    """Generate EMI eligibility data for all customers."""
    rows = []
    for cid in customer_ids:
        has_outstanding = random.random() < 0.55
        if has_outstanding:
            outstanding = random.randint(5000, 950000)
            utilization = round(random.uniform(10, 95), 1)
            min_due = max(500, int(outstanding * random.uniform(0.02, 0.05)))
        else:
            outstanding = 0
            utilization = 0.0
            min_due = 0

        payment_day = random.randint(1, 28)
        days_to_payment = random.randint(1, 28)
        existing_emi = random.choices([0, 1, 2, 3], weights=[0.6, 0.25, 0.1, 0.05])[0]
        past_emi = random.choices([0, 1, 2, 3, 4], weights=[0.4, 0.3, 0.15, 0.1, 0.05])[0]

        # EMI eligible if outstanding > 5000 and utilization > 20%
        emi_eligible = outstanding > 5000 and utilization > 20 and random.random() < 0.65
        max_tenure = random.choice([3, 6, 9, 12]) if emi_eligible else 3

        rows.append({
            "customer_id": cid,
            "outstanding_amount": outstanding,
            "current_utilization": utilization,
            "min_due": min_due,
            "payment_day": payment_day,
            "days_to_payment": days_to_payment,
            "existing_emi_count": existing_emi,
            "past_emi_conversions": past_emi,
            "emi_eligible": str(emi_eligible).lower(),
            "max_emi_tenure": max_tenure,
        })

    filepath = os.path.join(data_dir, "emi_eligibility.csv")
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"  emi_eligibility.csv: {len(rows)} rows")


def generate_exclusion_list(customer_ids: list[str], data_dir: str, list_type: str, count: int):
    """Generate an exclusion list CSV."""
    now = datetime(2026, 3, 31)
    selected = random.sample(customer_ids, min(count, len(customer_ids)))

    rows = []
    for cid in selected:
        if list_type == "npa":
            rows.append({
                "customer_id": cid,
                "npa_date": random_date(now - timedelta(days=120), now),
                "npa_category": weighted_choice(NPA_CATEGORIES),
            })
        elif list_type == "dnc":
            rows.append({
                "customer_id": cid,
                "dnc_source": weighted_choice(DNC_SOURCES),
                "dnc_date": random_date(now - timedelta(days=90), now),
            })
        elif list_type == "fraud":
            rows.append({
                "customer_id": cid,
                "flag_date": random_date(now - timedelta(days=90), now),
                "fraud_type": random.choice(FRAUD_TYPES),
                "severity": weighted_choice(FRAUD_SEVERITIES),
            })
        elif list_type == "cooling_off":
            req_date = random_date(now - timedelta(days=30), now)
            req_dt = datetime.strptime(req_date, "%Y-%m-%d")
            rows.append({
                "customer_id": cid,
                "request_date": req_date,
                "request_type": weighted_choice(COOLING_OFF_TYPES),
                "cooling_off_end": (req_dt + timedelta(days=random.randint(10, 30))).strftime("%Y-%m-%d"),
            })
        elif list_type == "complaint":
            rows.append({
                "customer_id": cid,
                "complaint_date": random_date(now - timedelta(days=30), now),
                "complaint_type": random.choice(COMPLAINT_TYPES),
                "status": weighted_choice(COMPLAINT_STATUSES),
            })

    filenames = {
        "npa": "npa_list.csv",
        "dnc": "dnc_list.csv",
        "fraud": "fraud_list.csv",
        "cooling_off": "cooling_off_list.csv",
        "complaint": "complaint_list.csv",
    }

    filepath = os.path.join(data_dir, filenames[list_type])
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"  {filenames[list_type]}: {len(rows)} rows")


def generate_all(config: dict, data_dir: str, shared: bool = True):
    """Generate all datasets for a given config."""
    print(f"\nGenerating datasets for {config['name']}...")

    customer_ids = generate_customers(config, data_dir)

    # Shared datasets (transactions, EMI, exclusions) — only generate once
    if shared:
        generate_transactions(customer_ids, data_dir)
        generate_emi_eligibility(customer_ids, data_dir)
        generate_exclusion_list(customer_ids, data_dir, "npa", 1445)
        generate_exclusion_list(customer_ids, data_dir, "dnc", 3972)
        generate_exclusion_list(customer_ids, data_dir, "fraud", 541)
        generate_exclusion_list(customer_ids, data_dir, "cooling_off", 1053)
        generate_exclusion_list(customer_ids, data_dir, "complaint", 785)

    print(f"Done! Files written to {data_dir}/\n")


def main():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(data_dir, exist_ok=True)

    # Parse args
    config_name = "demo"
    if len(sys.argv) > 1:
        if sys.argv[1] == "--config" and len(sys.argv) > 2:
            config_name = sys.argv[2]
        else:
            config_name = sys.argv[1]

    # Load config
    if config_name in PRESETS:
        config = PRESETS[config_name]
        # For preset runs, also determine if we should generate shared files
        shared = config.get("output_prefix", "") == ""  # Only demo generates shared files
        generate_all(config, data_dir, shared=shared)
    elif config_name == "all":
        # Generate everything: demo (with shared) + all other presets (customers only)
        random.seed(42)
        generate_all(PRESETS["demo"], data_dir, shared=True)
        for name, preset in PRESETS.items():
            if name != "demo":
                generate_all(preset, data_dir, shared=False)
    elif config_name.endswith(".json"):
        # Custom config from JSON file
        with open(config_name) as f:
            config = json.load(f)
        generate_all(config, data_dir, shared=config.get("generate_shared", False))
    else:
        print(f"Unknown config: {config_name}")
        print(f"Available presets: {', '.join(PRESETS.keys())}, all")
        print(f"Or pass a JSON file: python generate-data.py --config my_bank.json")
        sys.exit(1)


if __name__ == "__main__":
    random.seed(42)
    main()
