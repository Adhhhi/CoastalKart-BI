"""Page 6: Product & Profitability Analytics (Streamlit)."""

import pandas as pd
import plotly.express as px
import streamlit as st

from src.database import run_query


def render():
    st.title("Product & Profitability Analytics")
    prod_df = pd.DataFrame(run_query("""
        SELECT p.product_id, p.product_name, p.category,
               SUM(s.quantity) AS units_sold,
               ROUND(SUM(s.revenue), 2) AS revenue,
               ROUND(SUM(s.profit), 2) AS profit,
               ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS realized_margin_pct
        FROM sales_transactions s JOIN products p ON s.product_id = p.product_id
        WHERE s.order_status = 'Completed'
        GROUP BY p.product_id ORDER BY revenue DESC
    """))
    st.plotly_chart(
        px.scatter(prod_df.head(150), x="revenue", y="realized_margin_pct", color="category", size="units_sold", hover_name="product_name", title="Revenue vs Realized Profit Margin (%)"),
        use_container_width=True,
    )
    st.subheader("High-Sales / Low-Margin Alert (<10% Margin)")
    st.dataframe(prod_df[prod_df["realized_margin_pct"] < 10].head(20), use_container_width=True)
