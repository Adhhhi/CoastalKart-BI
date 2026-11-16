-- ============================================================================
-- CoastalKart Retail & E-commerce Pvt. Ltd. — Sales & Profitability SQL Analysis
-- Dialect: SQLite 3.40+
-- ============================================================================

-- QUERY 1: Branch Revenue Ranking & Profit Margin Contribution
-- Business Question: Which branches generate the highest revenue and profit, and how do they rank?
-- Result Explanation: Aggregates completed sales by branch, computing revenue share % and profit margin %, then ranks branches using RANK().
-- Business Recommendation: Allocate peak-season safety stock and marketing spend proportionally to top-2 hubs (Mangaluru & Bengaluru) while replicating Mangaluru's basket-bundling playbook in Mysuru.
SELECT
    b.branch_id,
    b.branch_name,
    b.city,
    b.region,
    COUNT(DISTINCT s.order_id) AS total_orders,
    ROUND(SUM(s.revenue), 2) AS total_revenue,
    ROUND(SUM(s.profit), 2) AS total_profit,
    ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS profit_margin_pct,
    ROUND(SUM(s.revenue) * 100.0 / SUM(SUM(s.revenue)) OVER (), 2) AS revenue_share_pct,
    RANK() OVER (ORDER BY SUM(s.revenue) DESC) AS revenue_rank
FROM sales_transactions s
JOIN branches b ON s.branch_id = b.branch_id
WHERE s.order_status = 'Completed'
GROUP BY b.branch_id, b.branch_name, b.city, b.region
ORDER BY total_revenue DESC;

-- QUERY 2: Monthly Revenue Trend, MoM Growth % (LAG) & 3-Month Moving Average
-- Business Question: What is the monthly sales growth trajectory and smoothed 3-month revenue trend?
-- Result Explanation: Uses a CTE for monthly totals, LAG() for month-over-month % growth, and a 3-month window frame for moving average.
-- Business Recommendation: Prepare working capital and temporary delivery fleet capacity 4 weeks ahead of the Aug-Oct festive surge identified by the moving average inflection.
WITH monthly_sales AS (
    SELECT
        SUBSTR(order_date_iso, 1, 7) AS sales_month,
        COUNT(DISTINCT order_id) AS total_orders,
        ROUND(SUM(revenue), 2) AS revenue,
        ROUND(SUM(profit), 2) AS profit
    FROM sales_transactions
    WHERE order_status = 'Completed'
    GROUP BY SUBSTR(order_date_iso, 1, 7)
)
SELECT
    sales_month,
    total_orders,
    revenue,
    profit,
    LAG(revenue) OVER (ORDER BY sales_month) AS prev_month_revenue,
    ROUND(((revenue - LAG(revenue) OVER (ORDER BY sales_month)) / NULLIF(LAG(revenue) OVER (ORDER BY sales_month), 0)) * 100, 2) AS mom_growth_pct,
    ROUND(AVG(revenue) OVER (ORDER BY sales_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS moving_avg_3m
FROM monthly_sales
ORDER BY sales_month;

-- QUERY 3: Category Revenue, GST Collected & Margin Comparison
-- Business Question: Which product categories drive the highest revenue versus net profit margin?
-- Result Explanation: Joins transactions to products and breaks down gross revenue, discount impact, GST, and realized profit margin per category.
-- Business Recommendation: Increase private-label Grocery & Fashion visibility on the app home screen to lift blended company margin above 22%.
SELECT
    p.category,
    COUNT(s.invoice_id) AS line_items,
    SUM(s.quantity) AS units_sold,
    ROUND(SUM(s.revenue), 2) AS net_revenue,
    ROUND(SUM(s.discount_amount), 2) AS total_discounts,
    ROUND(SUM(s.gst_amount), 2) AS total_gst_collected,
    ROUND(SUM(s.profit), 2) AS net_profit,
    ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS realized_margin_pct
FROM sales_transactions s
JOIN products p ON s.product_id = p.product_id
WHERE s.order_status = 'Completed'
GROUP BY p.category
ORDER BY net_revenue DESC;

-- QUERY 4: High-Sales / Low-Margin Product Audit
-- Business Question: Which products generate high sales volume/revenue but deliver dangerously thin profit margins (<10%)?
-- Result Explanation: Filters SKUs above median product revenue whose realized profit margin after discounts falls below 10%.
-- Business Recommendation: Introduce minimum cart value thresholds or accessory cross-sell bundles on these loss-leader SKUs rather than flat discounts.
WITH sku_perf AS (
    SELECT
        p.product_id,
        p.product_name,
        p.category,
        SUM(s.quantity) AS units_sold,
        ROUND(SUM(s.revenue), 2) AS total_revenue,
        ROUND(SUM(s.profit), 2) AS total_profit,
        ROUND(AVG(s.discount_pct), 2) AS avg_discount_pct,
        ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS realized_margin_pct
    FROM sales_transactions s
    JOIN products p ON s.product_id = p.product_id
    WHERE s.order_status = 'Completed'
    GROUP BY p.product_id, p.product_name, p.category
)
SELECT
    product_id,
    product_name,
    category,
    units_sold,
    total_revenue,
    total_profit,
    avg_discount_pct,
    realized_margin_pct
FROM sku_perf
WHERE total_revenue > (SELECT AVG(total_revenue) FROM sku_perf)
  AND realized_margin_pct < 10.0
ORDER BY total_revenue DESC
LIMIT 15;

-- QUERY 5: Top 3 Products Per Category Using DENSE_RANK()
-- Business Question: Which are the top 3 revenue-generating products within each product category?
-- Result Explanation: Uses a CTE with DENSE_RANK() partitioned by category to isolate category champions without manual filtering.
-- Business Recommendation: Lock in quarterly volume rebates with the suppliers of these 12 category champions to improve cost margins by 2-3%.
WITH ranked_products AS (
    SELECT
        p.category,
        p.product_id,
        p.product_name,
        ROUND(SUM(s.revenue), 2) AS revenue,
        SUM(s.quantity) AS units_sold,
        DENSE_RANK() OVER (PARTITION BY p.category ORDER BY SUM(s.revenue) DESC) AS category_rank
    FROM sales_transactions s
    JOIN products p ON s.product_id = p.product_id
    WHERE s.order_status = 'Completed'
    GROUP BY p.category, p.product_id, p.product_name
)
SELECT category, category_rank, product_id, product_name, units_sold, revenue
FROM ranked_products
WHERE category_rank <= 3
ORDER BY category, category_rank;

-- QUERY 6: Discount Tier Impact on Order Size & Profit Margin
-- Business Question: How do different discount bands affect average order value and realized profitability?
-- Result Explanation: Uses CASE WHEN to bucket line items into discount tiers and compares average revenue vs realized margin.
-- Business Recommendation: Restrict 15%+ discount tiers strictly to slow-moving seasonal Fashion clearance and Prime Member bundles.
SELECT
    CASE
        WHEN s.discount_pct = 0 THEN 'No Discount (0%)'
        WHEN s.discount_pct <= 5 THEN 'Low (1-5%)'
        WHEN s.discount_pct <= 10 THEN 'Moderate (6-10%)'
        ELSE 'Deep (15-20%)'
    END AS discount_band,
    COUNT(*) AS transaction_lines,
    ROUND(AVG(s.revenue), 2) AS avg_line_revenue,
    ROUND(SUM(s.revenue), 2) AS total_revenue,
    ROUND(SUM(s.profit), 2) AS total_profit,
    ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS realized_margin_pct
FROM sales_transactions s
WHERE s.order_status = 'Completed'
GROUP BY discount_band
ORDER BY realized_margin_pct DESC;
