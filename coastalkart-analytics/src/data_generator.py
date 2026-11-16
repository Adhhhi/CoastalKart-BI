"""
CoastalKart Retail & E-commerce Pvt. Ltd. — Synthetic Dataset Generator
Generates 12 months of realistic Mangaluru & South India retail/e-commerce operations
with reproducible random seeds and controlled raw data anomalies for the cleaning pipeline.
"""

from __future__ import annotations

import csv
import datetime as dt
import os
import random
from pathlib import Path
from typing import Dict, List, Tuple

SEED = 42

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"

BRANCHES = [
    ("BR-01", "CoastalKart Mangaluru Flagship", "Mangaluru", "Karnataka", "Coastal Karnataka", 0.29),
    ("BR-02", "CoastalKart Bengaluru Hub", "Bengaluru", "Karnataka", "South Metro", 0.24),
    ("BR-03", "CoastalKart Udupi Express", "Udupi", "Karnataka", "Coastal Karnataka", 0.15),
    ("BR-04", "CoastalKart Manipal Campus Mart", "Manipal", "Karnataka", "Coastal Karnataka", 0.13),
    ("BR-05", "CoastalKart Mysuru Heritage Hub", "Mysuru", "Karnataka", "South Interior", 0.11),
    ("BR-06", "CoastalKart Kasaragod Border Depot", "Kasaragod", "Kerala", "North Kerala Interstate", 0.08),
]

FIRST_NAMES = [
    "Aarav", "Aditi", "Akshay", "Ananya", "Anirudh", "Apoorva", "Arjun", "Ashwin",
    "Bhavana", "Chetan", "Deepak", "Deepika", "Devika", "Dhanush", "Divya", "Ganesh",
    "Gautham", "Harish", "Harshitha", "Karthik", "Kavya", "Keerthi", "Kiran", "Lakshmi",
    "Madhav", "Manish", "Meghana", "Nandini", "Nikhil", "Nisha", "Nitin", "Pallavi",
    "Pavan", "Pooja", "Pranav", "Prashanth", "Priya", "Rahul", "Rajesh", "Rakshith",
    "Ramesh", "Rashmi", "Rohan", "Roshni", "Sagar", "Sahana", "Sandeep", "Sanjana",
    "Shashank", "Shilpa", "Shreya", "Siddharth", "Sneha", "Srinivas", "Sujay", "Suman",
    "Suraj", "Swathi", "Tejas", "Varun", "Vidya", "Vikram", "Vinay", "Vivek",
]

LAST_NAMES = [
    "Shetty", "Kamath", "Pai", "Alva", "Rao", "Hegde", "Bhat", "Nayak",
    "Menon", "Nair", "Kulkarni", "Gowda", "Poojary", "D'Souza", "Fernandes", "Acharya",
    "Shenoy", "Prabhu", "Kini", "Kudva", "Ullal", "Bhandary", "Suvarna", "Saldanha",
    "Deshpande", "Joshi", "Murthy", "Naik", "Patil", "Reddy", "Iyer", "Krishnan",
]

SUPPLIER_PREFIXES = [
    "Karavali", "Dakshin", "Malnad", "Netravati", "Kaveri", "Tulu", "Sahyadri", "Deccan",
    "Canara", "Nandi", "Konkan", "Udupi", "Mysuru", "Bengaluru", "Malabar", "Kudla",
]

SUPPLIER_SUFFIXES = [
    "Agro Traders", "Wholesale Depot", "Distributors", "Enterprises", "Consumer Goods",
    "Electronics Hub", "Apparel Mills", "Logistics & Supply", "Fresh Foods", "Homeware Co.",
]

SUPPLIER_CITIES = [
    "Mangaluru", "Udupi", "Bengaluru", "Mysuru", "Kochi", "Coimbatore", "Hubballi", "Mumbai"
]

