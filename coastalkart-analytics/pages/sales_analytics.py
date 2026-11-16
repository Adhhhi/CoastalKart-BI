"""Page 2: Sales Analytics (Streamlit) with full interactive filters, search, reset & CSV/Excel/PDF exports."""

import datetime as dt
import pandas as pd
import plotly.express as px
import streamlit as st

from src.database import run_query
from src.export_utils import df_to_excel_bytes, df_to_pdf_bytes


def render():
    st.title("Sales Analytics")
    st.caption("Interactive daily/monthly revenue, discounts, payment channels, and branch ranking (INR ₹ · DD-MM-YYYY)")

    cities = [r["city"] for r in run_query("SELECT DISTINCT city FROM branches ORDER BY city")]
    branches = [r["branch_name"] for r in run_query("SELECT branch_name FROM branches ORDER BY branch_id")]
    cats = [r["category"] for r in run_query("SELECT DISTINCT category FROM products ORDER BY category")]
    pays = [r["payment_method"] for r in run_query("SELECT DISTINCT payment_method FROM sales_transactions ORDER BY payment_method")]

    if st.button("Reset Filters"):
        for key in ["sales_cities", "sales_branches", "sales_cats", "sales_pays", "sales_search", "sales_dates"]:
            if key in st.session_state:
                del st.session_state[key]
        st.rerun()

    c1, c2, c3, c4 = st.columns(4)
    sel_dates = c1.date_input(
        "Date Range (DD-MM-YYYY)",
        value=(dt.date(2025, 11, 1), dt.date(2026, 10, 31)),
        min_value=dt.date(2025, 11, 1),
        max_value=dt.date(2026, 10, 31),
        format="DD-MM-YYYY",
        key="sales_dates",
    )
    sel_cities = c2.multiselect("City", cities, default=cities, key="sales_cities")
    sel_cats = c3.multiselect("Category", cats, default=cats, key="sales_cats")
    sel_pays = c4.multiselect("Payment Method", pays, default=pays, key="sales_pays")

    c5, c6 = st.columns([1, 2])
    sel_branches = c5.multiselect("Branch", branches, default=branches, key="sales_branches")
    search_term = c6.text_input("Search Invoice, Order ID, Customer, or Product", key="sales_search")

    df = pd.DataFrame(run_query("""
        SELECT s.invoice_id, s.order_id, s.order_date, s.order_date_iso,
               c.customer_name, b.city, b.branch_name, p.product_name, p.category,
               s.quantity, s.discount_pct, s.gst_amount, s.revenue, s.profit, s.payment_method
        FROM sales_transactions s
        JOIN branches b ON s.branch_id = b.branch_id
        JOIN products p ON s.product_id = p.product_id
        JOIN customers c ON s.customer_id = c.customer_id
        WHERE s.order_status = 'Completed'
    """))

    if isinstance(sel_dates, tuple) and len(sel_dates) == 2:
        start_iso, end_iso = sel_dates[0].isoformat(), sel_dates[1].isoformat()
        df = df[(df["order_date_iso"] >= start_iso) & (df["order_date_iso"] <= end_iso)]

    df = df[
        df["city"].isin(sel_cities)
        & df["branch_name"].isin(sel_branches)
        & df["category"].isin(sel_cats)
        & df["payment_method"].isin(sel_pays)
    ]

    if search_term.strip():
        q = search_term.strip().lower()
        df = df[
            df["product_name"].str.lower().str.contains(q)
            | df["order_id"].str.lower().str.contains(q)
            | df["customer_name"].str.lower().str.contains(q)
        ]

    if df.empty:
        st.info("No transactions match the active filter combination. Click 'Reset Filters' above.")
        return

    daily = df.groupby("order_date_iso", as_index=False)["revenue"].sum()
    st.plotly_chart(px.area(daily, x="order_date_iso", y="revenue", title="Daily Revenue Trend (₹)"), use_container_width=True)

    branch_rank = (
        df.groupby(["city", "branch_name"], as_index=False)
        .agg(orders=("order_id", "nunique"), revenue=("revenue", "sum"), profit=("profit", "sum"))
        .sort_values("revenue", ascending=False)
    )
    st.subheader("Branch Performance Ranking")
    st.dataframe(branch_rank, use_container_width=True)

    e1, e2, e3 = st.columns(3)
    e1.download_button("Download CSV", df.head(500).to_csv(index=False).encode("utf-8"), "coastalkart_sales.csv", "text/csv")
    e2.download_button("Download Excel (.xlsx)", df_to_excel_bytes(df.head(500), "Sales"), "coastalkart_sales.xlsx")
    e3.download_button("Download PDF Report", df_to_pdf_bytes("Sales Report", "Filtered Sales & Branch Summary", branch_rank), "coastalkart_sales.pdf")
