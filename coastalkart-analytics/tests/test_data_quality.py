"""Unit tests validating CoastalKart raw vs processed data quality and SQLite integrity."""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.database import DB_PATH, run_query


class TestDataQualityAndIntegrity(unittest.TestCase):
    def test_quality_report_exists_and_clean(self):
        report_path = ROOT / "data" / "processed" / "data_quality_report.json"
        self.assertTrue(report_path.exists())
        report = json.loads(report_path.read_text(encoding="utf-8"))
        self.assertGreater(report["total_anomalies_remediated"], 0)
        self.assertEqual(report["clean_counts"]["sales_transactions"], 25000)
        self.assertEqual(report["clean_counts"]["customers"], 5000)
        self.assertEqual(report["clean_counts"]["products"], 500)
        self.assertEqual(report["clean_counts"]["branches"], 6)
        self.assertEqual(report["clean_counts"]["suppliers"], 30)

    def test_no_negative_quantities_or_revenue(self):
        bad = run_query(
            "SELECT COUNT(*) AS cnt FROM sales_transactions WHERE quantity <= 0 OR revenue < 0",
            db_path=DB_PATH,
        )[0]["cnt"]
        self.assertEqual(bad, 0)

    def test_no_null_payment_methods_or_cities(self):
        bad_pay = run_query(
            "SELECT COUNT(*) AS cnt FROM sales_transactions WHERE payment_method IS NULL OR payment_method = ''",
            db_path=DB_PATH,
        )[0]["cnt"]
        bad_city = run_query(
            "SELECT COUNT(*) AS cnt FROM customers WHERE city IS NULL OR city = ''",
            db_path=DB_PATH,
        )[0]["cnt"]
        self.assertEqual(bad_pay, 0)
        self.assertEqual(bad_city, 0)

    def test_referential_integrity(self):
        orphan_sales = run_query(
            """
            SELECT COUNT(*) AS cnt FROM sales_transactions s
            LEFT JOIN customers c ON s.customer_id = c.customer_id
            LEFT JOIN products p ON s.product_id = p.product_id
            LEFT JOIN branches b ON s.branch_id = b.branch_id
            WHERE c.customer_id IS NULL OR p.product_id IS NULL OR b.branch_id IS NULL
            """,
            db_path=DB_PATH,
        )[0]["cnt"]
        self.assertEqual(orphan_sales, 0)


if __name__ == "__main__":
    unittest.main()
