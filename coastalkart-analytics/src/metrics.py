"""
CoastalKart Retail & E-commerce Pvt. Ltd. — Business KPI & Metrics Engine
Computes Executive KPIs, RFM Customer Segmentation, Monthly Retention Cohorts,
Inventory Turnover, Supplier Scorecard, Delivery SLA metrics, and Product Margin matrices.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any, Dict, List

from src.database import DB_PATH, run_query


def get_executive_kpis(db_path: Path = DB_PATH) -> Dict[str, Any]:
    summary = run_query(
        """
        SELECT
            ROUND(COALESCE(SUM(CASE WHEN order_status = 'Completed' THEN revenue ELSE 0 END), 0), 2) AS total_revenue,
            ROUND(COALESCE(SUM(CASE WHEN order_status = 'Completed' THEN profit ELSE 0 END), 0), 2) AS total_profit,
            COUNT(DISTINCT order_id) AS total_orders,
            COUNT(DISTINCT CASE WHEN order_status = 'Completed' THEN order_id END) AS completed_orders,
            COUNT(DISTINCT customer_id) AS active_customers
        FROM sales_transactions
        """,
        db_path=db_path,
    )[0]

    monthly = run_query(
        """
        SELECT
            SUBSTR(order_date_iso, 1, 7) AS month_key,
            ROUND(SUM(revenue), 2) AS revenue
        FROM sales_transactions
        WHERE order_status = 'Completed'
        GROUP BY month_key
        ORDER BY month_key
        """,
        db_path=db_path,
    )

    rev_growth_pct = 0.0
    if len(monthly) >= 2 and monthly[-2]["revenue"] > 0:
        rev_growth_pct = round(
            ((monthly[-1]["revenue"] - monthly[-2]["revenue"]) / monthly[-2]["revenue"]) * 100, 2
        )

    total_rev = summary["total_revenue"] or 0.0
    total_profit = summary["total_profit"] or 0.0
    comp_orders = summary["completed_orders"] or 1

    return {
        "total_revenue": total_rev,
        "total_profit": total_profit,
        "total_orders": summary["total_orders"],
        "active_customers": summary["active_customers"],
        "average_order_value": round(total_rev / comp_orders, 2),
        "profit_margin_pct": round((total_profit / total_rev) * 100, 2) if total_rev > 0 else 0.0,
        "mom_revenue_growth_pct": rev_growth_pct,
    }


def compute_rfm_segments(db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    rows = run_query(
        """
        SELECT
            c.customer_id,
            c.customer_name,
            c.city,
            c.customer_segment,
            MAX(s.order_date_iso) AS last_order_iso,
            COUNT(DISTINCT s.order_id) AS frequency,
            ROUND(SUM(s.revenue), 2) AS monetary
        FROM customers c
        JOIN sales_transactions s ON c.customer_id = s.customer_id
        WHERE s.order_status = 'Completed'
        GROUP BY c.customer_id
        """,
        db_path=db_path,
    )
    if not rows:
        return []

    ref_date = max(dt.date.fromisoformat(r["last_order_iso"]) for r in rows) + dt.timedelta(days=1)
    for r in rows:
        r["recency_days"] = (ref_date - dt.date.fromisoformat(r["last_order_iso"])).days

    def assign_quintiles(items: List[Dict], key: str, reverse: bool = False) -> Dict[str, int]:
        sorted_items = sorted(items, key=lambda x: x[key], reverse=reverse)
        n = len(sorted_items)
        scores = {}
        for idx, item in enumerate(sorted_items):
            q = min(5, max(1, int((idx / max(1, n)) * 5) + 1))
            scores[item["customer_id"]] = q
        return scores

    r_scores = assign_quintiles(rows, "recency_days", reverse=True)
    f_scores = assign_quintiles(rows, "frequency", reverse=False)
    m_scores = assign_quintiles(rows, "monetary", reverse=False)

    for r in rows:
        cid = r["customer_id"]
        rs, fs, ms = r_scores[cid], f_scores[cid], m_scores[cid]
        r["r_score"] = rs
        r["f_score"] = fs
        r["m_score"] = ms
        r["rfm_score"] = f"{rs}{fs}{ms}"

        if rs >= 4 and fs >= 4 and ms >= 4:
            seg = "Champions"
        elif fs >= 3 and ms >= 3 and rs >= 3:
            seg = "Loyal Customers"
        elif rs >= 4 and fs <= 2:
            seg = "New / Promising"
        elif rs <= 2 and fs >= 3:
            seg = "At Risk"
        elif rs <= 2 and fs <= 2:
            seg = "Hibernating"
        else:
            seg = "Potential Loyalists"
        r["rfm_segment"] = seg

    return rows


def compute_monthly_retention_cohorts(db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    rows = run_query(
        """
        WITH first_orders AS (
            SELECT
                customer_id,
                MIN(SUBSTR(order_date_iso, 1, 7)) AS cohort_month
            FROM sales_transactions
            WHERE order_status = 'Completed'
            GROUP BY customer_id
        ),
        activity AS (
            SELECT DISTINCT
                s.customer_id,
                f.cohort_month,
                SUBSTR(s.order_date_iso, 1, 7) AS order_month
            FROM sales_transactions s
            JOIN first_orders f ON s.customer_id = f.customer_id
            WHERE s.order_status = 'Completed'
        ),
        offsets AS (
            SELECT
                cohort_month,
                ((CAST(SUBSTR(order_month, 1, 4) AS INTEGER) - CAST(SUBSTR(cohort_month, 1, 4) AS INTEGER)) * 12
                + (CAST(SUBSTR(order_month, 6, 2) AS INTEGER) - CAST(SUBSTR(cohort_month, 6, 2) AS INTEGER))) AS month_offset,
                COUNT(DISTINCT customer_id) AS active_customers
            FROM activity
            GROUP BY cohort_month, month_offset
        )
        SELECT cohort_month, month_offset, active_customers
        FROM offsets
        ORDER BY cohort_month, month_offset
        """,
        db_path=db_path,
    )

    cohorts: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        cm = r["cohort_month"]
        offset = int(r["month_offset"])
        cnt = int(r["active_customers"])
        if cm not in cohorts:
            cohorts[cm] = {"cohort_month": cm, "cohort_size": cnt if offset == 0 else 0, "offsets": {}}
        if offset == 0:
            cohorts[cm]["cohort_size"] = cnt
        cohorts[cm]["offsets"][offset] = cnt

    result: List[Dict[str, Any]] = []
    for cm in sorted(cohorts.keys()):
        info = cohorts[cm]
        base = max(1, info["cohort_size"])
        retention = []
        for m_idx in range(12):
            if m_idx in info["offsets"]:
                val = round((info["offsets"][m_idx] / base) * 100, 1)
                retention.append(val)
            else:
                retention.append(None)
        result.append({
            "cohort_month": cm,
            "cohort_size": info["cohort_size"],
            "retention_pct": retention,
        })
    return result


def get_inventory_summary(db_path: Path = DB_PATH) -> Dict[str, Any]:
    status_counts = run_query(
        """
        SELECT
            i.stock_status,
            COUNT(*) AS sku_branch_count,
            SUM(i.stock_quantity) AS total_units,
            ROUND(SUM(i.stock_quantity * p.cost_price), 2) AS stock_cost_value
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        GROUP BY i.stock_status
        """,
        db_path=db_path,
    )
    cogs_row = run_query(
        """
        SELECT ROUND(SUM(cost_total), 2) AS total_cogs
        FROM sales_transactions
        WHERE order_status = 'Completed'
        """,
        db_path=db_path,
    )[0]
    total_stock_val = sum(r["stock_cost_value"] or 0 for r in status_counts) or 1.0
    turnover = round((cogs_row["total_cogs"] or 0.0) / total_stock_val, 2)
    return {
        "by_status": status_counts,
        "total_stock_value": round(total_stock_val, 2),
        "inventory_turnover_ratio": turnover,
    }


def get_supplier_scorecard(db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    return run_query(
        """
        WITH sku_sales AS (
            SELECT
                product_id,
                SUM(quantity) AS units_sold,
                ROUND(SUM(revenue), 2) AS revenue
            FROM sales_transactions
            WHERE order_status = 'Completed'
            GROUP BY product_id
        ),
        sku_stockouts AS (
            SELECT
                product_id,
                SUM(CASE WHEN stock_status IN ('Out of Stock', 'Low Stock') THEN 1 ELSE 0 END) AS alert_slots
            FROM inventory
            GROUP BY product_id
        )
        SELECT
            sup.supplier_id,
            sup.supplier_name,
            sup.supplier_location,
            sup.product_category,
            sup.lead_time,
            sup.supplier_rating,
            COUNT(DISTINCT p.product_id) AS active_skus,
            COALESCE(SUM(ss.units_sold), 0) AS total_units_sold,
            ROUND(COALESCE(SUM(ss.revenue), 0), 2) AS total_revenue,
            COALESCE(SUM(st.alert_slots), 0) AS stock_alert_slots
        FROM suppliers sup
        JOIN products p ON sup.supplier_id = p.supplier_id
        LEFT JOIN sku_sales ss ON p.product_id = ss.product_id
        LEFT JOIN sku_stockouts st ON p.product_id = st.product_id
        GROUP BY sup.supplier_id, sup.supplier_name, sup.supplier_location, sup.product_category, sup.lead_time, sup.supplier_rating
        ORDER BY total_revenue DESC
        """,
        db_path=db_path,
    )
