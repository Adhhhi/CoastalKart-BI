"""SQL Regression Tests: parses and executes all 22+ queries in sql/*.sql against coastalkart.db."""

import re
import sqlite3
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.database import DB_PATH

SQL_FILES = [
    "sales_analysis.sql",
    "customer_analysis.sql",
    "inventory_analysis.sql",
    "logistics_analysis.sql",
]


def parse_queries(sql_path: Path):
    text = sql_path.read_text(encoding="utf-8")
    blocks = re.split(r"(?=-- QUERY \d+:)", text)
    parsed = []
    for block in blocks:
        if "-- QUERY " not in block:
            continue
        lines = [line for line in block.splitlines() if not line.strip().startswith("--")]
        sql_stmt = "\n".join(lines).strip()
        title_line = next((l for l in block.splitlines() if l.startswith("-- QUERY ")), "Unknown Query")
        if sql_stmt:
            parsed.append((title_line, sql_stmt))
    return parsed


class TestSqlQueriesRegression(unittest.TestCase):
    def test_all_sql_scripts_execute_cleanly(self):
        conn = sqlite3.connect(DB_PATH)
        total_queries = 0
        try:
            for fname in SQL_FILES:
                fpath = ROOT / "sql" / fname
                self.assertTrue(fpath.exists(), f"Missing SQL file: {fname}")
                queries = parse_queries(fpath)
                self.assertGreater(len(queries), 0, f"No queries parsed in {fname}")
                for title, stmt in queries:
                    total_queries += 1
                    cur = conn.execute(stmt)
                    rows = cur.fetchall()
                    self.assertGreater(
                        len(rows),
                        0,
                        f"Expected non-empty rows for {fname} -> {title}",
                    )
            self.assertGreaterEqual(total_queries, 20)
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
