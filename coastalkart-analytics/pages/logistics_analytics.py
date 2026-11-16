"""Page 5: Delivery & Logistics Analytics (Streamlit)."""

import pandas as pd
import plotly.express as px
import streamlit as st

from src.database import run_query


def render():
    st.title("Delivery & Logistics Analytics")
    partner_df = pd.DataFrame(run_query("""
        SELECT delivery_partner,
               COUNT(*) AS shipments,
               ROUND(AVG(CASE WHEN delivery_status = 'On Time' THEN 1.0 ELSE 0.0 END) * 100, 1) AS on_time_pct,
               ROUND(AVG(delivery_cost), 2) AS avg_cost_inr
        FROM deliveries GROUP BY delivery_partner ORDER BY on_time_pct DESC
    """))
    city_df = pd.DataFrame(run_query("""
        WITH ob AS (SELECT DISTINCT order_id, branch_id FROM sales_transactions)
        SELECT b.city,
               COUNT(*) AS shipments,
               ROUND(AVG(CASE WHEN d.delivery_status = 'Delayed' THEN 1.0 ELSE 0.0 END) * 100, 1) AS delay_pct
        FROM deliveries d JOIN ob ON d.order_id = ob.order_id JOIN branches b ON ob.branch_id = b.branch_id
        GROUP BY b.city ORDER BY delay_pct DESC
    """))
    c1, c2 = st.columns(2)
    c1.plotly_chart(px.bar(partner_df, x="delivery_partner", y="on_time_pct", title="On-Time Delivery Rate (%) by Partner"), use_container_width=True)
    c2.plotly_chart(px.bar(city_df, x="city", y="delay_pct", title="Delivery Delay Rate (%) by City"), use_container_width=True)
