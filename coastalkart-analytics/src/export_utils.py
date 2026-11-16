"""
CoastalKart Retail & E-commerce Pvt. Ltd. — Streamlit Export Utilities
Provides CSV, styled Excel (.xlsx), and formatted PDF download payloads.
"""

from __future__ import annotations

import io
from typing import Any, Dict, List

import pandas as pd


def df_to_excel_bytes(df: pd.DataFrame, sheet_name: str = "Data") -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=sheet_name[:31])
        ws = writer.sheets[sheet_name[:31]]
        for col in ws.columns:
            max_len = max(len(str(c.value or "")) for c in col)
            ws.column_dimensions[col[0].column_letter].width = min(40, max(12, max_len + 3))
    return buf.getvalue()


def df_to_pdf_bytes(title: str, subtitle: str, df: pd.DataFrame, max_rows: int = 40) -> bytes:
    from fpdf import FPDF  # type: ignore

    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    pdf.set_fill_color(15, 41, 66)
    pdf.rect(0, 0, 297, 22, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_xy(10, 5)
    pdf.cell(0, 6, f"CoastalKart Retail & E-commerce Pvt. Ltd. - {title}", ln=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_x(10)
    pdf.cell(0, 5, f"{subtitle} | Simulated Case Study", ln=True)

    pdf.set_y(28)
    pdf.set_text_color(15, 23, 42)
    cols = list(df.columns)[:8]
    col_w = 275 / max(1, len(cols))

    pdf.set_fill_color(30, 58, 95)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 7)
    for c in cols:
        pdf.cell(col_w, 7, str(c)[:22], border=1, fill=True)
    pdf.ln()

    pdf.set_text_color(15, 23, 42)
    pdf.set_font("Helvetica", "", 7)
    for _, row in df.head(max_rows).iterrows():
        for c in cols:
            val = str(row[c]).replace("₹", "INR ")[:24]
            pdf.cell(col_w, 6, val, border=1)
        pdf.ln()

    raw_out = pdf.output(dest="S")
    return raw_out.encode("latin-1") if isinstance(raw_out, str) else bytes(raw_out)
