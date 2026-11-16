-- ============================================================================
-- CoastalKart Retail & E-commerce Pvt. Ltd. — Inventory & Supplier SQL Analysis
-- Dialect: SQLite 3.40+
-- ============================================================================

-- QUERY 13: Branch-Wise Stock Health & Working Capital Value
-- Business Question: How much inventory capital is held at each branch, and where are stockouts vs overstocks concentrated?
-- Result Explanation: Joins inventory with products and branches to report stock cost value and counts by stock_status.
-- Business Recommendation: Rebalance overstocked Mysuru/Kasaragod SKUs toward Mangaluru & Bengaluru hubs before issuing fresh supplier POs.
SELECT
    b.branch_name,
    b.city,
    COUNT(*) AS total_skus,
    SUM(CASE WHEN i.stock_status = 'Out of Stock' THEN 1 ELSE 0 END) AS out_of_stock_skus,
    SUM(CASE WHEN i.stock_status = 'Low Stock' THEN 1 ELSE 0 END) AS low_stock_skus,
    SUM(CASE WHEN i.stock_status = 'Overstocked' THEN 1 ELSE 0 END) AS overstocked_skus,
    ROUND(SUM(i.stock_quantity * p.cost_price), 2) AS stock_cost_value_inr
FROM inventory i
JOIN branches b ON i.branch_id = b.branch_id
JOIN products p ON i.product_id = p.product_id
GROUP BY b.branch_id, b.branch_name, b.city
ORDER BY stock_cost_value_inr DESC;

-- QUERY 14: Urgent Reorder Queue for High-Velocity Out-of-Stock / Low-Stock Items
-- Business Question: Which out-of-stock or low-stock SKUs have the highest historical sales demand and need immediate replenishment?
-- Result Explanation: Joins inventory shortages with historical 12-month sales velocity and supplier lead time to prioritize procurement.
-- Business Recommendation: Issue priority purchase orders for the top 20 high-velocity Grocery & Household items with lead time > 5 days.
WITH sku_demand AS (
    SELECT
        product_id,
        branch_id,
        SUM(quantity) AS annual_units_sold,
        ROUND(SUM(revenue), 2) AS annual_revenue
    FROM sales_transactions
    WHERE order_status = 'Completed'
    GROUP BY product_id, branch_id
)
SELECT
    b.city,
    p.product_id,
    p.product_name,
    p.category,
    i.stock_quantity,
    i.reorder_level,
    i.stock_status,
    COALESCE(d.annual_units_sold, 0) AS annual_units_sold,
    sup.supplier_name,
    sup.lead_time AS supplier_lead_days,
    (i.reorder_level * 3 - i.stock_quantity) AS recommended_order_qty
FROM inventory i
JOIN products p ON i.product_id = p.product_id
JOIN branches b ON i.branch_id = b.branch_id
JOIN suppliers sup ON p.supplier_id = sup.supplier_id
LEFT JOIN sku_demand d ON i.product_id = d.product_id AND i.branch_id = d.branch_id
WHERE i.stock_status IN ('Out of Stock', 'Low Stock')
ORDER BY annual_units_sold DESC, i.stock_quantity ASC
LIMIT 20;

-- QUERY 15: Inventory Turnover Ratio by Product Category
-- Business Question: Which categories turn inventory fastest and which tie up excess working capital?
-- Result Explanation: Compares annual COGS from completed sales against average ending inventory cost value per category.
-- Business Recommendation: Tighten safety-stock multipliers on Fashion & Lifestyle items where turnover lags Grocery by >2x.
WITH category_cogs AS (
    SELECT p.category, ROUND(SUM(s.cost_total), 2) AS annual_cogs
    FROM sales_transactions s
    JOIN products p ON s.product_id = p.product_id
    WHERE s.order_status = 'Completed'
    GROUP BY p.category
),
category_stock AS (
    SELECT p.category, ROUND(SUM(i.stock_quantity * p.cost_price), 2) AS inventory_value
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    GROUP BY p.category
)
SELECT
    c.category,
    c.annual_cogs,
    s.inventory_value,
    ROUND(c.annual_cogs / NULLIF(s.inventory_value, 0), 2) AS turnover_ratio
FROM category_cogs c
JOIN category_stock s ON c.category = s.category
ORDER BY turnover_ratio DESC;

-- QUERY 16: Supplier Performance Ranking (Revenue Supplied vs Lead Time & Rating)
-- Business Question: Which suppliers deliver the highest revenue impact alongside reliable ratings and fast lead times?
-- Result Explanation: Aggregates SKU sales back to each supplier and ranks suppliers by fulfilled revenue and rating.
-- Business Recommendation: Consolidate slow-lead-time (<3.8 rated) vendors into top-rated coastal distributors for faster replenishment.
SELECT
    sup.supplier_id,
    sup.supplier_name,
    sup.supplier_location,
    sup.product_category,
    sup.lead_time,
    sup.supplier_rating,
    COUNT(DISTINCT p.product_id) AS active_skus,
    ROUND(COALESCE(SUM(s.revenue), 0), 2) AS total_revenue_generated,
    RANK() OVER (ORDER BY COALESCE(SUM(s.revenue), 0) DESC) AS revenue_rank
FROM suppliers sup
JOIN products p ON sup.supplier_id = p.supplier_id
LEFT JOIN sales_transactions s ON p.product_id = s.product_id AND s.order_status = 'Completed'
GROUP BY sup.supplier_id, sup.supplier_name, sup.supplier_location, sup.product_category, sup.lead_time, sup.supplier_rating
ORDER BY total_revenue_generated DESC
LIMIT 15;

-- QUERY 17: Overstocked Slow-Moving Capital Report
-- Business Question: Which overstocked items carry the highest locked capital with low sales velocity?
-- Result Explanation: Identifies SKU-branch records flagged Overstocked (>5x reorder level) sorted by locked stock value.
-- Business Recommendation: Run targeted 10% weekend bundle clearances on the top 15 overstocked items to release working capital.
SELECT
    b.city,
    p.product_id,
    p.product_name,
    p.category,
    i.stock_quantity,
    i.reorder_level,
    ROUND(i.stock_quantity * p.cost_price, 2) AS locked_capital_inr
FROM inventory i
JOIN products p ON i.product_id = p.product_id
JOIN branches b ON i.branch_id = b.branch_id
WHERE i.stock_status = 'Overstocked'
ORDER BY locked_capital_inr DESC
LIMIT 15;