CATEGORY_SPECS = {
    "Grocery & Staples": {
        "gst": 5,
        "subcategories": {
            "Rice & Grains": [
                ("Sona Masoori Rice 10kg", 540, 660),
                ("Boiled Red Rice 5kg", 260, 340),
                ("Organic Brown Poha 1kg", 75, 110),
                ("Toor Dal Premium 2kg", 250, 320),
                ("Ragi Flour Stone-Ground 2kg", 110, 155),
            ],
            "Coastal Spices & Masalas": [
                ("Kundapura Chicken Masala 200g", 85, 130),
                ("Byadagi Red Chilli Powder 500g", 190, 270),
                ("Mangalorean Fish Curry Paste 250g", 95, 145),
                ("Coorg Black Pepper Whole 250g", 210, 295),
                ("Udupi Sambar Powder 500g", 145, 210),
            ],
            "Cold-Pressed Oils": [
                ("Wood-Pressed Coconut Oil 1L", 280, 390),
                ("Cold-Pressed Groundnut Oil 2L", 420, 560),
                ("Pure Cow Ghee Jar 500ml", 340, 460),
                ("Sesame Gingelly Oil 1L", 265, 360),
            ],
            "Beverages & Filter Coffee": [
                ("Chikmagalur Filter Coffee 500g", 220, 315),
                ("Assam Gold Leaf Tea 500g", 195, 275),
                ("Kokum Concentrate Syrup 750ml", 130, 190),
                ("Malted Health Drink 1kg", 360, 470),
            ],
            "Dairy & Bakery": [
                ("Mangalore Buns Mix 500g", 70, 115),
                ("Rusk & Khara Biscuits Combo", 95, 140),
                ("Cashew Nut Roasted Pack 250g", 240, 330),
                ("Artisanal Jaggery Blocks 1kg", 90, 135),
            ],
        },
    },
    "Household & Kitchen": {
        "gst": 18,
        "subcategories": {
            "Cleaning Supplies": [
                ("Citrus Floor Disinfectant 2L", 190, 275),
                ("Herbal Dishwash Gel 1.5L", 165, 240),
                ("Front-Load Laundry Liquid 2L", 295, 420),
                ("Microfiber Mop & Bucket Set", 590, 899),
            ],
            "Cookware & Steel": [
                ("Tri-Ply Stainless Kadai 24cm", 920, 1399),
                ("Non-Stick Appam Patra 12-Pit", 540, 820),
                ("Hard Anodized Pressure Cooker 5L", 1450, 2150),
                ("Cast Iron Dosa Tawa 28cm", 680, 999),
            ],
            "Storage & Organizers": [
                ("Airtight Masala Box 7-Cup", 320, 480),
                ("Borosilicate Glass Container Set", 640, 949),
                ("Modular Kitchen Rack 3-Tier", 780, 1150),
                ("Stainless Steel Lunch Box 4-Tier", 450, 690),
            ],
            "Laundry & Bath": [
                ("Bamboo Folding Laundry Basket", 520, 799),
                ("Combed Cotton Bath Towel Set", 490, 749),
                ("Monsoon Dehumidifier Pouches 6-Pack", 260, 390),
            ],
        },
    },
    "Electronics & Accessories": {
        "gst": 18,
        "subcategories": {
            "Audio & Earbuds": [
                ("ANC Wireless Earbuds Pro", 1299, 1799),
                ("Portable Bluetooth Speaker 20W", 1499, 2199),
                ("USB-C Wired Studio Earphones", 449, 649),
                ("Neckband Sport Earphones", 799, 1199),
            ],
            "Cables & Chargers": [
                ("65W GaN Fast Wall Charger", 1099, 1499),
                ("Braided USB-C Cable 1.5m", 199, 349),
                ("20000mAh Fast Power Bank", 1299, 1699),
                ("Surge Protector 6-Socket Strip", 499, 749),
            ],
            "Smart Accessories": [
                ("AMOLED Fitness Smart Watch", 2199, 2999),
                ("Ergonomic Wireless Mouse", 499, 799),
                ("Aluminum Laptop Stand Foldable", 649, 999),
                ("64GB USB 3.2 Flash Drive", 380, 549),
            ],
            "Small Appliances": [
                ("Electric Kettle Stainless 1.5L", 699, 999),
                ("750W Mixer Grinder 3-Jar", 2499, 3399),
                ("Rechargeable Mosquito Racquet", 280, 420),
                ("LED Emergency Lantern 30W", 540, 799),
            ],
        },
    },
    "Fashion & Lifestyle": {
        "gst": 12,
        "subcategories": {
            "Coastal Cotton Wear": [
                ("Handloom Linen Men's Shirt", 699, 1299),
                ("Breathable Cotton Kurta Set", 799, 1499),
                ("Block-Print Midi Dress", 849, 1599),
                ("Everyday Chino Trousers", 749, 1349),
            ],
            "Footwear": [
                ("Monsoon Waterproof Sandals", 420, 799),
                ("Cushioned Walking Sneakers", 999, 1799),
                ("Kolhapuri Leather Chappal", 580, 1050),
                ("Anti-Skid Kitchen Clogs", 340, 599),
            ],
            "Bags & Travel": [
                ("Water-Resistant Laptop Backpack 28L", 899, 1599),
                ("Canvas Tote Shopping Bag", 260, 499),
                ("Cabin Duffel Travel Bag", 950, 1699),
            ],
            "Ethnic & Casuals": [
                ("Kasavu Border Cotton Mundu", 480, 899),
                ("Printed Dupatta & Stole Pack", 360, 680),
                ("Polo Collar Pique T-Shirt", 410, 799),
            ],
        },
    },
}

