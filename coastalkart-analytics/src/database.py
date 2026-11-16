"""
CoastalKart Retail & E-commerce Pvt. Ltd. — SQLite Database Builder & Query Layer
Creates the normalized relational SQLite database with primary/foreign keys and indexes.
"""

from __future__ import annotations

import csv
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
DB_PATH = BASE_DIR / "database" / "coastalkart.db"

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS sales_transactions;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS branches;

CREATE TABLE branches (
    branch_id TEXT PRIMARY KEY,
    branch_name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    region TEXT NOT NULL
);

CREATE TABLE suppliers (
    supplier_id TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    supplier_location TEXT NOT NULL,
    product_category TEXT NOT NULL,
    lead_time INTEGER NOT NULL,
    supplier_rating REAL NOT NULL
);

CREATE TABLE customers (
    customer_id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    customer_segment TEXT NOT NULL,
    registration_date TEXT NOT NULL,
    registration_date_iso TEXT NOT NULL
);

CREATE TABLE products (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    unit_price REAL NOT NULL,
    cost_price REAL NOT NULL,
    profit_margin REAL NOT NULL,
    gst_rate INTEGER NOT NULL,
    supplier_id TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

CREATE TABLE inventory (
    product_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    stock_quantity INTEGER NOT NULL,
    reorder_level INTEGER NOT NULL,
    stock_status TEXT NOT NULL,
    PRIMARY KEY (product_id, branch_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

CREATE TABLE sales_transactions (
    invoice_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_date TEXT NOT NULL,
    order_date_iso TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL,
    discount_pct REAL NOT NULL,
    discount_amount REAL NOT NULL,
    gst_rate INTEGER NOT NULL,
    gst_amount REAL NOT NULL,
    revenue REAL NOT NULL CHECK (revenue >= 0),
    cost_total REAL NOT NULL,
    profit REAL NOT NULL,
    branch_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    order_status TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

CREATE TABLE deliveries (
    delivery_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    delivery_partner TEXT NOT NULL,
    dispatch_date TEXT NOT NULL,
    dispatch_date_iso TEXT NOT NULL,
    expected_delivery_date TEXT NOT NULL,
    expected_delivery_date_iso TEXT NOT NULL,
    delivery_date TEXT,
    delivery_date_iso TEXT,
    delivery_status TEXT NOT NULL,
    delivery_cost REAL NOT NULL
);

CREATE INDEX idx_sales_date ON sales_transactions(order_date_iso);
CREATE INDEX idx_sales_branch ON sales_transactions(branch_id);
CREATE INDEX idx_sales_product ON sales_transactions(product_id);
CREATE INDEX idx_sales_customer ON sales_transactions(customer_id);
CREATE INDEX idx_sales_order ON sales_transactions(order_id);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);
CREATE INDEX idx_inventory_status ON inventory(stock_status);
"""


def _load_csv_rows(path: Path) -> List[Dict[str, str]]:
    with open(path, "r", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def build_database(
    processed_dir: Path = PROCESSED_DIR, db_path: Path = DB_PATH
) -> Dict[str, int]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA_SQL)

        branches = _load_csv_rows(processed_dir / "branches.csv")
        conn.executemany(
            "INSERT INTO branches (branch_id, branch_name, city, state, region) VALUES (?, ?, ?, ?, ?)",
            [(r["branch_id"], r["branch_name"], r["city"], r["state"], r["region"]) for r in branches],
        )

        suppliers = _load_csv_rows(processed_dir / "suppliers.csv")
        conn.executemany(
            "INSERT INTO suppliers (supplier_id, supplier_name, supplier_location, product_category, lead_time, supplier_rating) VALUES (?, ?, ?, ?, ?, ?)",
            [(r["supplier_id"], r["supplier_name"], r["supplier_location"], r["product_category"], int(r["lead_time"]), float(r["supplier_rating"])) for r in suppliers],
        )

        customers = _load_csv_rows(processed_dir / "customers.csv")
        conn.executemany(
            "INSERT INTO customers (customer_id, customer_name, phone, city, state, customer_segment, registration_date, registration_date_iso) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(r["customer_id"], r["customer_name"], r["phone"], r["city"], r["state"], r["customer_segment"], r["registration_date"], r["registration_date_iso"]) for r in customers],
        )

        products = _load_csv_rows(processed_dir / "products.csv")
        conn.executemany(
            "INSERT INTO products (product_id, product_name, category, subcategory, unit_price, cost_price, profit_margin, gst_rate, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [(r["product_id"], r["product_name"], r["category"], r["subcategory"], float(r["unit_price"]), float(r["cost_price"]), float(r["profit_margin"]), int(r["gst_rate"]), r["supplier_id"]) for r in products],
        )

        inventory = _load_csv_rows(processed_dir / "inventory.csv")
        conn.executemany(
            "INSERT INTO inventory (product_id, branch_id, stock_quantity, reorder_level, stock_status) VALUES (?, ?, ?, ?, ?)",
            [(r["product_id"], r["branch_id"], int(r["stock_quantity"]), int(r["reorder_level"]), r["stock_status"]) for r in inventory],
        )

        sales = _load_csv_rows(processed_dir / "sales_transactions.csv")
        conn.executemany(
            """INSERT INTO sales_transactions (
                invoice_id, order_id, order_date, order_date_iso, customer_id, product_id,
                quantity, unit_price, discount_pct, discount_amount, gst_rate, gst_amount,
                revenue, cost_total, profit, branch_id, payment_method, order_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                (
                    r["invoice_id"], r["order_id"], r["order_date"], r["order_date_iso"],
                    r["customer_id"], r["product_id"], int(r["quantity"]), float(r["unit_price"]),
                    float(r["discount_pct"]), float(r["discount_amount"]), int(r["gst_rate"]),
                    float(r["gst_amount"]), float(r["revenue"]), float(r["cost_total"]),
                    float(r["profit"]), r["branch_id"], r["payment_method"], r["order_status"],
                )
                for r in sales
            ],
        )

        deliveries = _load_csv_rows(processed_dir / "deliveries.csv")
        conn.executemany(
            """INSERT INTO deliveries (
                delivery_id, order_id, delivery_partner, dispatch_date, dispatch_date_iso,
                expected_delivery_date, expected_delivery_date_iso, delivery_date, delivery_date_iso,
                delivery_status, delivery_cost
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                (
                    r["delivery_id"], r["order_id"], r["delivery_partner"], r["dispatch_date"],
                    r["dispatch_date_iso"], r["expected_delivery_date"], r["expected_delivery_date_iso"],
                    r["delivery_date"], r["delivery_date_iso"], r["delivery_status"], float(r["delivery_cost"]),
                )
                for r in deliveries
            ],
        )

        conn.commit()
        return {
            "branches": len(branches),
            "suppliers": len(suppliers),
            "customers": len(customers),
            "products": len(products),
            "inventory": len(inventory),
            "sales_transactions": len(sales),
            "deliveries": len(deliveries),
        }
    finally:
        conn.close()


def run_query(
    sql: str, params: Tuple[Any, ...] = (), db_path: Path = DB_PATH
) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


if __name__ == "__main__":
    counts = build_database()
    print("Built SQLite database at", DB_PATH, "with row counts:", counts)
