"""
Generate synthetic data for Smart Nudges prototype — OS to EMI conversion use case.
Produces: customers.csv, transactions.csv, emi_eligibility.csv
"""

import csv
import random
import math
from datetime import date, timedelta

random.seed(42)

REFERENCE_DATE = date(2026, 3, 24)
NUM_CUSTOMERS = 50000

# ── Helpers ──────────────────────────────────────────────────────────────────

def weighted_choice(options_weights):
    """options_weights: list of (option, weight) tuples."""
    options, weights = zip(*options_weights)
    return random.choices(options, weights=weights, k=1)[0]

def random_date_between(start, end):
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, max(delta, 0)))

# ── 1. Generate customers ───────────────────────────────────────────────────

card_type_weights = [("Classic", 40), ("Gold", 35), ("Platinum", 20), ("Business", 5)]
credit_limit_ranges = {
    "Classic": (25000, 100000),
    "Gold": (100000, 300000),
    "Platinum": (300000, 1000000),
    "Business": (200000, 500000),
}

issue_start = date(2024, 9, 1)
issue_end = date(2026, 3, 31)

customers = []

for i in range(NUM_CUSTOMERS):
    cid = f"C{10001 + i}"
    card = weighted_choice(card_type_weights)
    issue = random_date_between(issue_start, issue_end)
    active = random.random() < 0.57
    activation_date = ""
    if active:
        activation_date = str(issue + timedelta(days=random.randint(0, 90)))
    cl_lo, cl_hi = credit_limit_ranges[card]
    # Round credit limit to nearest 5000
    credit_limit = round(random.randint(cl_lo, cl_hi) / 5000) * 5000
    phone = f"91{''.join(str(random.randint(0,9)) for _ in range(5))}{''.join(str(random.randint(0,9)) for _ in range(4))}"
    # Masked phone: 91XXXXX + 4 digits
    phone = f"91XXXXX{phone[-4:]}"
    email = f"{cid[:3].lower()}***@gmail.com"
    whatsapp = random.random() < 0.72
    push = random.random() < 0.58
    lang = weighted_choice([("en", 65), ("hi", 25), ("ta", 4), ("te", 3), ("mr", 3)])
    npa = random.random() < 0.03
    dnc = random.random() < 0.08
    fraud = random.random() < 0.01
    cooling = random.random() < 0.02
    complaint = random.random() < 0.015

    customers.append({
        "customer_id": cid,
        "card_type": card,
        "issue_date": str(issue),
        "activation_status": "active" if active else "inactive",
        "activation_date": activation_date,
        "credit_limit": credit_limit,
        "phone": phone,
        "email": email,
        "whatsapp_opted_in": str(whatsapp).lower(),
        "push_enabled": str(push).lower(),
        "preferred_language": lang,
        "npa_flag": str(npa).lower(),
        "dnc_flag": str(dnc).lower(),
        "fraud_flag": str(fraud).lower(),
        "cooling_off": str(cooling).lower(),
        "complaint_recent": str(complaint).lower(),
    })

cust_fields = list(customers[0].keys())

