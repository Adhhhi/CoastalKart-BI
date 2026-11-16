"""
CoastalKart Retail & E-commerce Pvt. Ltd. — Streamlit BI Application Entry Point
Simulated Mangaluru Retail & E-commerce Business Intelligence Platform.
"""

import time
import streamlit as st

from src.data_generator import generate_raw_datasets
from src.data_cleaning import run_cleaning_pipeline
from src.database import DB_PATH, build_database, run_query
from src.excel_exporter import generate_executive_workbook

st.set_page_config(
    page_title="CoastalKart BI — Mangaluru Retail Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

if not DB_PATH.exists():
    with st.spinner("Generating CoastalKart synthetic dataset and SQLite warehouse..."):
        generate_raw_datasets()
        run_cleaning_pipeline()
        build_database()
        generate_executive_workbook()

st.sidebar.title("CoastalKart BI")
st.sidebar.caption("Management View · Mangaluru HQ (Simulated Case Study)")

page = st.sidebar.radio(
    "Navigation",
    [
        "1. Executive Overview",
        "2. Sales Analytics",
        "3. Customer Analytics (RFM & Cohorts)",
        "4. Inventory & Suppliers",
        "5. Delivery & Logistics",
        "6. Product & Profitability",
        "7. Business Insights & Forecast",
        "8. SQL Analytics Explorer",
        "9. Data Quality & Pipeline",
    ],
)

sim_mode = st.sidebar.toggle("Simulated Live Sales Monitor", value=False)
if sim_mode:
    st.info("Simulated Real-Time Sales Monitor Active — Sampled from historical orders (Simulated Case Study)")
    live_sample = run_query(
        """
        SELECT s.order_id, b.city, p.product_name, s.quantity, s.revenue, s.payment_method
        FROM sales_transactions s
        JOIN branches b ON s.branch_id = b.branch_id
        JOIN products p ON s.product_id = p.product_id
        WHERE s.order_status = 'Completed'
        ORDER BY RANDOM()
        LIMIT 5
        """
    )
    st.dataframe(live_sample, use_container_width=True)
    if st.button("Refresh Simulated Feed"):
        time.sleep(0.2)
        st.rerun()

if st.sidebar.button("Regenerate Simulated Dataset"):
    generate_raw_datasets()
    run_cleaning_pipeline()
    build_database()
    generate_executive_workbook()
    st.rerun()

PAGE_MAP = {
    "1. Executive Overview": "pages.executive_overview",
    "2. Sales Analytics": "pages.sales_analytics",
    "3. Customer Analytics (RFM & Cohorts)": "pages.customer_analytics",
    "4. Inventory & Suppliers": "pages.inventory_analytics",
    "5. Delivery & Logistics": "pages.logistics_analytics",
    "6. Product & Profitability": "pages.product_analytics",
    "7. Business Insights & Forecast": "pages.business_insights",
    "8. SQL Analytics Explorer": "pages.sql_studio",
    "9. Data Quality & Pipeline": "pages.data_quality",
}

mod = __import__(PAGE_MAP[page], fromlist=["render"])
mod.render()
