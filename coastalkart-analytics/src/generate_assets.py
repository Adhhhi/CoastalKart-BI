"""
Generates crisp, data-driven SVG dashboard previews inside assets/ directly from coastalkart.db
for GitHub README showcase.
"""

from __future__ import annotations

import html
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.database import DB_PATH, run_query
from src.forecasting import generate_sales_forecast
from src.metrics import compute_rfm_segments, get_executive_kpis

ASSETS_DIR = ROOT_DIR / "assets"


def generate_svg_previews(assets_dir: Path = ASSETS_DIR, db_path: Path = DB_PATH) -> None:
    assets_dir.mkdir(parents=True, exist_ok=True)
    kpis = get_executive_kpis(db_path=db_path)

    branches = run_query(
        """
        SELECT b.city, ROUND(SUM(s.revenue), 2) AS revenue, ROUND(SUM(s.profit), 2) AS profit
        FROM sales_transactions s JOIN branches b ON s.branch_id = b.branch_id
        WHERE s.order_status = 'Completed'
        GROUP BY b.city ORDER BY revenue DESC
        """,
        db_path=db_path,
    )

    fc = generate_sales_forecast(horizon_months=4, db_path=db_path)
    series = fc["series"]

    # 1. Executive KPI & Monthly Forecast SVG
    W, H = 960, 420
    pad_l, pad_r, pad_t, pad_b = 70, 35, 130, 50
    plot_w = W - pad_l - pad_r
    plot_h = H - pad_t - pad_b

    vals = [
        pt["actual_revenue"] if pt["actual_revenue"] is not None else pt["forecast_revenue"]
        for pt in series
    ]
    max_v = max(vals) * 1.12
    min_v = min(vals) * 0.75

    def px_x(i: int) -> float:
        return pad_l + (i / max(1, len(series) - 1)) * plot_w

    def px_y(v: float) -> float:
        return pad_t + plot_h - ((v - min_v) / max(1.0, max_v - min_v)) * plot_h

    actual_pts = [(px_x(i), px_y(pt["actual_revenue"])) for i, pt in enumerate(series) if pt["actual_revenue"] is not None]
    fc_pts = [(px_x(i), px_y(pt["forecast_revenue"])) for i, pt in enumerate(series) if pt["forecast_revenue"] is not None]
    if actual_pts and fc_pts:
        fc_pts = [actual_pts[-1]] + fc_pts

    actual_path = " ".join(f"{x:.1f},{y:.1f}" for x, y in actual_pts)
    fc_path = " ".join(f"{x:.1f},{y:.1f}" for x, y in fc_pts)

    kpi_cards = [
        ("Total Revenue", f"INR {kpis['total_revenue']/1e7:.2f} Cr"),
        ("Net Profit", f"INR {kpis['total_profit']/1e5:.2f} L"),
        ("Total Orders", f"{kpis['total_orders']:,}"),
        ("Profit Margin", f"{kpis['profit_margin_pct']}%"),
        ("Avg Order Value", f"INR {kpis['average_order_value']:,.0f}"),
    ]
    cards_svg = []
    cw = (W - 60) / 5
    for idx, (lbl, val) in enumerate(kpi_cards):
        cx = 20 + idx * (cw + 5)
        cards_svg.append(
            f'<rect x="{cx:.1f}" y="52" width="{cw:.1f}" height="56" rx="8" fill="#FFFFFF" stroke="#E2E8F0"/>'
            f'<text x="{cx+12:.1f}" y="72" font-family="sans-serif" font-size="11" fill="#64748B">{html.escape(lbl)}</text>'
            f'<text x="{cx+12:.1f}" y="95" font-family="monospace" font-size="15" font-weight="bold" fill="#0F172A">{html.escape(val)}</text>'
        )

    x_labels = []
    for i, pt in enumerate(series):
        if i % 2 == 0 or i == len(series) - 1:
            x_labels.append(
                f'<text x="{px_x(i):.1f}" y="{H - 18}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#64748B">{pt["month"][2:]}</text>'
            )

    svg_exec = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" fill="#F8FAFC" rx="12"/>
  <rect x="0" y="0" width="{W}" height="40" fill="#0F2942" rx="8"/>
  <text x="20" y="25" font-family="sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">CoastalKart BI — Executive KPIs &amp; 4-Month Revenue Forecast</text>
  {"".join(cards_svg)}
  <rect x="20" y="118" width="{W-40}" height="{H-130}" rx="8" fill="#FFFFFF" stroke="#E2E8F0"/>
  <polyline fill="none" stroke="#0F2942" stroke-width="3" points="{actual_path}"/>
  <polyline fill="none" stroke="#1D4ED8" stroke-width="3" stroke-dasharray="6,4" points="{fc_path}"/>
  {"".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="#0F2942"/>' for x, y in actual_pts)}
  {"".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="#1D4ED8"/>' for x, y in fc_pts[1:])}
  {"".join(x_labels)}
  <text x="{W-220}" y="140" font-family="sans-serif" font-size="11" fill="#0F2942">━ Actual Revenue</text>
  <text x="{W-115}" y="140" font-family="sans-serif" font-size="11" fill="#1D4ED8">┈ Forecast (R²={fc['r2_score']})</text>
</svg>"""
    (assets_dir / "executive_overview.svg").write_text(svg_exec, encoding="utf-8")

    # 2. Branch Performance & RFM Segments SVG
    W2, H2 = 960, 360
    rfm = compute_rfm_segments(db_path=db_path)
    seg_totals = {}
    for r in rfm:
        seg = r["rfm_segment"]
        seg_totals[seg] = seg_totals.get(seg, 0.0) + r["monetary"]
    seg_list = sorted(seg_totals.items(), key=lambda x: x[1], reverse=True)

    max_br = max(b["revenue"] for b in branches) or 1
    br_bars = []
    for idx, b in enumerate(branches):
        y = 75 + idx * 42
        bw = (b["revenue"] / max_br) * 260
        br_bars.append(
            f'<text x="36" y="{y+16}" font-family="sans-serif" font-size="12" fill="#1E293B">{html.escape(b["city"])}</text>'
            f'<rect x="125" y="{y}" width="{bw:.1f}" height="22" rx="4" fill="#0F2942"/>'
            f'<text x="{132+bw:.1f}" y="{y+16}" font-family="monospace" font-size="11" fill="#334155">₹{b["revenue"]/1e5:.1f}L</text>'
        )

    max_seg = max(v for _, v in seg_list) or 1
    seg_bars = []
    for idx, (seg, rev) in enumerate(seg_list):
        y = 75 + idx * 42
        sw = (rev / max_seg) * 230
        seg_bars.append(
            f'<text x="515" y="{y+16}" font-family="sans-serif" font-size="11" fill="#1E293B">{html.escape(seg)}</text>'
            f'<rect x="640" y="{y}" width="{sw:.1f}" height="22" rx="4" fill="#0D9488"/>'
            f'<text x="{647+sw:.1f}" y="{y+16}" font-family="monospace" font-size="11" fill="#334155">₹{rev/1e5:.1f}L</text>'
        )

    svg_br = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W2}" height="{H2}" viewBox="0 0 {W2} {H2}">
  <rect width="{W2}" height="{H2}" fill="#F8FAFC" rx="12"/>
  <rect x="20" y="20" width="445" height="320" rx="8" fill="#FFFFFF" stroke="#E2E8F0"/>
  <text x="36" y="48" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0F172A">Revenue by Branch (Karnataka &amp; Kerala)</text>
  {"".join(br_bars)}
  <rect x="495" y="20" width="445" height="320" rx="8" fill="#FFFFFF" stroke="#E2E8F0"/>
  <text x="515" y="48" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0F172A">RFM Customer Segment Revenue</text>
  {"".join(seg_bars)}
</svg>"""
    (assets_dir / "branch_and_rfm.svg").write_text(svg_br, encoding="utf-8")


if __name__ == "__main__":
    generate_svg_previews()
    print("Generated SVG dashboard assets in", ASSETS_DIR)
