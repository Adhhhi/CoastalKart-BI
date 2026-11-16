"""
CoastalKart Retail & E-commerce Pvt. Ltd. — Multi-Sheet Excel BI Workbook Generator
Generates a formatted executive workbook (assets/CoastalKart_Executive_Report.xlsx)
with 5 sheets: Executive_KPIs, Branch_Performance, RFM_Cohorts, Reorder_Alerts, Delivery_SLA.
Uses openpyxl when installed; includes a pure-Python OOXML fallback for minimal environments.
"""

from __future__ import annotations

import datetime as dt
import html
import sys
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.database import DB_PATH, run_query
from src.metrics import compute_rfm_segments, get_executive_kpis

DEFAULT_OUTPUT = ROOT_DIR / "assets" / "CoastalKart_Executive_Report.xlsx"


def _collect_workbook_sheets(db_path: Path = DB_PATH) -> List[Tuple[str, List[str], List[List[Any]]]]:
    kpis = get_executive_kpis(db_path=db_path)
    kpi_rows = [
        ["Total Completed Revenue (INR)", kpis["total_revenue"], "12-month completed net sales"],
        ["Total Net Profit (INR)", kpis["total_profit"], "After GST & COGS deductions"],
        ["Total Orders", kpis["total_orders"], "Distinct order IDs"],
        ["Active Customers", kpis["active_customers"], "Unique transacting customers"],
        ["Average Order Value (INR)", kpis["average_order_value"], "Revenue / Completed Orders"],
        ["Net Profit Margin (%)", kpis["profit_margin_pct"], "Net Profit / Completed Revenue"],
        ["MoM Revenue Growth (%)", kpis["mom_revenue_growth_pct"], "Latest month vs prior month"],
    ]

    branches = run_query(
        """
        SELECT
            b.branch_id,
            b.branch_name,
            b.city,
            b.region,
            COUNT(DISTINCT s.order_id) AS orders,
            ROUND(SUM(s.revenue), 2) AS revenue_inr,
            ROUND(SUM(s.profit), 2) AS profit_inr,
            ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS margin_pct
        FROM sales_transactions s
        JOIN branches b ON s.branch_id = b.branch_id
        WHERE s.order_status = 'Completed'
        GROUP BY b.branch_id, b.branch_name, b.city, b.region
        ORDER BY revenue_inr DESC
        """,
        db_path=db_path,
    )

    rfm = compute_rfm_segments(db_path=db_path)
    seg_agg: Dict[str, Dict[str, Any]] = {}
    for r in rfm:
        seg = r["rfm_segment"]
        if seg not in seg_agg:
            seg_agg[seg] = {"segment": seg, "customers": 0, "revenue_inr": 0.0, "freq_sum": 0, "rec_sum": 0}
        seg_agg[seg]["customers"] += 1
        seg_agg[seg]["revenue_inr"] += r["monetary"]
        seg_agg[seg]["freq_sum"] += r["frequency"]
        seg_agg[seg]["rec_sum"] += r["recency_days"]

    rfm_rows = []
    for seg, d in sorted(seg_agg.items(), key=lambda x: x[1]["revenue_inr"], reverse=True):
        cnt = max(1, d["customers"])
        rfm_rows.append([
            seg,
            d["customers"],
            round(d["rec_sum"] / cnt, 1),
            round(d["freq_sum"] / cnt, 2),
            round(d["revenue_inr"] / cnt, 2),
            round(d["revenue_inr"], 2),
        ])

    reorder_rows = run_query(
        """
        SELECT
            b.city,
            p.product_id,
            p.product_name,
            p.category,
            i.stock_quantity,
            i.reorder_level,
            i.stock_status,
            sup.supplier_name,
            sup.lead_time AS lead_time_days,
            MAX(0, (i.reorder_level * 3 - i.stock_quantity)) AS recommended_po_qty
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN branches b ON i.branch_id = b.branch_id
        JOIN suppliers sup ON p.supplier_id = sup.supplier_id
        WHERE i.stock_status IN ('Out of Stock', 'Low Stock')
        ORDER BY CASE i.stock_status WHEN 'Out of Stock' THEN 1 ELSE 2 END, i.stock_quantity ASC
        LIMIT 100
        """,
        db_path=db_path,
    )

    delivery_rows = run_query(
        """
        SELECT
            delivery_partner,
            COUNT(*) AS shipments,
            SUM(CASE WHEN delivery_status = 'On Time' THEN 1 ELSE 0 END) AS on_time,
            SUM(CASE WHEN delivery_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed,
            ROUND(AVG(CASE WHEN delivery_status = 'On Time' THEN 1.0 ELSE 0.0 END) * 100, 2) AS on_time_pct,
            ROUND(AVG(delivery_cost), 2) AS avg_cost_inr,
            ROUND(SUM(delivery_cost), 2) AS total_cost_inr
        FROM deliveries
        GROUP BY delivery_partner
        ORDER BY on_time_pct DESC
        """,
        db_path=db_path,
    )

    return [
        ("Executive_KPIs", ["Metric", "Value", "Notes"], kpi_rows),
        (
            "Branch_Performance",
            ["Branch ID", "Branch Name", "City", "Region", "Orders", "Revenue (INR)", "Profit (INR)", "Margin %"],
            [[b["branch_id"], b["branch_name"], b["city"], b["region"], b["orders"], b["revenue_inr"], b["profit_inr"], b["margin_pct"]] for b in branches],
        ),
        (
            "RFM_Cohorts",
            ["RFM Segment", "Customers", "Avg Recency (Days)", "Avg Frequency", "Avg CLV (INR)", "Total Revenue (INR)"],
            rfm_rows,
        ),
        (
            "Reorder_Alerts",
            ["City", "Product ID", "Product Name", "Category", "Stock Qty", "Reorder Level", "Status", "Supplier", "Lead Days", "Rec. PO Qty"],
            [[r["city"], r["product_id"], r["product_name"], r["category"], r["stock_quantity"], r["reorder_level"], r["stock_status"], r["supplier_name"], r["lead_time_days"], r["recommended_po_qty"]] for r in reorder_rows],
        ),
        (
            "Delivery_SLA",
            ["Delivery Partner", "Shipments", "On Time", "Delayed", "On-Time %", "Avg Cost (INR)", "Total Spend (INR)"],
            [[d["delivery_partner"], d["shipments"], d["on_time"], d["delayed"], d["on_time_pct"], d["avg_cost_inr"], d["total_cost_inr"]] for d in delivery_rows],
        ),
    ]


