"""Page 4: Inventory Analytics & Supplier Performance Scorecard (Streamlit)."""

import pandas as pd
import plotly.express as px
import streamlit as st

from src.database import run_query
from src.export_utils import df_to_excel_bytes
from src.metrics import get_inventory_summary, get_supplier_scorecard


def render():
    st.title("Inventory Control & Supplier Scorecard")
    summary = get_inventory_summary()
    c1, c2 = st.columns(2)
    c1.metric("Total Stock Cost Value", f"₹{summary['total_stock_value']:,.0f}")
    c2.metric("Inventory Turnover Ratio", f"{summary['inventory_turnover_ratio']}x")

    inv_df = pd.DataFrame(run_query("""
        SELECT b.city, p.product_id, p.product_name, p.category,
               i.stock_quantity, i.reorder_level, i.stock_status,
               ROUND(i.stock_quantity * p.cost_price, 2) AS stock_value_inr
        FROM inventory i
        JOIN branches b ON i.branch_id = b.branch_id
        JOIN products p ON i.product_id = p.product_id
    """))
    status_filter = st.multiselect("Stock Status", inv_df["stock_status"].unique(), default=["Out of Stock", "Low Stock"])
    filtered = inv_df[inv_df["stock_status"].isin(status_filter)]
    st.plotly_chart(px.histogram(inv_df, x="city", color="stock_status", barmode="group", title="Branch-Wise Stock Health"), use_container_width=True)
    st.dataframe(filtered.head(100), use_container_width=True)

    st.subheader("Supplier Performance Scorecard")
    sup_df = pd.DataFrame(get_supplier_scorecard())
    st.plotly_chart(
        px.scatter(sup_df, x="lead_time", y="supplier_rating", size="total_revenue", color="product_category", hover_name="supplier_name", title="Supplier Lead Time vs Rating & Revenue"),
        use_container_width=True,
    )
    st.dataframe(sup_df, use_container_width=True)
    st.download_button("Export Supplier Scorecard (.xlsx)", df_to_excel_bytes(sup_df, "Suppliers"), "coastalkart_suppliers.xlsx")
