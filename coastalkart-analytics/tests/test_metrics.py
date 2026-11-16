"""Unit tests for CoastalKart KPI metrics, RFM segmentation, forecasting, and insights."""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.forecasting import generate_sales_forecast
from src.insights import generate_dynamic_insights
from src.metrics import (
    compute_monthly_retention_cohorts,
    compute_rfm_segments,
    get_executive_kpis,
    get_inventory_summary,
    get_supplier_scorecard,
)


class TestCoastalKartMetrics(unittest.TestCase):
    def test_executive_kpis_positive_and_bounded(self):
        kpis = get_executive_kpis()
        self.assertGreater(kpis["total_revenue"], 0)
        self.assertGreater(kpis["total_profit"], 0)
        self.assertGreater(kpis["total_orders"], 10000)
        self.assertGreater(kpis["active_customers"], 3000)
        self.assertGreater(kpis["average_order_value"], 100)
        self.assertTrue(0 < kpis["profit_margin_pct"] < 60)

    def test_rfm_segments_valid(self):
        rfm = compute_rfm_segments()
        self.assertGreater(len(rfm), 3000)
        valid_segments = {
            "Champions",
            "Loyal Customers",
            "New / Promising",
            "At Risk",
            "Hibernating",
            "Potential Loyalists",
        }
        for row in rfm[:50]:
            self.assertIn(row["rfm_segment"], valid_segments)
            self.assertTrue(1 <= row["r_score"] <= 5)
            self.assertTrue(1 <= row["f_score"] <= 5)
            self.assertTrue(1 <= row["m_score"] <= 5)

    def test_inventory_summary(self):
        inv = get_inventory_summary()
        self.assertGreater(inv["total_stock_value"], 0)
        self.assertGreater(inv["inventory_turnover_ratio"], 0)

    def test_forecasting_outputs_future_points(self):
        fc = generate_sales_forecast(horizon_months=4)
        actuals = [p for p in fc["series"] if p["type"] == "Actual"]
        forecasts = [p for p in fc["series"] if p["type"] == "Forecast"]
        self.assertEqual(len(actuals), 12)
        self.assertEqual(len(forecasts), 4)
        for f_pt in forecasts:
            self.assertGreaterEqual(f_pt["upper_bound"], f_pt["forecast_revenue"])
            self.assertLessEqual(f_pt["lower_bound"], f_pt["forecast_revenue"])

    def test_dynamic_insights_generated(self):
        insights = generate_dynamic_insights()
        self.assertGreaterEqual(len(insights), 5)
        for ins in insights:
            self.assertTrue(ins["title"])
            self.assertTrue(ins["recommendation"])

    def test_monthly_retention_cohorts(self):
        cohorts = compute_monthly_retention_cohorts()
        self.assertEqual(len(cohorts), 12)
        for c in cohorts:
            self.assertGreater(c["cohort_size"], 0)
            self.assertEqual(c["retention_pct"][0], 100.0)

    def test_supplier_scorecard(self):
        suppliers = get_supplier_scorecard()
        self.assertEqual(len(suppliers), 30)
        self.assertGreater(suppliers[0]["total_revenue"], 0)


if __name__ == "__main__":
    unittest.main()
