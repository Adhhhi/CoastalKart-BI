"""Page 9: Data Quality & Pipeline Audit (Streamlit)."""

import json
from pathlib import Path
import pandas as pd
import streamlit as st

REPORT_PATH = Path(__file__).resolve().parent.parent / "data" / "processed" / "data_quality_report.json"


def render():
    st.title("Data Quality & Pipeline Audit")
    if not REPORT_PATH.exists():
        st.warning("Data quality report not found. Run src/data_cleaning.py first.")
        return

    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    c1, c2 = st.columns(2)
    c1.metric("Total Anomalies Remediated", report["total_anomalies_remediated"])
    c2.metric("Post-Cleaning Quality Score", f"{report['quality_score_pct']}%")

    st.subheader("Validation Checks (Raw -> Processed)")
    st.dataframe(pd.DataFrame(report["checks"]), use_container_width=True)

    st.subheader("Table Record Counts")
    counts_df = pd.DataFrame([
        {"Table": k, "Raw Rows": report["raw_counts"].get(k, 0), "Clean Rows": v}
        for k, v in report["clean_counts"].items()
    ])
    st.dataframe(counts_df, use_container_width=True)