DELIVERY_PARTNERS = [
    ("CoastalExpress", 0.34, 1.8, 0.08, 52),
    ("BlueDart Regional", 0.22, 2.1, 0.10, 74),
    ("Delhivery South", 0.21, 2.6, 0.16, 62),
    ("Shadowfax Hyperlocal", 0.13, 1.5, 0.14, 46),
    ("Ecom Express", 0.10, 3.2, 0.28, 58),
]

PAYMENT_METHODS = [
    ("UPI", 0.48),
    ("Credit Card", 0.18),
    ("Debit Card", 0.14),
    ("Cash on Delivery", 0.14),
    ("Net Banking", 0.06),
]

CUSTOMER_SEGMENTS = [
    ("Retail Consumer", 0.60),
    ("Prime Member", 0.22),
    ("Bulk / Kirana Partner", 0.11),
    ("Corporate Buyer", 0.07),
]


def fmt_ddmmyyyy(d: dt.date) -> str:
    return d.strftime("%d-%m-%Y")


def weighted_choice(rng: random.Random, items: List[Tuple], weight_idx: int = 1):
    weights = [x[weight_idx] for x in items]
    return rng.choices(items, weights=weights, k=1)[0]


def generate_raw_datasets(seed: int = SEED, output_dir: Path = RAW_DIR) -> Dict[str, int]:
    rng = random.Random(seed)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Branches (6)
    branches_rows = []
    for br_id, name, city, state, region, _ in BRANCHES:
        branches_rows.append({
            "branch_id": br_id,
            "branch_name": name,
            "city": city,
            "state": state,
            "region": region,
        })

    # 2. Suppliers (30)
    categories = list(CATEGORY_SPECS.keys())
    suppliers_rows = []
    used_sup_names = set()
    for i in range(1, 31):
        while True:
            name = f"{rng.choice(SUPPLIER_PREFIXES)} {rng.choice(SUPPLIER_SUFFIXES)}"
            if name not in used_sup_names:
                used_sup_names.add(name)
                break
        sup_cat = categories[(i - 1) % len(categories)]
        suppliers_rows.append({
            "supplier_id": f"SUP-{i:03d}",
            "supplier_name": name,
            "supplier_location": rng.choice(SUPPLIER_CITIES),
            "product_category": sup_cat,
            "lead_time": rng.randint(2, 10),
            "supplier_rating": round(rng.uniform(3.4, 4.9), 1),
        })

    sup_by_cat = {cat: [s["supplier_id"] for s in suppliers_rows if s["product_category"] == cat] for cat in categories}

    # 3. Products (500)
    products_rows = []
    # Flatten template items and generate 500 distinct SKUs
    templates = []
    for cat, spec in CATEGORY_SPECS.items():
        for subcat, items in spec["subcategories"].items():
            for title, cost_base, price_base in items:
                templates.append((cat, subcat, spec["gst"], title, cost_base, price_base))

    variants = [
        "Classic", "Value Pack", "Pro", "Family Edition", "Eco", "Select",
        "Reserve", "Coastal Edition", "Lite", "Plus", "Premium", "Essential",
    ]
    prod_idx = 1
    while len(products_rows) < 500:
        cat, subcat, gst_rate, base_title, cost_base, price_base = templates[(prod_idx - 1) % len(templates)]
        cycle = (prod_idx - 1) // len(templates)
        variant = variants[cycle % len(variants)]
        sku_suffix = f" ({variant})" if cycle > 0 else ""
        if cycle >= len(variants):
            sku_suffix = f" ({variant} #{cycle // len(variants) + 1})"
        product_name = f"{base_title}{sku_suffix}"

        # Make a subset of high-volume Electronics SKUs deliberately thin-margin (6%–11%)
        if cat == "Electronics & Accessories" and prod_idx % 5 == 0:
            unit_price = round(price_base * rng.uniform(0.95, 1.08), 2)
            margin_target = rng.uniform(0.06, 0.11)
            cost_price = round(unit_price * (1 - margin_target), 2)
            is_low_margin_hero = True
        else:
            factor = rng.uniform(0.88, 1.22)
            unit_price = round(price_base * factor, 2)
            cost_price = round(cost_base * factor * rng.uniform(0.92, 1.05), 2)
            if cost_price >= unit_price * 0.94:
                cost_price = round(unit_price * 0.85, 2)
            is_low_margin_hero = False

        profit_margin = round(((unit_price - cost_price) / unit_price) * 100, 2)
        products_rows.append({
            "product_id": f"PRD-{prod_idx:04d}",
            "product_name": product_name,
            "category": cat,
            "subcategory": subcat,
            "unit_price": unit_price,
            "cost_price": cost_price,
            "profit_margin": profit_margin,
            "gst_rate": gst_rate,
            "supplier_id": rng.choice(sup_by_cat[cat]),
            "_hero_demand": 2.4 if is_low_margin_hero else (1.45 if cat in ("Grocery & Staples", "Household & Kitchen") else 1.0),
        })
        prod_idx += 1

    # 4. Customers (5,000)
    customers_rows = []
    branch_city_weights = [(b[2], b[3], b[5]) for b in BRANCHES]
    reg_start = dt.date(2024, 1, 1)
    reg_end = dt.date(2026, 10, 15)
    reg_span = (reg_end - reg_start).days

    for c_idx in range(1, 5001):
        fname = rng.choice(FIRST_NAMES)
        lname = rng.choice(LAST_NAMES)
        city, state, _ = weighted_choice(rng, branch_city_weights, 2)
        seg, _ = weighted_choice(rng, CUSTOMER_SEGMENTS, 1)
        reg_date = reg_start + dt.timedelta(days=rng.randint(0, reg_span))
        # Synthetic Indian phone format (+91 90000 XXXXX range clearly fictional)
        phone = f"+91 90{rng.randint(100, 999)} {rng.randint(10000, 99999)}"
        customers_rows.append({
            "customer_id": f"CUST-{c_idx:05d}",
            "customer_name": f"{fname} {lname}",
            "phone": phone,
            "city": city,
            "state": state,
            "customer_segment": seg,
            "registration_date": fmt_ddmmyyyy(reg_date),
            "_reg_date_obj": reg_date,
        })

    # Assign customer propensity weights so there is a realistic Pareto repeat-buyer distribution
    # ~18% loyal repeat buyers, ~45% regular, ~37% occasional/one-time
    cust_weights = []
    for c_idx in range(len(customers_rows)):
        r = rng.random()
        if r < 0.18:
            cust_weights.append(5.5)
        elif r < 0.63:
            cust_weights.append(1.8)
        else:
            cust_weights.append(0.45)

    # 5. Inventory (500 products x 6 branches = 3,000 records)
    inventory_rows = []
    for prod in products_rows:
        for br in branches_rows:
            cat = prod["category"]
            base_reorder = 25 if cat == "Grocery & Staples" else (18 if cat == "Household & Kitchen" else 12)
            reorder_level = base_reorder + rng.randint(-4, 8)
            roll = rng.random()
            # Create realistic shortages (especially Mangaluru/Bengaluru fast movers) & overstock pockets
            if roll < 0.045:
                stock_qty = 0
            elif roll < 0.17:
                stock_qty = rng.randint(2, max(3, reorder_level - 1))
            elif roll < 0.82:
                stock_qty = rng.randint(reorder_level + 5, reorder_level * 4)
            else:
                stock_qty = rng.randint(reorder_level * 5, reorder_level * 9)

            if stock_qty == 0:
                status = "Out of Stock"
            elif stock_qty <= reorder_level:
                status = "Low Stock"
            elif stock_qty >= reorder_level * 5:
                status = "Overstocked"
            else:
                status = "Optimal"

            inventory_rows.append({
                "product_id": prod["product_id"],
                "branch_id": br["branch_id"],
                "stock_quantity": stock_qty,
                "reorder_level": reorder_level,
                "stock_status": status,
            })

    # 6. Sales Transactions (~25,000 clean rows across 12 months: 01-11-2025 to 31-10-2026)
    # Monthly seasonality weights (12 months starting Nov 2025 -> Oct 2026)
    months = [
        (2025, 11, 0.82),
        (2025, 12, 0.95),
        (2026, 1, 0.88),
        (2026, 2, 0.84),
        (2026, 3, 0.98),
        (2026, 4, 1.03),
        (2026, 5, 0.99),
        (2026, 6, 0.95),
        (2026, 7, 0.91),
        (2026, 8, 1.06),
        (2026, 9, 1.14),
        (2026, 10, 1.28),
    ]
    month_dates: List[Tuple[dt.date, float]] = []
    for yr, mo, m_wt in months:
        d = dt.date(yr, mo, 1)
        while d.month == mo:
            # Slight weekend boost
            day_wt = m_wt * (1.22 if d.weekday() >= 5 else 1.0)
            month_dates.append((d, day_wt))
            d += dt.timedelta(days=1)

    date_choices = [x[0] for x in month_dates]
    date_weights = [x[1] for x in month_dates]

    # Product demand weights
    prod_weights = [p["_hero_demand"] * rng.uniform(0.5, 1.7) for p in products_rows]

    sales_rows = []
    orders_meta = {}  # order_id -> meta for delivery generation

    target_transactions = 25000
    order_seq = 10001
    invoice_seq = 50001

    branch_map = {b[0]: b for b in BRANCHES}
    cust_by_city = {}
    for c in customers_rows:
        cust_by_city.setdefault(c["city"], []).append(c)

    while len(sales_rows) < target_transactions:
        order_date = rng.choices(date_choices, weights=date_weights, k=1)[0]
        br_tuple = weighted_choice(rng, BRANCHES, 5)
        br_id, _, br_city, _, _, _ = br_tuple

        # 80% local city customer, 20% cross-city
        if rng.random() < 0.80 and br_city in cust_by_city:
            cust = rng.choice(cust_by_city[br_city])
        else:
            cust = rng.choices(customers_rows, weights=cust_weights, k=1)[0]

        pay_method, _ = weighted_choice(rng, PAYMENT_METHODS, 1)
        status_roll = rng.random()
        if status_roll < 0.92:
            order_status = "Completed"
        elif status_roll < 0.96:
            order_status = "Returned"
        else:
            order_status = "Cancelled"

        order_id = f"ORD-{order_seq:06d}"
        order_seq += 1

        # 1 to 3 items per order
        num_items = rng.choices([1, 2, 3], weights=[0.58, 0.30, 0.12], k=1)[0]
        if len(sales_rows) + num_items > target_transactions:
            num_items = target_transactions - len(sales_rows)

        chosen_prods = rng.choices(products_rows, weights=prod_weights, k=num_items)
        order_total = 0.0

        for prod in chosen_prods:
            qty = rng.choices([1, 2, 3, 4, 5], weights=[0.54, 0.25, 0.12, 0.06, 0.03], k=1)[0]
            if cust["customer_segment"] == "Bulk / Kirana Partner":
                qty = qty * rng.randint(2, 4)

            unit_price = prod["unit_price"]
            # Higher discounts in Electronics / Fashion & during festive months (Sep-Oct, Dec)
            festive = order_date.month in (9, 10, 12)
            if prod["category"] in ("Electronics & Accessories", "Fashion & Lifestyle"):
                disc_choices = [0, 5, 10, 15, 20] if festive else [0, 5, 10, 15]
                disc_pct = rng.choices(disc_choices, weights=[0.30, 0.28, 0.22, 0.14, 0.06] if festive else [0.42, 0.28, 0.20, 0.10], k=1)[0]
            else:
                disc_pct = rng.choices([0, 2, 5, 8], weights=[0.55, 0.22, 0.18, 0.05], k=1)[0]

            gross = qty * unit_price
            discount_amt = round(gross * (disc_pct / 100.0), 2)
            revenue = round(gross - discount_amt, 2)
            gst_amt = round(revenue * (prod["gst_rate"] / (100.0 + prod["gst_rate"])), 2)
            cost_total = round(qty * prod["cost_price"], 2)
            profit = round((revenue - gst_amt) - cost_total, 2) if order_status == "Completed" else 0.0

            invoice_id = f"INV-{invoice_seq:06d}"
            invoice_seq += 1

            sales_rows.append({
                "invoice_id": invoice_id,
                "order_id": order_id,
                "order_date": fmt_ddmmyyyy(order_date),
                "order_date_iso": order_date.isoformat(),
                "customer_id": cust["customer_id"],
                "product_id": prod["product_id"],
                "quantity": qty,
                "unit_price": unit_price,
                "discount_pct": disc_pct,
                "discount_amount": discount_amt,
                "gst_rate": prod["gst_rate"],
                "gst_amount": gst_amt,
                "revenue": revenue,
                "cost_total": cost_total,
                "profit": profit,
                "branch_id": br_id,
                "payment_method": pay_method,
                "order_status": order_status,
            })
            order_total += revenue

        orders_meta[order_id] = {
            "order_date": order_date,
            "branch_id": br_id,
            "city": br_city,
            "order_status": order_status,
            "order_total": order_total,
        }

    # 7. Deliveries (~10,000+ records from orders)
    deliveries_rows = []
    all_order_ids = [oid for oid, meta in orders_meta.items() if meta["order_status"] != "Cancelled"]
    rng.shuffle(all_order_ids)
    selected_delivery_orders = all_order_ids[:10800]

    for d_idx, oid in enumerate(selected_delivery_orders, start=1):
        meta = orders_meta[oid]
        odate = meta["order_date"]
        city = meta["city"]
        partner, _, base_days, partner_delay_prob, base_cost = weighted_choice(rng, DELIVERY_PARTNERS, 1)

        dispatch_lag = rng.choices([0, 1, 2], weights=[0.52, 0.38, 0.10], k=1)[0]
        dispatch_date = odate + dt.timedelta(days=dispatch_lag)

        # Expected transit SLA depends on city
        expected_transit = 2 if city in ("Mangaluru", "Udupi", "Manipal") else (3 if city in ("Bengaluru", "Mysuru") else 4)
        expected_date = dispatch_date + dt.timedelta(days=expected_transit)

        # Delay probability higher in Kasaragod (interstate) and outer Bengaluru
        city_delay_boost = 0.22 if city == "Kasaragod" else (0.09 if city == "Bengaluru" else (0.04 if city == "Mysuru" else -0.04))
        total_delay_prob = max(0.03, min(0.65, partner_delay_prob + city_delay_boost))

        if meta["order_status"] == "Returned":
            delivery_status = "Returned"
            actual_transit = expected_transit + rng.randint(0, 2)
        elif odate >= dt.date(2026, 10, 29) and rng.random() < 0.35:
            delivery_status = "In Transit"
            actual_transit = expected_transit
        elif rng.random() < total_delay_prob:
            delivery_status = "Delayed"
            actual_transit = expected_transit + rng.choices([1, 2, 3, 4], weights=[0.45, 0.30, 0.15, 0.10], k=1)[0]
        else:
            delivery_status = "On Time"
            actual_transit = max(1, expected_transit - rng.choices([0, 1], weights=[0.70, 0.30], k=1)[0])

        delivery_date = dispatch_date + dt.timedelta(days=actual_transit)
        cost_mult = 1.38 if city == "Kasaragod" else (1.18 if city == "Bengaluru" else 1.0)
        delivery_cost = round(base_cost * cost_mult * rng.uniform(0.88, 1.24), 2)

        deliveries_rows.append({
            "delivery_id": f"DEL-{d_idx:06d}",
            "order_id": oid,
            "delivery_partner": partner,
            "dispatch_date": fmt_ddmmyyyy(dispatch_date),
            "dispatch_date_iso": dispatch_date.isoformat(),
            "expected_delivery_date": fmt_ddmmyyyy(expected_date),
            "expected_delivery_date_iso": expected_date.isoformat(),
            "delivery_date": fmt_ddmmyyyy(delivery_date) if delivery_status != "In Transit" else "",
            "delivery_date_iso": delivery_date.isoformat() if delivery_status != "In Transit" else "",
            "delivery_status": delivery_status,
            "delivery_cost": delivery_cost,
        })

    # Inject controlled realistic anomalies into RAW sales & customers CSVs
    # so data_cleaning.py performs genuine, auditable cleaning.
    raw_sales = [dict(r) for r in sales_rows]
    # a) 110 duplicate rows
    for dup in rng.sample(raw_sales, 110):
        raw_sales.append(dict(dup))
    # b) 65 missing payment_method
    for row in rng.sample(raw_sales, 65):
        row["payment_method"] = ""
    # c) 45 negative or zero quantity
    for row in rng.sample(raw_sales, 45):
        row["quantity"] = -abs(int(row["quantity"])) if rng.random() < 0.7 else 0
    # d) 35 corrupted revenue mismatch
    for row in rng.sample(raw_sales, 35):
        row["revenue"] = round(float(row["revenue"]) * 1.47 + 99, 2)
    # e) 30 malformed dates
    for row in rng.sample(raw_sales, 30):
        row["order_date"] = "99-99-2026"
        row["order_date_iso"] = ""

    raw_customers = []
    for c in customers_rows:
        rc = {k: v for k, v in c.items() if not k.startswith("_")}
        raw_customers.append(rc)
    for row in rng.sample(raw_customers, 40):
        row["city"] = ""

    # Clean helper keys from products before writing
    clean_products = [{k: v for k, v in p.items() if not k.startswith("_")} for p in products_rows]

    def write_csv(path: Path, rows: List[Dict]):
        if not rows:
            return
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)

    write_csv(output_dir / "branches_raw.csv", branches_rows)
    write_csv(output_dir / "suppliers_raw.csv", suppliers_rows)
    write_csv(output_dir / "products_raw.csv", clean_products)
    write_csv(output_dir / "customers_raw.csv", raw_customers)
    write_csv(output_dir / "inventory_raw.csv", inventory_rows)
    write_csv(output_dir / "sales_transactions_raw.csv", raw_sales)
    write_csv(output_dir / "deliveries_raw.csv", deliveries_rows)

    return {
        "branches": len(branches_rows),
        "suppliers": len(suppliers_rows),
        "products": len(clean_products),
        "customers_raw": len(raw_customers),
        "inventory": len(inventory_rows),
        "sales_raw": len(raw_sales),
        "deliveries": len(deliveries_rows),
    }


if __name__ == "__main__":
    counts = generate_raw_datasets()
    print("Generated raw CoastalKart datasets:", counts)
