"""Page 1: Executive Overview (Streamlit)."""

import pandas as pd
import plotly.express as px
import streamlit as st

from src.database import run_query
from src.metrics import get_executive_kpis


def render():
    st.title("Executive Overview")
    st.caption("Company-wide performance across Mangaluru, Udupi, Manipal, Bengaluru, Mysuru & Kasaragod")

    kpis = get_executive_kpis()
    cols = st.columns(7)
    cols[0].metric("Total Revenue", f"₹{kpis['total_revenue']:,.0f}")
    cols[1].metric("Total Profit", f"₹{kpis['total_profit']:,.0f}")
    cols[2].metric("Total Orders", f"{kpis['total_orders']:,}")
    cols[3].metric("Customers", f"{kpis['active_customers']:,}")
    cols[4].metric("Avg Order Value", f"₹{kpis['average_order_value']:,.0f}")
    cols[5].metric("Profit Margin", f"{kpis['profit_margin_pct']}%")
    cols[6].metric("MoM Growth", f"{kpis['mom_revenue_growth_pct']}%")

    monthly = pd.DataFrame(run_query("""
        SELECT SUBSTR(order_date_iso, 1, 7) AS month,
               ROUND(SUM(revenue), 2) AS revenue,
               ROUND(SUM(profit), 2) AS profit
        FROM sales_transactions WHERE order_status = 'Completed'
        GROUP BY month ORDER BY month
    """))
    c1, c2 = st.columns(2)
    c1.plotly_chart(px.line(monthly, x="month", y=["revenue", "profit"], title="Monthly Revenue & Profit Trend (₹)"), use_container_width=True)

    branches = pd.DataFrame(run_query("""
        SELECT b.city, ROUND(SUM(s.revenue), 2) AS revenue, ROUND(SUM(s.profit), 2) AS profit
        FROM sales_transactions s JOIN branches b ON s.branch_id = b.branch_id
        WHERE s.order_status = 'Completed' GROUP BY b.city ORDER BY revenue DESC
    """))
    c2.plotly_chart(px.bar(branches, x="city", y="revenue", color="profit", title="Revenue & Profit by Branch"), use_container_width=True)

    cats = pd.DataFrame(run_query("""
        SELECT p.category, ROUND(SUM(s.revenue), 2) AS revenue
        FROM sales_transactions s JOIN products p ON s.product_id = p.product_id
        WHERE s.order_status = 'Completed' GROUP BY p.category ORDER BY revenue DESC
    """))
    top_prods = pd.DataFrame(run_query("""
        SELECT p.product_name, ROUND(SUM(s.revenue), 2) AS revenue, SUM(s.quantity) AS units
        FROM sales_transactions s JOIN products p ON s.product_id = p.product_id
        WHERE s.order_status = 'Completed' GROUP BY p.product_id ORDER BY revenue DESC LIMIT 10
    """))
    c3, c4 = st.columns(2)
    c3.plotly_chart(px.bar(cats, x="category", y="revenue", title="Revenue by Product Category"), use_container_width=True)
    c4.plotly_chart(px.bar(top_prods, y="product_name", x="revenue", orientation="h", title="Top 10 Products by Revenue"), use_container_width=True)
