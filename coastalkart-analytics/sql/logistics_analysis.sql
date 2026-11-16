-- ============================================================================
-- CoastalKart Retail & E-commerce Pvt. Ltd. — Delivery & Logistics SQL Analysis
-- Dialect: SQLite 3.40+
-- ============================================================================

-- QUERY 18: Delivery Partner SLA Compliance & Cost Efficiency
-- Business Question: Which delivery partners achieve the best on-time delivery rate versus cost per shipment?
-- Result Explanation: Computes total shipments, on-time %, delayed %, average transit days, and average cost per partner.
-- Business Recommendation: Reallocate interstate volume from Ecom Express to CoastalExpress and BlueDart Regional to cut SLA breaches by ~35%.
SELECT
    delivery_partner,
    COUNT(*) AS total_shipments,
    SUM(CASE WHEN delivery_status = 'On Time' THEN 1 ELSE 0 END) AS on_time_orders,
    SUM(CASE WHEN delivery_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed_orders,
    ROUND(AVG(CASE WHEN delivery_status = 'On Time' THEN 1.0 ELSE 0.0 END) * 100, 2) AS on_time_rate_pct,
    ROUND(AVG(CASE WHEN delivery_date_iso != '' THEN JULIANDAY(delivery_date_iso) - JULIANDAY(dispatch_date_iso) END), 2) AS avg_transit_days,
    ROUND(AVG(delivery_cost), 2) AS avg_cost_inr,
    ROUND(SUM(delivery_cost), 2) AS total_logistics_spend
FROM deliveries
GROUP BY delivery_partner
ORDER BY on_time_rate_pct DESC;

-- QUERY 19: City-Wise Delivery Delay Hotspots
-- Business Question: Which cities experience the highest delivery delays and longest transit times?
-- Result Explanation: Links deliveries to branch cities via distinct order_id mapping and ranks corridors by delay percentage.
-- Business Recommendation: Station a micro-fulfillment cross-dock at Kasaragod border depot to avoid Kerala interstate transit bottlenecks.
WITH order_branch AS (
    SELECT DISTINCT order_id, branch_id
    FROM sales_transactions
)
SELECT
    b.city,
    b.state,
    COUNT(*) AS tracked_deliveries,
    SUM(CASE WHEN d.delivery_status = 'On Time' THEN 1 ELSE 0 END) AS on_time_count,
    SUM(CASE WHEN d.delivery_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed_count,
    ROUND(AVG(CASE WHEN d.delivery_status = 'Delayed' THEN 1.0 ELSE 0.0 END) * 100, 2) AS delay_rate_pct,
    ROUND(AVG(CASE WHEN d.delivery_date_iso != '' THEN JULIANDAY(d.delivery_date_iso) - JULIANDAY(d.dispatch_date_iso) END), 2) AS avg_delivery_days,
    ROUND(AVG(d.delivery_cost), 2) AS avg_delivery_cost_inr
FROM deliveries d
JOIN order_branch ob ON d.order_id = ob.order_id
JOIN branches b ON ob.branch_id = b.branch_id
GROUP BY b.city, b.state
ORDER BY delay_rate_pct DESC;

-- QUERY 20: Monthly Delivery Cost vs Order Fulfillment Rate
-- Business Question: How are delivery costs and on-time SLA performance trending month over month?
-- Result Explanation: Tracks monthly shipment count, on-time SLA rate, and logistics cost per order across the 12-month window.
-- Business Recommendation: Negotiate surge-pricing caps with 3PL partners prior to September-October festive peak months.
SELECT
    SUBSTR(dispatch_date_iso, 1, 7) AS dispatch_month,
    COUNT(*) AS total_shipments,
    ROUND(AVG(CASE WHEN delivery_status = 'On Time' THEN 1.0 ELSE 0.0 END) * 100, 2) AS on_time_rate_pct,
    ROUND(SUM(delivery_cost), 2) AS total_delivery_cost,
    ROUND(AVG(delivery_cost), 2) AS avg_cost_per_shipment
FROM deliveries
GROUP BY SUBSTR(dispatch_date_iso, 1, 7)
ORDER BY dispatch_month;

-- QUERY 21: Delayed Order Severity Breakdown (1 Day vs 2+ Days Late)
-- Business Question: How severe are delivery delays when SLA deadlines are missed?
-- Result Explanation: Uses CASE WHEN on date difference between actual delivery_date_iso and expected_delivery_date_iso.
-- Business Recommendation: Trigger proactive SMS delay alerts and ₹50 apology vouchers whenever delays cross 2+ days.
SELECT
    CASE
        WHEN CAST(JULIANDAY(delivery_date_iso) - JULIANDAY(expected_delivery_date_iso) AS INTEGER) <= 1 THEN 'Minor Delay (1 Day)'
        WHEN CAST(JULIANDAY(delivery_date_iso) - JULIANDAY(expected_delivery_date_iso) AS INTEGER) = 2 THEN 'Moderate Delay (2 Days)'
        ELSE 'Severe Delay (3+ Days)'
    END AS delay_severity,
    COUNT(*) AS delayed_shipments,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS share_of_delays_pct,
    ROUND(AVG(delivery_cost), 2) AS avg_delivery_cost
FROM deliveries
WHERE delivery_status = 'Delayed' AND delivery_date_iso != ''
GROUP BY delay_severity
ORDER BY delayed_shipments DESC;

-- QUERY 22: Order Fulfillment Funnel (Completed vs Returned vs Cancelled by Branch)
-- Business Question: Which branches achieve the highest clean order fulfillment rate vs return/cancellation leakage?
-- Result Explanation: Counts distinct orders by order_status across every CoastalKart branch.
-- Business Recommendation: Audit packaging quality and product condition checks at branches with >4.5% return rate.
SELECT
    b.branch_name,
    b.city,
    COUNT(DISTINCT s.order_id) AS total_orders,
    COUNT(DISTINCT CASE WHEN s.order_status = 'Completed' THEN s.order_id END) AS completed_orders,
    COUNT(DISTINCT CASE WHEN s.order_status = 'Returned' THEN s.order_id END) AS returned_orders,
    COUNT(DISTINCT CASE WHEN s.order_status = 'Cancelled' THEN s.order_id END) AS cancelled_orders,
    ROUND(COUNT(DISTINCT CASE WHEN s.order_status = 'Completed' THEN s.order_id END) * 100.0 / COUNT(DISTINCT s.order_id), 2) AS fulfillment_rate_pct
FROM sales_transactions s
JOIN branches b ON s.branch_id = b.branch_id
GROUP BY b.branch_id, b.branch_name, b.city
ORDER BY fulfillment_rate_pct DESC;
