"""Page 8: SQL Analytics Explorer (Streamlit) — Execute all 22 business SQL queries live."""

import re
from pathlib import Path
import pandas as pd
import streamlit as st

from src.database import run_query

SQL_DIR = Path(__file__).resolve().parent.parent / "sql"
SQL_FILES = ["sales_analysis.sql", "customer_analysis.sql", "inventory_analysis.sql", "logistics_analysis.sql"]


def load_catalog():
    items = []
    for fname in SQL_FILES:
        text = (SQL_DIR / fname).read_text(encoding="utf-8")
        for block in re.split(r"(?=-- QUERY \d+:)", text):
            if "-- QUERY " not in block:
                continue
            lines = block.splitlines()
            title = next((l.replace("-- ", "") for l in lines if l.startswith("-- QUERY ")), "Query")
            question = next((l.replace("-- Business Question:", "").strip() for l in lines if l.startswith("-- Business Question:")), "")
            explanation = next((l.replace("-- Result Explanation:", "").strip() for l in lines if l.startswith("-- Result Explanation:")), "")
            rec = next((l.replace("-- Business Recommendation:", "").strip() for l in lines if l.startswith("-- Business Recommendation:")), "")
            sql_stmt = "\n".join(l for l in lines if not l.strip().startswith("--")).strip()
            items.append({"file": fname, "title": title, "question": question, "explanation": explanation, "recommendation": rec, "sql": sql_stmt})
    return items


def render():
    st.title("SQL Analytics Explorer (22 Business Queries)")
    catalog = load_catalog()
    labels = [f"[{q['file']}] {q['title']}" for q in catalog]
    idx = st.selectbox("Select Analytical Query", range(len(labels)), format_func=lambda i: labels[i])
    item = catalog[idx]

    st.markdown(f"**Business Question:** {item['question']}")
    st.markdown(f"**Explanation:** {item['explanation']}")
    st.info(f"**Recommendation:** {item['recommendation']}")

    sql_input = st.text_area("SQL Query (Read-Only SELECT / WITH)", value=item["sql"], height=220)
    if st.button("Run SQL Query"):
        cleaned = sql_input.strip()
        if not re.match(r"^(SELECT|WITH)\b", cleaned, re.IGNORECASE):
            st.error("Only read-only SELECT or WITH queries are allowed.")
            return
        df = pd.DataFrame(run_query(cleaned))
        st.dataframe(df, use_container_width=True)
