"""Page 3: Customer Analytics, RFM Segmentation & Monthly Retention Cohort Matrix (Streamlit)."""

import pandas as pd
import plotly.express as px
import streamlit as st

from src.export_utils import df_to_excel_bytes, df_to_pdf_bytes
from src.metrics import compute_monthly_retention_cohorts, compute_rfm_segments


def render():
    st.title("Customer Analytics, RFM & Retention Cohorts")
    rfm = pd.DataFrame(compute_rfm_segments())
    if rfm.empty:
        st.info("No customer transaction data available.")
        return

    repeat_rate = round((rfm["frequency"] >= 2).mean() * 100, 1)
    avg_clv = round(rfm["monetary"].mean(), 2)
    c1, c2, c3 = st.columns(3)
    c1.metric("Active Customers", f"{len(rfm):,}")
    c2.metric("Repeat Purchase Rate", f"{repeat_rate}%")
    c3.metric("Estimated Avg CLV", f"₹{avg_clv:,.0f}")

    seg_summary = rfm.groupby("rfm_segment", as_index=False).agg(
        customers=("customer_id", "count"),
        revenue=("monetary", "sum"),
        avg_freq=("frequency", "mean"),
    )
    st.plotly_chart(px.bar(seg_summary, x="rfm_segment", y="revenue", color="customers", title="RFM Segment Revenue & Count"), use_container_width=True)

    # Monthly Retention Cohort Matrix
    st.subheader("Monthly Customer Retention Cohort Matrix (%)")
    cohorts = compute_monthly_retention_cohorts()
    if cohorts:
        cohort_df = pd.DataFrame([
            {
                "Cohort Month": c["cohort_month"],
                "Buyers": c["cohort_size"],
                **{f"M{i}": c["retention_pct"][i] for i in range(12)},
            }
            for c in cohorts
        ])
        st.dataframe(cohort_df, use_container_width=True)

    st.subheader("Top 50 Customers by Revenue")
    top_50 = rfm.sort_values("monetary", ascending=False).head(50)
    st.dataframe(top_50, use_container_width=True)

    e1, e2, e3 = st.columns(3)
    e1.download_button("Download RFM CSV", top_50.to_csv(index=False).encode("utf-8"), "coastalkart_rfm.csv", "text/csv")
    e2.download_button("Download RFM Excel", df_to_excel_bytes(seg_summary, "RFM Segments"), "coastalkart_rfm.xlsx")
    e3.download_button("Download RFM PDF", df_to_pdf_bytes("Customer RFM Report", "RFM Cohort Summary", seg_summary), "coastalkart_rfm.pdf")
