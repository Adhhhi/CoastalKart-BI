"""Page 7: Business Insights & Monthly Sales Forecast (Streamlit)."""

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from src.forecasting import generate_sales_forecast
from src.insights import generate_dynamic_insights


def render():
    st.title("Business Insights & Revenue Forecasting")
    insights = generate_dynamic_insights()
    for ins in insights:
        with st.expander(f"[{ins['domain']}] {ins['title']}", expanded=True):
            st.write(ins["observation"])
            st.info(f"Recommendation: {ins['recommendation']}")

    fc = generate_sales_forecast(horizon_months=4)
    df = pd.DataFrame(fc["series"])
    fig = go.Figure()
    actual = df[df["type"] == "Actual"]
    forecast = df[df["type"] == "Forecast"]
    fig.add_trace(go.Scatter(x=actual["month"], y=actual["actual_revenue"], name="Actual Revenue", mode="lines+markers"))
    fig.add_trace(go.Scatter(x=actual["month"], y=actual["moving_avg_3m"], name="3M Moving Avg", line=dict(dash="dot")))
    fig.add_trace(go.Scatter(x=forecast["month"], y=forecast["forecast_revenue"], name="Forecast Revenue", mode="lines+markers", line=dict(dash="dash")))
    fig.update_layout(title=f"Monthly Revenue Forecast ({fc['model_name']} | R²={fc['r2_score']})")
    st.plotly_chart(fig, use_container_width=True)