with open("/Users/amoghpachpor/Documents/Claude/nudges/marketing-automation/smart-nudges-prototype/data/customers.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cust_fields)
    w.writeheader()
    w.writerows(customers)

print(f"customers.csv: {len(customers)} rows")

# Build lookup dicts
cust_map = {c["customer_id"]: c for c in customers}
active_ids = [c["customer_id"] for c in customers if c["activation_status"] == "active"]

# ── 2. Generate transactions ────────────────────────────────────────────────

txn_start = date(2025, 10, 1)
txn_end = date(2026, 3, 20)

mcc_weights = [
    ("grocery", 25), ("fuel", 15), ("dining", 15), ("online_shopping", 20),
    ("electronics", 10), ("travel", 8), ("utilities", 5), ("others", 2),
]

merchants = {
    "grocery": ["BigBazaar", "DMart", "Reliance Fresh", "More Megastore", "Spencer's", "Star Bazaar", "Nature's Basket"],
    "fuel": ["HP Petroleum", "Indian Oil", "Bharat Petroleum", "Shell", "Nayara Energy"],
    "dining": ["Swiggy", "Zomato", "Dominos", "McDonalds", "Barbeque Nation", "Haldirams", "Pizza Hut"],
    "online_shopping": ["Amazon", "Flipkart", "Myntra", "Ajio", "Nykaa", "Meesho", "Tata Cliq"],
    "electronics": ["Croma", "Reliance Digital", "Vijay Sales", "Samsung Store", "Apple Store"],
    "travel": ["MakeMyTrip", "IRCTC", "Yatra", "Goibibo", "Cleartrip", "EaseMyTrip"],
    "utilities": ["BESCOM", "Jio Recharge", "Airtel Recharge", "Tata Power", "Mahanagar Gas"],
    "others": ["Apollo Pharmacy", "Decathlon", "Lenskart", "Urban Company", "BookMyShow"],
}

def generate_txn_amount():
    """Most 500-5000, ~15% above 10K, long tail to 150K."""
    r = random.random()
    if r < 0.05:
        return random.randint(100, 499)
    elif r < 0.80:
        # Bulk: 500-5000 with slight skew toward lower end
        return int(random.triangular(500, 5000, 1500))
    elif r < 0.85:
        return random.randint(5001, 10000)
    elif r < 0.95:
        # Large: 10K-50K
        return random.randint(10001, 50000)
    else:
        # Very large: 50K-150K
        return random.randint(50001, 150000)

def generate_txn_date():
    """Weighted toward Oct-Nov (festive season spike)."""
    r = random.random()
    if r < 0.35:
        # Oct-Nov spike
        start = date(2025, 10, 1)
        end = date(2025, 11, 30)
    elif r < 0.55:
        # Dec
        start = date(2025, 12, 1)
        end = date(2025, 12, 31)
    elif r < 0.75:
        # Jan
        start = date(2026, 1, 1)
        end = date(2026, 1, 31)
    elif r < 0.90:
        # Feb
        start = date(2026, 2, 1)
        end = date(2026, 2, 28)
    else:
        # Mar
        start = date(2026, 3, 1)
        end = date(2026, 3, 20)
    return random_date_between(start, end)

transactions = []

for cid in active_ids:
    num_txns = random.randint(10, 50)
    for _ in range(num_txns):
        amount = generate_txn_amount()
        mcc = weighted_choice(mcc_weights)
        merchant = random.choice(merchants[mcc])
        txn_date = generate_txn_date()
        # EMI conversion: 5% of transactions above 10K
        emi_converted = "false"
        if amount > 10000 and random.random() < 0.05:
            emi_converted = "true"
        transactions.append({
            "customer_id": cid,
            "txn_date": str(txn_date),
            "txn_amount": amount,
            "mcc_category": mcc,
            "merchant_name": merchant,
            "emi_converted": emi_converted,
        })

txn_fields = list(transactions[0].keys())

with open("/Users/amoghpachpor/Documents/Claude/nudges/marketing-automation/smart-nudges-prototype/data/transactions.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=txn_fields)
    w.writeheader()
    w.writerows(transactions)

print(f"transactions.csv: {len(transactions)} rows")

# ── 3. Generate emi_eligibility ─────────────────────────────────────────────

payment_day_weights = [(1, 30), (5, 25), (10, 15), (15, 15), (20, 15)]

emi_rows = []

for c in customers:
    cid = c["customer_id"]
    cl = c["credit_limit"]
    active = c["activation_status"] == "active"
    npa = c["npa_flag"] == "true"

    # Outstanding amount
    if not active:
        os_amount = 0
    else:
        # Clustered distribution: 30% <5K, 25% 5-25K, 20% 25-75K, 15% 75-150K, 10% 150K+
        bucket = random.random()
        max_os = int(cl * 0.95)
        if bucket < 0.30:
            os_amount = random.randint(0, min(5000, max_os))
        elif bucket < 0.55:
            lo, hi = 5001, min(25000, max_os)
            os_amount = random.randint(min(lo, hi), hi)
        elif bucket < 0.75:
            lo, hi = 25001, min(75000, max_os)
            os_amount = random.randint(min(lo, hi), hi)
        elif bucket < 0.90:
            lo, hi = 75001, min(150000, max_os)
            os_amount = random.randint(min(lo, hi), hi)
        else:
            lo = min(150001, max_os)
            os_amount = random.randint(lo, max_os)

    utilization = round(os_amount / cl * 100, 1) if cl > 0 else 0.0
    min_due = max(0, int(os_amount * 0.05))
    pay_day = weighted_choice(payment_day_weights)

    # Days to payment: next occurrence of payment_day from reference date
    ref = REFERENCE_DATE
    if ref.day <= pay_day:
        next_payment = ref.replace(day=pay_day)
    else:
        # Next month
        if ref.month == 12:
            next_payment = ref.replace(year=ref.year + 1, month=1, day=pay_day)
        else:
            next_payment = ref.replace(month=ref.month + 1, day=pay_day)
    days_to_payment = (next_payment - ref).days

    # Existing EMI count
    emi_count = weighted_choice([(0, 60), (1, 25), (2, 10), (3, 5)])
    past_emi = weighted_choice([(0, 50), (1, 25), (2, 15), (3, 10)])

    # EMI eligible
    emi_eligible = os_amount > 10000 and not npa

    # Max EMI tenure — higher for higher OS
    if os_amount > 100000:
        tenure = 12
    elif os_amount > 50000:
        tenure = weighted_choice([(9, 40), (12, 60)])
    elif os_amount > 25000:
        tenure = weighted_choice([(6, 40), (9, 40), (12, 20)])
    elif os_amount > 10000:
        tenure = weighted_choice([(3, 50), (6, 40), (9, 10)])
    else:
        tenure = 3

    emi_rows.append({
        "customer_id": cid,
        "outstanding_amount": os_amount,
        "current_utilization": utilization,
        "min_due": min_due,
        "payment_day": pay_day,
        "days_to_payment": days_to_payment,
        "existing_emi_count": emi_count,
        "past_emi_conversions": past_emi,
        "emi_eligible": str(emi_eligible).lower(),
        "max_emi_tenure": tenure,
    })

emi_fields = list(emi_rows[0].keys())

with open("/Users/amoghpachpor/Documents/Claude/nudges/marketing-automation/smart-nudges-prototype/data/emi_eligibility.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=emi_fields)
    w.writeheader()
    w.writerows(emi_rows)

print(f"emi_eligibility.csv: {len(emi_rows)} rows")

# ── Summary stats ────────────────────────────────────────────────────────────

active_count = len(active_ids)
inactive_count = NUM_CUSTOMERS - active_count
emi_eligible_count = sum(1 for r in emi_rows if r["emi_eligible"] == "true")
large_txns = sum(1 for t in transactions if t["txn_amount"] > 10000)
emi_converted_count = sum(1 for t in transactions if t["emi_converted"] == "true")

print(f"\n--- Summary ---")
print(f"Active customers: {active_count} ({active_count/NUM_CUSTOMERS*100:.1f}%)")
print(f"Inactive customers: {inactive_count} ({inactive_count/NUM_CUSTOMERS*100:.1f}%)")
print(f"Total transactions: {len(transactions)}")
print(f"Transactions > 10K: {large_txns} ({large_txns/len(transactions)*100:.1f}%)")
print(f"EMI converted txns: {emi_converted_count}")
print(f"EMI eligible customers: {emi_eligible_count}")