def _col_letter(idx: int) -> str:
    res = ""
    n = idx + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        res = chr(65 + rem) + res
    return res


def _write_xlsx_fallback(output_path: Path, sheets: List[Tuple[str, List[str], List[List[Any]]]]) -> None:
    """Minimal valid OOXML .xlsx writer using only Python standard library."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        overrides = "\n".join(
            f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            for i in range(1, len(sheets) + 1)
        )
        zf.writestr(
            "[Content_Types].xml",
            f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
            f'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
            f'<Default Extension="xml" ContentType="application/xml"/>\n'
            f'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\n'
            f'{overrides}\n'
            f'</Types>',
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n'
            '</Relationships>',
        )
        sheet_defs = "\n".join(
            f'<sheet name="{html.escape(name[:31])}" sheetId="{i}" r:id="rId{i}"/>'
            for i, (name, _, _) in enumerate(sheets, start=1)
        )
        zf.writestr(
            "xl/workbook.xml",
            f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            f'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n'
            f'<sheets>{sheet_defs}</sheets></workbook>',
        )
        rels = "\n".join(
            f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
            for i in range(1, len(sheets) + 1)
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>',
        )

        for idx, (_name, headers, rows) in enumerate(sheets, start=1):
            all_rows = [headers] + rows
            row_xml = []
            for r_i, row in enumerate(all_rows, start=1):
                cells = []
                for c_i, val in enumerate(row):
                    ref = f"{_col_letter(c_i)}{r_i}"
                    if isinstance(val, (int, float)) and not isinstance(val, bool):
                        cells.append(f'<c r="{ref}"><v>{val}</v></c>')
                    else:
                        txt = html.escape(str(val if val is not None else ""))
                        cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{txt}</t></is></c>')
                row_xml.append(f'<row r="{r_i}">{"".join(cells)}</row>')
            zf.writestr(
                f"xl/worksheets/sheet{idx}.xml",
                f'<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                f'<sheetData>{"".join(row_xml)}</sheetData></worksheet>',
            )


def generate_executive_workbook(
    output_path: Path = DEFAULT_OUTPUT, db_path: Path = DB_PATH
) -> Path:
    sheets = _collect_workbook_sheets(db_path=db_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        import openpyxl  # type: ignore
        from openpyxl.styles import Alignment, Font, PatternFill  # type: ignore

        wb = openpyxl.Workbook()
        wb.remove(wb.active)

        header_fill = PatternFill(start_color="0F2942", end_color="0F2942", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True, size=10)
        body_font = Font(size=10)

        for name, headers, rows in sheets:
            ws = wb.create_sheet(title=name[:31])
            ws.append(headers)
            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=1, column=col_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="left", vertical="center")
            ws.freeze_panes = "A2"

            for row in rows:
                ws.append(row)
                r_num = ws.max_row
                for col_idx, val in enumerate(row, start=1):
                    c = ws.cell(row=r_num, column=col_idx)
                    c.font = body_font
                    if isinstance(val, (int, float)) and "INR" in headers[col_idx - 1]:
                        c.number_format = "₹#,##0.00"

            for col in ws.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                ws.column_dimensions[col[0].column_letter].width = min(44, max(12, max_len + 4))

        wb.save(output_path)
    except ImportError:
        _write_xlsx_fallback(output_path, sheets)

    return output_path


if __name__ == "__main__":
    out = generate_executive_workbook()
    print(f"[{dt.datetime.now().strftime('%H:%M:%S')}] Generated multi-sheet Excel report: {out}")
