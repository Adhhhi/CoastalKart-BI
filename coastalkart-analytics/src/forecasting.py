"""
CoastalKart Retail & E-commerce Pvt. Ltd. — Monthly Sales Forecasting Module
Forecasts upcoming monthly revenue using OLS linear trend + seasonal moving average,
producing prediction intervals (upper/lower uncertainty bounds) clearly separated from actuals.
Uses scikit-learn LinearRegression if installed, with pure-Python OLS fallback.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List

from src.database import DB_PATH, run_query


def generate_sales_forecast(
    horizon_months: int = 4, db_path: Path = DB_PATH
) -> Dict[str, Any]:
    monthly = run_query(
        """
        SELECT
            SUBSTR(order_date_iso, 1, 7) AS month_key,
            ROUND(SUM(revenue), 2) AS actual_revenue,
            ROUND(SUM(profit), 2) AS actual_profit,
            COUNT(DISTINCT order_id) AS orders
        FROM sales_transactions
        WHERE order_status = 'Completed'
        GROUP BY month_key
        ORDER BY month_key
        """,
        db_path=db_path,
    )

    if len(monthly) < 3:
        return {"series": monthly, "model_name": "Insufficient History", "r2_score": 0.0}

    y = [float(m["actual_revenue"]) for m in monthly]
    x = list(range(len(y)))
    n = len(y)

    # Fit linear trend (try scikit-learn, fallback to exact OLS)
    model_name = "OLS Linear Trend + 3M Moving Average"
    try:
        from sklearn.linear_model import LinearRegression  # type: ignore
        import numpy as np  # type: ignore

        lr = LinearRegression()
        X_arr = np.array(x).reshape(-1, 1)
        lr.fit(X_arr, np.array(y))
        slope = float(lr.coef_[0])
        intercept = float(lr.intercept_)
        model_name = "Scikit-learn LinearRegression + 3M Moving Average"
    except Exception:
        x_mean = sum(x) / n
        y_mean = sum(y) / n
        denom = sum((xi - x_mean) ** 2 for xi in x) or 1.0
        slope = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, y)) / denom
        intercept = y_mean - slope * x_mean

    fitted = [intercept + slope * xi for xi in x]
    residuals = [yi - fi for yi, fi in zip(y, fitted)]
    ss_res = sum(r ** 2 for r in residuals)
    y_mean = sum(y) / n
    ss_tot = sum((yi - y_mean) ** 2 for yi in y) or 1.0
    r2 = max(0.0, round(1.0 - (ss_res / ss_tot), 3))
    rmse = math.sqrt(ss_res / max(1, n - 2))

    # Build combined series with 3-month moving average
    series: List[Dict[str, Any]] = []
    for idx, m in enumerate(monthly):
        window = y[max(0, idx - 2) : idx + 1]
        ma3 = round(sum(window) / len(window), 2)
        series.append({
            "month": m["month_key"],
            "type": "Actual",
            "actual_revenue": round(y[idx], 2),
            "moving_avg_3m": ma3,
            "forecast_revenue": None,
            "lower_bound": None,
            "upper_bound": None,
        })

    # Forecast future months
    last_yr, last_mo = map(int, monthly[-1]["month_key"].split("-"))
    for step in range(1, horizon_months + 1):
        mo = last_mo + step
        yr = last_yr + (mo - 1) // 12
        mo = ((mo - 1) % 12) + 1
        m_key = f"{yr:04d}-{mo:02d}"

        idx_future = n - 1 + step
        trend_pred = intercept + slope * idx_future
        recent_ma = sum(y[-3:]) / 3.0
        blended = round(0.72 * trend_pred + 0.28 * (recent_ma + slope * step), 2)
        band = round(1.64 * rmse * math.sqrt(1 + step * 0.18), 2)

        series.append({
            "month": m_key,
            "type": "Forecast",
            "actual_revenue": None,
            "moving_avg_3m": None,
            "forecast_revenue": max(0.0, blended),
            "lower_bound": max(0.0, round(blended - band, 2)),
            "upper_bound": round(blended + band, 2),
        })

    return {
        "series": series,
        "model_name": model_name,
        "r2_score": r2,
        "monthly_slope_inr": round(slope, 2),
        "rmse_inr": round(rmse, 2),
    }
