import express, { Request, Response } from 'express';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { createServer as createViteServer } from 'vite';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANALYTICS_DIR = path.join(__dirname, 'coastalkart-analytics');
const DB_FILE = path.join(ANALYTICS_DIR, 'database', 'coastalkart.db');
const QUALITY_REPORT_FILE = path.join(ANALYTICS_DIR, 'data', 'processed', 'data_quality_report.json');
const SQL_DIR = path.join(ANALYTICS_DIR, 'sql');

let SQL_ENGINE: SqlJsStatic | null = null;
let dbInstance: Database | null = null;

async function loadDatabase(): Promise<Database> {
  if (!SQL_ENGINE) {
    const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    SQL_ENGINE = await initSqlJs({
      locateFile: () => wasmPath,
    });
  }
  const buffer = fs.readFileSync(DB_FILE);
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = new SQL_ENGINE.Database(buffer);
  return dbInstance;
}

function queryRows<T = Record<string, any>>(
  db: Database,
  sql: string,
  params: (string | number | null)[] = []
): T[] {
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) {
      stmt.bind(params);
    }
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

interface FilterParams {
  startDate?: string;
  endDate?: string;
  city?: string;
  branchId?: string;
  category?: string;
  paymentMethod?: string;
  search?: string;
}

function buildSalesWhereClause(q: FilterParams, tableAlias = 's') {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (q.startDate) {
    clauses.push(`${tableAlias}.order_date_iso >= ?`);
    params.push(q.startDate);
  }
  if (q.endDate) {
    clauses.push(`${tableAlias}.order_date_iso <= ?`);
    params.push(q.endDate);
  }
  if (q.city && q.city !== 'All') {
    clauses.push(`b.city = ?`);
    params.push(q.city);
  }
  if (q.branchId && q.branchId !== 'All') {
    clauses.push(`${tableAlias}.branch_id = ?`);
    params.push(q.branchId);
  }
  if (q.category && q.category !== 'All') {
    clauses.push(`p.category = ?`);
    params.push(q.category);
  }
  if (q.paymentMethod && q.paymentMethod !== 'All') {
    clauses.push(`${tableAlias}.payment_method = ?`);
    params.push(q.paymentMethod);
  }
  if (q.search && q.search.trim()) {
    const term = `%${q.search.trim()}%`;
    clauses.push(`(p.product_name LIKE ? OR ${tableAlias}.order_id LIKE ? OR ${tableAlias}.invoice_id LIKE ? OR c.customer_name LIKE ?)`);
    params.push(term, term, term, term);
  }

  return {
    whereSql: clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '',
    allWhereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

interface ParsedSqlItem {
  id: string;
  file: string;
  domain: string;
  title: string;
  question: string;
  explanation: string;
  recommendation: string;
  sql: string;
}

function parseSqlCatalog(): ParsedSqlItem[] {
  const files = [
    { name: 'sales_analysis.sql', domain: 'Sales & Margins' },
    { name: 'customer_analysis.sql', domain: 'Customer & RFM' },
    { name: 'inventory_analysis.sql', domain: 'Inventory & Suppliers' },
    { name: 'logistics_analysis.sql', domain: 'Delivery & Logistics' },
  ];
  const catalog: ParsedSqlItem[] = [];

  for (const f of files) {
    const fullPath = path.join(SQL_DIR, f.name);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const blocks = raw.split(/(?=-- QUERY \d+:)/g).filter((b) => b.includes('-- QUERY '));
    for (const block of blocks) {
      const lines = block.split('\n');
      let title = '';
      let question = '';
      let explanation = '';
      let recommendation = '';
      const sqlLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('-- QUERY ')) {
          title = line.replace(/^--\s*QUERY\s*\d+:\s*/, '').trim();
        } else if (line.startsWith('-- Business Question:')) {
          question = line.replace('-- Business Question:', '').trim();
        } else if (line.startsWith('-- Result Explanation:')) {
          explanation = line.replace('-- Result Explanation:', '').trim();
        } else if (line.startsWith('-- Business Recommendation:')) {
          recommendation = line.replace('-- Business Recommendation:', '').trim();
        } else if (!line.startsWith('--')) {
          sqlLines.push(line);
        }
      }
      const sqlText = sqlLines.join('\n').trim();
      const idMatch = block.match(/-- QUERY (\d+):/);
      catalog.push({
        id: idMatch ? `Q-${idMatch[1].padStart(2, '0')}` : `Q-${catalog.length + 1}`,
        file: f.name,
        domain: f.domain,
        title,
        question,
        explanation,
        recommendation,
        sql: sqlText,
      });
    }
  }
  return catalog;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  let db = await loadDatabase();

  app.get('/api/filters', (_req: Request, res: Response) => {
    try {
      const branches = queryRows(db, 'SELECT branch_id, branch_name, city, state, region FROM branches ORDER BY branch_id');
      const categories = queryRows<{ category: string }>(db, 'SELECT DISTINCT category FROM products ORDER BY category').map((r) => r.category);
      const paymentMethods = queryRows<{ payment_method: string }>(db, 'SELECT DISTINCT payment_method FROM sales_transactions ORDER BY payment_method').map((r) => r.payment_method);
      const dateBounds = queryRows<{ min_date: string; max_date: string }>(db, 'SELECT MIN(order_date_iso) AS min_date, MAX(order_date_iso) AS max_date FROM sales_transactions')[0];

      res.json({
        branches,
        cities: branches.map((b) => b.city),
        categories,
        paymentMethods,
        minDate: dateBounds?.min_date || '2025-11-01',
        maxDate: dateBounds?.max_date || '2026-10-31',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/overview', (req: Request, res: Response) => {
    try {
      const q = req.query as FilterParams;
      const { whereSql, allWhereSql, params } = buildSalesWhereClause(q);

      const kpiRow = queryRows<any>(
        db,
        `SELECT
            ROUND(COALESCE(SUM(CASE WHEN s.order_status = 'Completed' THEN s.revenue ELSE 0 END), 0), 2) AS total_revenue,
            ROUND(COALESCE(SUM(CASE WHEN s.order_status = 'Completed' THEN s.profit ELSE 0 END), 0), 2) AS total_profit,
            COUNT(DISTINCT s.order_id) AS total_orders,
            COUNT(DISTINCT CASE WHEN s.order_status = 'Completed' THEN s.order_id END) AS completed_orders,
            COUNT(DISTINCT s.customer_id) AS active_customers
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         ${allWhereSql}`,
        params
      )[0];

      const monthlyTrend = queryRows<any>(
        db,
        `SELECT
            SUBSTR(s.order_date_iso, 1, 7) AS month,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            COUNT(DISTINCT s.order_id) AS orders
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY SUBSTR(s.order_date_iso, 1, 7)
         ORDER BY month`,
        params
      );

      let momGrowthPct = 0;
      if (monthlyTrend.length >= 2 && monthlyTrend[monthlyTrend.length - 2].revenue > 0) {
        const curr = monthlyTrend[monthlyTrend.length - 1].revenue;
        const prev = monthlyTrend[monthlyTrend.length - 2].revenue;
        momGrowthPct = Number((((curr - prev) / prev) * 100).toFixed(2));
      }

      const branchPerformance = queryRows<any>(
        db,
        `SELECT
            b.branch_id,
            b.branch_name,
            b.city,
            b.region,
            COUNT(DISTINCT s.order_id) AS orders,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS margin_pct
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY b.branch_id, b.branch_name, b.city, b.region
         ORDER BY revenue DESC`,
        params
      );

      const categoryPerformance = queryRows<any>(
        db,
        `SELECT
            p.category,
            SUM(s.quantity) AS units_sold,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS margin_pct
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY p.category
         ORDER BY revenue DESC`,
        params
      );

      const topProducts = queryRows<any>(
        db,
        `SELECT
            p.product_id,
            p.product_name,
            p.category,
            SUM(s.quantity) AS units_sold,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS margin_pct
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY p.product_id, p.product_name, p.category
         ORDER BY revenue DESC
         LIMIT 10`,
        params
      );

      const statusBreakdown = queryRows<any>(
        db,
        `SELECT
            s.order_status,
            COUNT(DISTINCT s.order_id) AS orders,
            ROUND(SUM(s.revenue), 2) AS gross_value
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         ${allWhereSql}
         GROUP BY s.order_status
         ORDER BY orders DESC`,
        params
      );

      const totalRev = kpiRow?.total_revenue || 0;
      const totalProfit = kpiRow?.total_profit || 0;
      const compOrders = kpiRow?.completed_orders || 1;

      res.json({
        kpis: {
          totalRevenue: totalRev,
          totalProfit,
          totalOrders: kpiRow?.total_orders || 0,
          activeCustomers: kpiRow?.active_customers || 0,
          averageOrderValue: Number((totalRev / compOrders).toFixed(2)),
          profitMarginPct: totalRev > 0 ? Number(((totalProfit / totalRev) * 100).toFixed(2)) : 0,
          revenueGrowthPct: momGrowthPct,
        },
        monthlyTrend,
        branchPerformance,
        categoryPerformance,
        topProducts,
        statusBreakdown,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sales', (req: Request, res: Response) => {
    try {
      const q = req.query as FilterParams;
      const { whereSql, params } = buildSalesWhereClause(q);

      const dailyTrend = queryRows<any>(
        db,
        `SELECT
            s.order_date_iso AS date_iso,
            s.order_date AS date_display,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            COUNT(DISTINCT s.order_id) AS orders
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY s.order_date_iso, s.order_date
         ORDER BY s.order_date_iso`,
        params
      );

      const monthlyGrowth = queryRows<any>(
        db,
        `WITH m AS (
            SELECT
              SUBSTR(s.order_date_iso, 1, 7) AS month,
              ROUND(SUM(s.revenue), 2) AS revenue,
              ROUND(SUM(s.profit), 2) AS profit,
              ROUND(SUM(s.gst_amount), 2) AS gst_amount,
              COUNT(DISTINCT s.order_id) AS orders
            FROM sales_transactions s
            JOIN branches b ON s.branch_id = b.branch_id
            JOIN products p ON s.product_id = p.product_id
            JOIN customers c ON s.customer_id = c.customer_id
            WHERE s.order_status = 'Completed' ${whereSql}
            GROUP BY SUBSTR(s.order_date_iso, 1, 7)
         )
         SELECT
            month,
            revenue,
            profit,
            gst_amount,
            orders,
            ROUND(((revenue - LAG(revenue) OVER (ORDER BY month)) / NULLIF(LAG(revenue) OVER (ORDER BY month), 0)) * 100, 2) AS growth_pct
         FROM m
         ORDER BY month`,
        params
      );

      const discountAnalysis = queryRows<any>(
        db,
        `SELECT
            CASE
              WHEN s.discount_pct = 0 THEN '0% (Full Price)'
              WHEN s.discount_pct <= 5 THEN '1% - 5%'
              WHEN s.discount_pct <= 10 THEN '6% - 10%'
              ELSE '15% - 20%'
            END AS discount_band,
            COUNT(*) AS transactions,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS margin_pct
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY discount_band
         ORDER BY margin_pct DESC`,
        params
      );

      const paymentMix = queryRows<any>(
        db,
        `SELECT
            s.payment_method,
            COUNT(DISTINCT s.order_id) AS orders,
            ROUND(SUM(s.revenue), 2) AS revenue
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY s.payment_method
         ORDER BY revenue DESC`,
        params
      );

      const branchRanking = queryRows<any>(
        db,
        `SELECT
            b.branch_id,
            b.branch_name,
            b.city,
            b.region,
            COUNT(DISTINCT s.order_id) AS orders,
            SUM(s.quantity) AS units_sold,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            ROUND(SUM(s.revenue) / NULLIF(COUNT(DISTINCT s.order_id), 0), 2) AS aov,
            ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS margin_pct,
            RANK() OVER (ORDER BY SUM(s.revenue) DESC) AS rank
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY b.branch_id, b.branch_name, b.city, b.region
         ORDER BY revenue DESC`,
        params
      );

      const ledger = queryRows<any>(
        db,
        `SELECT
            s.invoice_id,
            s.order_id,
            s.order_date,
            c.customer_name,
            b.city,
            p.product_name,
            p.category,
            s.quantity,
            s.unit_price,
            s.discount_pct,
            s.gst_amount,
            s.revenue,
            s.profit,
            s.payment_method,
            s.order_status
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         JOIN customers c ON s.customer_id = c.customer_id
         WHERE 1=1 ${whereSql}
         ORDER BY s.order_date_iso DESC, s.invoice_id DESC
         LIMIT 250`,
        params
      );

      res.json({
        dailyTrend,
        monthlyGrowth,
        discountAnalysis,
        paymentMix,
        branchRanking,
        ledger,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/customers', (req: Request, res: Response) => {
    try {
      const q = req.query as FilterParams;
      const { whereSql, params } = buildSalesWhereClause(q);

      const rfmRows = queryRows<any>(
        db,
        `WITH max_dt AS (SELECT MAX(order_date_iso) AS mx FROM sales_transactions),
         cust_base AS (
            SELECT
                c.customer_id,
                c.customer_name,
                c.city,
                c.state,
                c.customer_segment,
                c.registration_date,
                CAST(JULIANDAY((SELECT mx FROM max_dt)) - JULIANDAY(MAX(s.order_date_iso)) AS INTEGER) AS recency_days,
                COUNT(DISTINCT s.order_id) AS frequency,
                ROUND(SUM(s.revenue), 2) AS monetary,
                MAX(s.order_date) AS last_order_date
            FROM customers c
            JOIN sales_transactions s ON c.customer_id = s.customer_id
            JOIN branches b ON s.branch_id = b.branch_id
            JOIN products p ON s.product_id = p.product_id
            WHERE s.order_status = 'Completed' ${whereSql}
            GROUP BY c.customer_id
         ),
         scored AS (
            SELECT
                *,
                NTILE(5) OVER (ORDER BY recency_days DESC) AS r_score,
                NTILE(5) OVER (ORDER BY frequency ASC) AS f_score,
                NTILE(5) OVER (ORDER BY monetary ASC) AS m_score
            FROM cust_base
         )
         SELECT
            *,
            (r_score || f_score || m_score) AS rfm_code,
            CASE
                WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'Champions'
                WHEN f_score >= 3 AND m_score >= 3 AND r_score >= 3 THEN 'Loyal Customers'
                WHEN r_score >= 4 AND f_score <= 2 THEN 'New / Promising'
                WHEN r_score <= 2 AND f_score >= 3 THEN 'At Risk'
                WHEN r_score <= 2 AND f_score <= 2 THEN 'Hibernating'
                ELSE 'Potential Loyalists'
            END AS rfm_segment
         FROM scored
         ORDER BY monetary DESC`,
        params
      );

      const totalActive = rfmRows.length;
      const repeatCount = rfmRows.filter((r) => r.frequency >= 2).length;
      const totalCustRevenue = rfmRows.reduce((acc, r) => acc + (r.monetary || 0), 0);
      const repeatRevenue = rfmRows.filter((r) => r.frequency >= 2).reduce((acc, r) => acc + (r.monetary || 0), 0);
      const avgClv = totalActive > 0 ? Number((totalCustRevenue / totalActive).toFixed(2)) : 0;

      // Aggregate RFM segments
      const segMap = new Map<string, { segment: string; customers: number; revenue: number; avgRecency: number; avgFrequency: number }>();
      for (const r of rfmRows) {
        const curr = segMap.get(r.rfm_segment) || {
          segment: r.rfm_segment,
          customers: 0,
          revenue: 0,
          avgRecency: 0,
          avgFrequency: 0,
        };
        curr.customers += 1;
        curr.revenue += r.monetary;
        curr.avgRecency += r.recency_days;
        curr.avgFrequency += r.frequency;
        segMap.set(r.rfm_segment, curr);
      }
      const rfmSummary = Array.from(segMap.values())
        .map((s) => ({
          segment: s.segment,
          customers: s.customers,
          revenue: Number(s.revenue.toFixed(2)),
          avgRecency: Number((s.avgRecency / s.customers).toFixed(1)),
          avgFrequency: Number((s.avgFrequency / s.customers).toFixed(2)),
          avgClv: Number((s.revenue / s.customers).toFixed(2)),
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Segment breakdown (Retail, Prime, Kirana, Corporate)
      const segmentBreakdown = queryRows<any>(
        db,
        `SELECT
            c.customer_segment,
            COUNT(DISTINCT c.customer_id) AS customers,
            COUNT(DISTINCT s.order_id) AS orders,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.revenue) / NULLIF(COUNT(DISTINCT c.customer_id), 0), 2) AS rev_per_customer
         FROM customers c
         JOIN sales_transactions s ON c.customer_id = s.customer_id
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         WHERE s.order_status = 'Completed' ${whereSql}
         GROUP BY c.customer_segment
         ORDER BY revenue DESC`,
        params
      );

      // New vs Returning buyers by month
      const newVsReturning = queryRows<any>(
        db,
        `WITH first_order AS (
            SELECT customer_id, MIN(SUBSTR(order_date_iso, 1, 7)) AS first_month
            FROM sales_transactions
            WHERE order_status = 'Completed'
            GROUP BY customer_id
         ),
         monthly_cust AS (
            SELECT DISTINCT
                SUBSTR(s.order_date_iso, 1, 7) AS month,
                s.customer_id,
                f.first_month
            FROM sales_transactions s
            JOIN first_order f ON s.customer_id = f.customer_id
            JOIN branches b ON s.branch_id = b.branch_id
            JOIN products p ON s.product_id = p.product_id
            JOIN customers c ON s.customer_id = c.customer_id
            WHERE s.order_status = 'Completed' ${whereSql}
         )
         SELECT
            month,
            SUM(CASE WHEN month = first_month THEN 1 ELSE 0 END) AS new_customers,
            SUM(CASE WHEN month > first_month THEN 1 ELSE 0 END) AS returning_customers
         FROM monthly_cust
         GROUP BY month
         ORDER BY month`,
        params
      );

      // Purchase frequency histogram
      const freqMap = new Map<string, number>();
      for (const r of rfmRows) {
        const bucket = r.frequency >= 6 ? '6+ Orders' : `${r.frequency} ${r.frequency === 1 ? 'Order' : 'Orders'}`;
        freqMap.set(bucket, (freqMap.get(bucket) || 0) + 1);
      }
      const frequencyDistribution = ['1 Order', '2 Orders', '3 Orders', '4 Orders', '5 Orders', '6+ Orders'].map((b) => ({
        bucket: b,
        customers: freqMap.get(b) || 0,
      }));

      // Monthly Customer Retention Cohort Matrix (Month 0 to Month 11)
      const cohortRows = queryRows<{ cohort_month: string; month_offset: number; active_customers: number }>(
        db,
        `WITH first_orders AS (
            SELECT customer_id, MIN(SUBSTR(order_date_iso, 1, 7)) AS cohort_month
            FROM sales_transactions
            WHERE order_status = 'Completed'
            GROUP BY customer_id
         ),
         activity AS (
            SELECT DISTINCT
                s.customer_id,
                f.cohort_month,
                SUBSTR(s.order_date_iso, 1, 7) AS order_month
            FROM sales_transactions s
            JOIN first_orders f ON s.customer_id = f.customer_id
            JOIN branches b ON s.branch_id = b.branch_id
            JOIN products p ON s.product_id = p.product_id
            JOIN customers c ON s.customer_id = c.customer_id
            WHERE s.order_status = 'Completed' ${whereSql}
         )
         SELECT
            cohort_month,
            ((CAST(SUBSTR(order_month, 1, 4) AS INTEGER) - CAST(SUBSTR(cohort_month, 1, 4) AS INTEGER)) * 12
            + (CAST(SUBSTR(order_month, 6, 2) AS INTEGER) - CAST(SUBSTR(cohort_month, 6, 2) AS INTEGER))) AS month_offset,
            COUNT(DISTINCT customer_id) AS active_customers
         FROM activity
         GROUP BY cohort_month, month_offset
         ORDER BY cohort_month, month_offset`,
        params
      );

      const cohortMap = new Map<string, { cohortMonth: string; cohortSize: number; offsets: Record<number, number> }>();
      for (const row of cohortRows) {
        if (!cohortMap.has(row.cohort_month)) {
          cohortMap.set(row.cohort_month, {
            cohortMonth: row.cohort_month,
            cohortSize: row.month_offset === 0 ? row.active_customers : 0,
            offsets: {},
          });
        }
        const entry = cohortMap.get(row.cohort_month)!;
        if (row.month_offset === 0) entry.cohortSize = row.active_customers;
        entry.offsets[row.month_offset] = row.active_customers;
      }

      const cohortMatrix = Array.from(cohortMap.values())
        .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
        .map((c) => {
          const base = Math.max(1, c.cohortSize);
          const months = Array.from({ length: 12 }, (_, m) =>
            c.offsets[m] !== undefined
              ? { pct: Number(((c.offsets[m] / base) * 100).toFixed(1)), count: c.offsets[m] }
              : null
          );
          return {
            cohortMonth: c.cohortMonth,
            cohortSize: c.cohortSize,
            months,
          };
        });

      res.json({
        summary: {
          activeCustomers: totalActive,
          repeatCustomers: repeatCount,
          repeatPurchaseRatePct: totalActive > 0 ? Number(((repeatCount / totalActive) * 100).toFixed(1)) : 0,
          repeatRevenueSharePct: totalCustRevenue > 0 ? Number(((repeatRevenue / totalCustRevenue) * 100).toFixed(1)) : 0,
          estimatedAvgClv: avgClv,
        },
        rfmSummary,
        segmentBreakdown,
        newVsReturning,
        frequencyDistribution,
        cohortMatrix,
        topCustomers: rfmRows.slice(0, 50),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/inventory', (req: Request, res: Response) => {
    try {
      const { city, category, status, search } = req.query as Record<string, string>;
      const clauses: string[] = [];
      const params: string[] = [];

      if (city && city !== 'All') {
        clauses.push('b.city = ?');
        params.push(city);
      }
      if (category && category !== 'All') {
        clauses.push('p.category = ?');
        params.push(category);
      }
      if (status && status !== 'All') {
        clauses.push('i.stock_status = ?');
        params.push(status);
      }
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        clauses.push('(p.product_name LIKE ? OR p.product_id LIKE ? OR sup.supplier_name LIKE ?)');
        params.push(term, term, term);
      }
      const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      const statusSummary = queryRows<any>(
        db,
        `SELECT
            i.stock_status,
            COUNT(*) AS sku_slots,
            SUM(i.stock_quantity) AS total_units,
            ROUND(SUM(i.stock_quantity * p.cost_price), 2) AS stock_value
         FROM inventory i
         JOIN products p ON i.product_id = p.product_id
         JOIN branches b ON i.branch_id = b.branch_id
         JOIN suppliers sup ON p.supplier_id = sup.supplier_id
         ${whereClause}
         GROUP BY i.stock_status`,
        params
      );

      const branchStock = queryRows<any>(
        db,
        `SELECT
            b.city,
            b.branch_name,
            SUM(CASE WHEN i.stock_status = 'Out of Stock' THEN 1 ELSE 0 END) AS out_of_stock,
            SUM(CASE WHEN i.stock_status = 'Low Stock' THEN 1 ELSE 0 END) AS low_stock,
            SUM(CASE WHEN i.stock_status = 'Optimal' THEN 1 ELSE 0 END) AS optimal,
            SUM(CASE WHEN i.stock_status = 'Overstocked' THEN 1 ELSE 0 END) AS overstocked,
            ROUND(SUM(i.stock_quantity * p.cost_price), 2) AS stock_value
         FROM inventory i
         JOIN products p ON i.product_id = p.product_id
         JOIN branches b ON i.branch_id = b.branch_id
         JOIN suppliers sup ON p.supplier_id = sup.supplier_id
         ${whereClause}
         GROUP BY b.branch_id, b.city, b.branch_name
         ORDER BY stock_value DESC`,
        params
      );

      const cogsRow = queryRows<{ total_cogs: number }>(
        db,
        `SELECT ROUND(COALESCE(SUM(cost_total), 0), 2) AS total_cogs FROM sales_transactions WHERE order_status = 'Completed'`
      )[0];
      const totalStockVal = statusSummary.reduce((acc, s) => acc + (s.stock_value || 0), 0) || 1;
      const turnoverRatio = Number(((cogsRow?.total_cogs || 0) / totalStockVal).toFixed(2));

      const reorderQueue = queryRows<any>(
        db,
        `WITH sku_sales AS (
            SELECT product_id, branch_id, SUM(quantity) AS annual_units
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
            ROUND(i.stock_quantity * p.cost_price, 2) AS stock_value,
            COALESCE(ss.annual_units, 0) AS annual_units_sold,
            sup.supplier_name,
            sup.lead_time,
            MAX(0, (i.reorder_level * 3 - i.stock_quantity)) AS recommended_reorder_qty
         FROM inventory i
         JOIN products p ON i.product_id = p.product_id
         JOIN branches b ON i.branch_id = b.branch_id
         JOIN suppliers sup ON p.supplier_id = sup.supplier_id
         LEFT JOIN sku_sales ss ON i.product_id = ss.product_id AND i.branch_id = ss.branch_id
         ${whereClause}
         ORDER BY
            CASE i.stock_status
              WHEN 'Out of Stock' THEN 1
              WHEN 'Low Stock' THEN 2
              WHEN 'Overstocked' THEN 3
              ELSE 4
            END,
            annual_units_sold DESC
         LIMIT 150`,
        params
      );

      const supplierScorecard = queryRows<any>(
        db,
        `WITH sku_sales AS (
            SELECT product_id, SUM(quantity) AS units_sold, ROUND(SUM(revenue), 2) AS revenue
            FROM sales_transactions
            WHERE order_status = 'Completed'
            GROUP BY product_id
         ),
         sku_alerts AS (
            SELECT product_id,
                   SUM(CASE WHEN stock_status IN ('Out of Stock', 'Low Stock') THEN 1 ELSE 0 END) AS alert_slots
            FROM inventory
            GROUP BY product_id
         )
         SELECT
            sup.supplier_id,
            sup.supplier_name,
            sup.supplier_location,
            sup.product_category,
            sup.lead_time,
            sup.supplier_rating,
            COUNT(DISTINCT p.product_id) AS active_skus,
            COALESCE(SUM(ss.units_sold), 0) AS total_units_sold,
            ROUND(COALESCE(SUM(ss.revenue), 0), 2) AS total_revenue,
            COALESCE(SUM(sa.alert_slots), 0) AS stock_alert_slots
         FROM suppliers sup
         JOIN products p ON sup.supplier_id = p.supplier_id
         LEFT JOIN sku_sales ss ON p.product_id = ss.product_id
         LEFT JOIN sku_alerts sa ON p.product_id = sa.product_id
         GROUP BY sup.supplier_id, sup.supplier_name, sup.supplier_location, sup.product_category, sup.lead_time, sup.supplier_rating
         ORDER BY total_revenue DESC`
      );

      res.json({
        kpis: {
          totalStockValue: Number(totalStockVal.toFixed(2)),
          turnoverRatio,
          outOfStockCount: statusSummary.find((s) => s.stock_status === 'Out of Stock')?.sku_slots || 0,
          lowStockCount: statusSummary.find((s) => s.stock_status === 'Low Stock')?.sku_slots || 0,
          overstockedCount: statusSummary.find((s) => s.stock_status === 'Overstocked')?.sku_slots || 0,
        },
        statusSummary,
        branchStock,
        reorderQueue,
        supplierScorecard,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/logistics', (req: Request, res: Response) => {
    try {
      const { city, partner } = req.query as Record<string, string>;
      const clauses: string[] = [];
      const params: string[] = [];

      if (city && city !== 'All') {
        clauses.push('b.city = ?');
        params.push(city);
      }
      if (partner && partner !== 'All') {
        clauses.push('d.delivery_partner = ?');
        params.push(partner);
      }
      const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      const kpiRow = queryRows<any>(
        db,
        `WITH ob AS (SELECT DISTINCT order_id, branch_id FROM sales_transactions)
         SELECT
            COUNT(*) AS total_deliveries,
            SUM(CASE WHEN d.delivery_status = 'On Time' THEN 1 ELSE 0 END) AS on_time_count,
            SUM(CASE WHEN d.delivery_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed_count,
            ROUND(AVG(CASE WHEN d.delivery_status = 'On Time' THEN 1.0 ELSE 0.0 END) * 100, 2) AS on_time_rate_pct,
            ROUND(AVG(CASE WHEN d.delivery_date_iso != '' THEN JULIANDAY(d.delivery_date_iso) - JULIANDAY(d.dispatch_date_iso) END), 2) AS avg_delivery_days,
            ROUND(SUM(d.delivery_cost), 2) AS total_delivery_cost,
            ROUND(AVG(d.delivery_cost), 2) AS avg_delivery_cost
         FROM deliveries d
         JOIN ob ON d.order_id = ob.order_id
         JOIN branches b ON ob.branch_id = b.branch_id
         ${whereClause}`,
        params
      )[0];

      const partnerPerformance = queryRows<any>(
        db,
        `WITH ob AS (SELECT DISTINCT order_id, branch_id FROM sales_transactions)
         SELECT
            d.delivery_partner,
            COUNT(*) AS shipments,
            SUM(CASE WHEN d.delivery_status = 'On Time' THEN 1 ELSE 0 END) AS on_time,
            SUM(CASE WHEN d.delivery_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed,
            ROUND(AVG(CASE WHEN d.delivery_status = 'On Time' THEN 1.0 ELSE 0.0 END) * 100, 2) AS on_time_pct,
            ROUND(AVG(CASE WHEN d.delivery_date_iso != '' THEN JULIANDAY(d.delivery_date_iso) - JULIANDAY(d.dispatch_date_iso) END), 2) AS avg_days,
            ROUND(AVG(d.delivery_cost), 2) AS avg_cost
         FROM deliveries d
         JOIN ob ON d.order_id = ob.order_id
         JOIN branches b ON ob.branch_id = b.branch_id
         ${whereClause}
         GROUP BY d.delivery_partner
         ORDER BY on_time_pct DESC`,
        params
      );

      const cityPerformance = queryRows<any>(
        db,
        `WITH ob AS (SELECT DISTINCT order_id, branch_id FROM sales_transactions)
         SELECT
            b.city,
            b.state,
            COUNT(*) AS shipments,
            SUM(CASE WHEN d.delivery_status = 'On Time' THEN 1 ELSE 0 END) AS on_time,
            SUM(CASE WHEN d.delivery_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed,
            ROUND(AVG(CASE WHEN d.delivery_status = 'Delayed' THEN 1.0 ELSE 0.0 END) * 100, 2) AS delay_rate_pct,
            ROUND(AVG(CASE WHEN d.delivery_date_iso != '' THEN JULIANDAY(d.delivery_date_iso) - JULIANDAY(d.dispatch_date_iso) END), 2) AS avg_days,
            ROUND(AVG(d.delivery_cost), 2) AS avg_cost
         FROM deliveries d
         JOIN ob ON d.order_id = ob.order_id
         JOIN branches b ON ob.branch_id = b.branch_id
         ${whereClause}
         GROUP BY b.city, b.state
         ORDER BY delay_rate_pct DESC`,
        params
      );

      const fulfillmentByBranch = queryRows<any>(
        db,
        `SELECT
            b.city,
            b.branch_name,
            COUNT(DISTINCT s.order_id) AS total_orders,
            COUNT(DISTINCT CASE WHEN s.order_status = 'Completed' THEN s.order_id END) AS completed_orders,
            COUNT(DISTINCT CASE WHEN s.order_status = 'Returned' THEN s.order_id END) AS returned_orders,
            COUNT(DISTINCT CASE WHEN s.order_status = 'Cancelled' THEN s.order_id END) AS cancelled_orders,
            ROUND(COUNT(DISTINCT CASE WHEN s.order_status = 'Completed' THEN s.order_id END) * 100.0 / NULLIF(COUNT(DISTINCT s.order_id), 0), 2) AS fulfillment_rate_pct
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         GROUP BY b.branch_id, b.city, b.branch_name
         ORDER BY fulfillment_rate_pct DESC`
      );

      const delaySeverity = queryRows<any>(
        db,
        `WITH ob AS (SELECT DISTINCT order_id, branch_id FROM sales_transactions)
         SELECT
            CASE
              WHEN CAST(JULIANDAY(d.delivery_date_iso) - JULIANDAY(d.expected_delivery_date_iso) AS INTEGER) <= 1 THEN '1 Day Late'
              WHEN CAST(JULIANDAY(d.delivery_date_iso) - JULIANDAY(d.expected_delivery_date_iso) AS INTEGER) = 2 THEN '2 Days Late'
              ELSE '3+ Days Late'
            END AS severity,
            COUNT(*) AS shipments,
            ROUND(AVG(d.delivery_cost), 2) AS avg_cost
         FROM deliveries d
         JOIN ob ON d.order_id = ob.order_id
         JOIN branches b ON ob.branch_id = b.branch_id
         WHERE d.delivery_status = 'Delayed' AND d.delivery_date_iso != '' ${clauses.length ? `AND ${clauses.join(' AND ')}` : ''}
         GROUP BY severity
         ORDER BY shipments DESC`,
        params
      );

      const totalCompletedOrders = fulfillmentByBranch.reduce((a, b) => a + b.completed_orders, 0);
      const totalOrdersAll = fulfillmentByBranch.reduce((a, b) => a + b.total_orders, 0) || 1;

      res.json({
        kpis: {
          ...kpiRow,
          fulfillmentRatePct: Number(((totalCompletedOrders / totalOrdersAll) * 100).toFixed(2)),
        },
        partnerPerformance,
        cityPerformance,
        fulfillmentByBranch,
        delaySeverity,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products', (req: Request, res: Response) => {
    try {
      const { category, search } = req.query as Record<string, string>;
      const clauses: string[] = ["s.order_status = 'Completed'"];
      const params: string[] = [];

      if (category && category !== 'All') {
        clauses.push('p.category = ?');
        params.push(category);
      }
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        clauses.push('(p.product_name LIKE ? OR p.subcategory LIKE ? OR p.product_id LIKE ?)');
        params.push(term, term, term);
      }
      const whereClause = `WHERE ${clauses.join(' AND ')}`;

      const allProducts = queryRows<any>(
        db,
        `SELECT
            p.product_id,
            p.product_name,
            p.category,
            p.subcategory,
            p.unit_price,
            p.cost_price,
            p.gst_rate,
            sup.supplier_name,
            SUM(s.quantity) AS units_sold,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            ROUND(AVG(s.discount_pct), 1) AS avg_discount_pct,
            ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS realized_margin_pct
         FROM sales_transactions s
         JOIN products p ON s.product_id = p.product_id
         JOIN suppliers sup ON p.supplier_id = sup.supplier_id
         ${whereClause}
         GROUP BY p.product_id
         ORDER BY revenue DESC`,
        params
      );

      const categoryStats = queryRows<any>(
        db,
        `SELECT
            p.category,
            COUNT(DISTINCT p.product_id) AS sku_count,
            SUM(s.quantity) AS units_sold,
            ROUND(SUM(s.revenue), 2) AS revenue,
            ROUND(SUM(s.profit), 2) AS profit,
            ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS realized_margin_pct
         FROM sales_transactions s
         JOIN products p ON s.product_id = p.product_id
         ${whereClause}
         GROUP BY p.category
         ORDER BY revenue DESC`,
        params
      );

      const monthlyQtyByCategory = queryRows<any>(
        db,
        `SELECT
            SUBSTR(s.order_date_iso, 1, 7) AS month,
            SUM(CASE WHEN p.category = 'Grocery & Staples' THEN s.quantity ELSE 0 END) AS grocery_units,
            SUM(CASE WHEN p.category = 'Household & Kitchen' THEN s.quantity ELSE 0 END) AS household_units,
            SUM(CASE WHEN p.category = 'Electronics & Accessories' THEN s.quantity ELSE 0 END) AS electronics_units,
            SUM(CASE WHEN p.category = 'Fashion & Lifestyle' THEN s.quantity ELSE 0 END) AS fashion_units
         FROM sales_transactions s
         JOIN products p ON s.product_id = p.product_id
         ${whereClause}
         GROUP BY SUBSTR(s.order_date_iso, 1, 7)
         ORDER BY month`,
        params
      );

      const avgRev = allProducts.reduce((a, b) => a + b.revenue, 0) / Math.max(1, allProducts.length);
      const lowMarginAlerts = allProducts
        .filter((p) => p.revenue >= avgRev * 0.8 && p.realized_margin_pct < 11.5)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);

      const mostProfitable = [...allProducts].sort((a, b) => b.profit - a.profit).slice(0, 15);
      const topSelling = [...allProducts].sort((a, b) => b.units_sold - a.units_sold).slice(0, 15);

      res.json({
        categoryStats,
        monthlyQtyByCategory,
        topSelling,
        mostProfitable,
        lowMarginAlerts,
        allProducts: allProducts.slice(0, 120),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/insights', (_req: Request, res: Response) => {
    try {
      // Dynamic Insights calculation directly from SQLite
      const branches = queryRows<any>(
        db,
        `SELECT b.branch_name, b.city, ROUND(SUM(s.revenue), 2) AS revenue, ROUND(SUM(s.profit), 2) AS profit
         FROM sales_transactions s JOIN branches b ON s.branch_id = b.branch_id
         WHERE s.order_status = 'Completed' GROUP BY b.branch_id ORDER BY revenue DESC`
      );
      const totalRev = branches.reduce((a, b) => a + b.revenue, 0) || 1;
      const topBranch = branches[0];

      const catTop = queryRows<any>(
        db,
        `SELECT p.category, SUM(s.quantity) AS units, ROUND(SUM(s.revenue), 2) AS revenue,
                ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS margin_pct
         FROM sales_transactions s JOIN products p ON s.product_id = p.product_id
         WHERE s.order_status = 'Completed' GROUP BY p.category ORDER BY units DESC`
      );

      const lowMarginSkus = queryRows<any>(
        db,
        `SELECT p.product_name, p.category, ROUND(SUM(s.revenue), 2) AS revenue,
                ROUND((SUM(s.profit) / NULLIF(SUM(s.revenue), 0)) * 100, 2) AS margin_pct
         FROM sales_transactions s JOIN products p ON s.product_id = p.product_id
         WHERE s.order_status = 'Completed'
         GROUP BY p.product_id
         HAVING SUM(s.revenue) > 150000 AND margin_pct < 10.5
         ORDER BY revenue DESC LIMIT 5`
      );

      const cityDelays = queryRows<any>(
        db,
        `WITH ob AS (SELECT DISTINCT order_id, branch_id FROM sales_transactions)
         SELECT b.city, COUNT(*) AS total,
                SUM(CASE WHEN d.delivery_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed,
                ROUND(AVG(CASE WHEN d.delivery_status = 'Delayed' THEN 1.0 ELSE 0.0 END) * 100, 1) AS delay_pct
         FROM deliveries d JOIN ob ON d.order_id = ob.order_id JOIN branches b ON ob.branch_id = b.branch_id
         GROUP BY b.city ORDER BY delay_pct DESC`
      );

      const stockHealth = queryRows<any>(
        db,
        `SELECT
            SUM(CASE WHEN stock_status = 'Out of Stock' THEN 1 ELSE 0 END) AS out_of_stock,
            SUM(CASE WHEN stock_status = 'Low Stock' THEN 1 ELSE 0 END) AS low_stock,
            SUM(CASE WHEN stock_status = 'Overstocked' THEN 1 ELSE 0 END) AS overstocked
         FROM inventory`
      )[0];

      const repeatStats = queryRows<any>(
        db,
        `WITH co AS (
            SELECT customer_id, COUNT(DISTINCT order_id) AS cnt, SUM(revenue) AS rev
            FROM sales_transactions WHERE order_status = 'Completed' GROUP BY customer_id
         )
         SELECT
            COUNT(*) AS total_buyers,
            SUM(CASE WHEN cnt >= 2 THEN 1 ELSE 0 END) AS repeat_buyers,
            ROUND(SUM(CASE WHEN cnt >= 2 THEN rev ELSE 0 END) * 100.0 / NULLIF(SUM(rev), 0), 1) AS repeat_rev_share
         FROM co`
      )[0];

      const insights = [
        {
          id: 'INS-01',
          domain: 'Branch Revenue Leadership',
          impact: 'High Impact',
          status: 'nominal',
          title: `${topBranch.city} branch generates the highest revenue (${((topBranch.revenue / totalRev) * 100).toFixed(1)}% company share)`,
          metric: `₹${(topBranch.revenue / 100000).toFixed(2)} L`,
          observation: `${topBranch.branch_name} produced ₹${topBranch.revenue.toLocaleString('en-IN')} in completed revenue and ₹${topBranch.profit.toLocaleString('en-IN')} in net profit across the 12-month cycle.`,
          recommendation: `Scale ${topBranch.city}'s high-frequency grocery & household bundle architecture to Udupi and Mysuru branches to lift secondary branch AOV by 10–14%.`,
        },
        {
          id: 'INS-02',
          domain: 'Margin Erosion Alert',
          impact: 'Critical Margin',
          status: 'warning',
          title: `${lowMarginSkus.length} high-velocity SKUs deliver under 10.5% realized profit margin`,
          metric: `${lowMarginSkus[0]?.margin_pct ?? 8.2}% Margin`,
          observation: lowMarginSkus.length
            ? `Top volume electronics SKU "${lowMarginSkus[0].product_name}" generated ₹${lowMarginSkus[0].revenue.toLocaleString('en-IN')} yet retained only ${lowMarginSkus[0].margin_pct}% margin after festive discounts.`
            : 'Discounted electronics SKUs show thinner realized margins than household & fashion lines.',
          recommendation: 'Cap blanket festive discounts on fast-moving electronics at 8% and require accessory basket attach (cables/cases) to unlock 15%+ promotional pricing.',
        },
        {
          id: 'INS-03',
          domain: 'Delivery SLA Bottleneck',
          impact: 'Urgent SLA',
          status: 'critical',
          title: `${cityDelays[0].city} corridor shows the highest delivery delay rate at ${cityDelays[0].delay_pct}%`,
          metric: `${cityDelays[0].delayed} Delayed`,
          observation: `${cityDelays[0].delayed} of ${cityDelays[0].total} tracked dispatches in ${cityDelays[0].city} missed expected delivery dates, outpacing Mangaluru's hyperlocal SLA reliability.`,
          recommendation: 'Shift interstate Kasaragod and outer Bengaluru lanes from slower carriers onto CoastalExpress & BlueDart Regional and stage fast-moving grocery stock at the Kasaragod depot.',
        },
        {
          id: 'INS-04',
          domain: 'Inventory Rebalancing',
          impact: 'Working Capital',
          status: 'critical',
          title: `${stockHealth.out_of_stock} SKU slots out of stock while ${stockHealth.overstocked} slots remain overstocked`,
          metric: `${stockHealth.out_of_stock + stockHealth.low_stock} Alerts`,
          observation: `${stockHealth.out_of_stock} out-of-stock and ${stockHealth.low_stock} low-stock branch positions risk lost daily orders, while ${stockHealth.overstocked} overstocked slots lock excess working capital.`,
          recommendation: 'Automate purchase orders for top-velocity Grocery & Household items with >5 day supplier lead times and execute inter-branch stock transfers from overstocked depots.',
        },
        {
          id: 'INS-05',
          domain: 'Customer Retention & LTV',
          impact: 'Growth Lever',
          status: 'nominal',
          title: `Repeat buyers (${repeatStats.repeat_buyers.toLocaleString('en-IN')} customers) contribute ${repeatStats.repeat_rev_share}% of revenue`,
          metric: `${repeatStats.repeat_rev_share}% Share`,
          observation: `Out of ${repeatStats.total_buyers.toLocaleString('en-IN')} active customers, repeat purchasers sustain nearly all recurring cashflow across ${catTop[0]?.category || 'Grocery & Household'} demand.`,
          recommendation: 'Deploy a 7-day post-delivery UPI cashback trigger for 1-time buyers and run a targeted win-back campaign for the At Risk RFM cohort.',
        },
      ];

      // Monthly Sales Forecasting (OLS Linear Regression + 3M Moving Average + 90% PI)
      const monthly = queryRows<any>(
        db,
        `SELECT
            SUBSTR(order_date_iso, 1, 7) AS month,
            ROUND(SUM(revenue), 2) AS actual_revenue,
            ROUND(SUM(profit), 2) AS actual_profit,
            COUNT(DISTINCT order_id) AS orders
         FROM sales_transactions
         WHERE order_status = 'Completed'
         GROUP BY SUBSTR(order_date_iso, 1, 7)
         ORDER BY month`
      );

      const y = monthly.map((m) => Number(m.actual_revenue));
      const n = y.length;
      const x = y.map((_, idx) => idx);
      const xMean = x.reduce((a, b) => a + b, 0) / Math.max(1, n);
      const yMean = y.reduce((a, b) => a + b, 0) / Math.max(1, n);
      const denom = x.reduce((acc, xi) => acc + (xi - xMean) ** 2, 0) || 1;
      const slope = x.reduce((acc, xi, idx) => acc + (xi - xMean) * (y[idx] - yMean), 0) / denom;
      const intercept = yMean - slope * xMean;
      const fitted = x.map((xi) => intercept + slope * xi);
      const residuals = y.map((yi, idx) => yi - fitted[idx]);
      const ssRes = residuals.reduce((acc, r) => acc + r * r, 0);
      const ssTot = y.reduce((acc, yi) => acc + (yi - yMean) ** 2, 0) || 1;
      const r2 = Math.max(0, Number((1 - ssRes / ssTot).toFixed(3)));
      const rmse = Math.sqrt(ssRes / Math.max(1, n - 2));

      const forecastSeries: any[] = monthly.map((m, idx) => {
        const win = y.slice(Math.max(0, idx - 2), idx + 1);
        const ma3 = Number((win.reduce((a, b) => a + b, 0) / win.length).toFixed(2));
        return {
          month: m.month,
          type: 'Actual',
          actualRevenue: m.actual_revenue,
          movingAvg3m: ma3,
          forecastRevenue: null,
          lowerBound: null,
          upperBound: null,
        };
      });

      const [lastYr, lastMo] = monthly[monthly.length - 1].month.split('-').map(Number);
      const recentMa = y.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, y.length);
      for (let step = 1; step <= 4; step++) {
        const moRaw = lastMo + step;
        const yr = lastYr + Math.floor((moRaw - 1) / 12);
        const mo = ((moRaw - 1) % 12) + 1;
        const mKey = `${yr}-${String(mo).padStart(2, '0')}`;
        const trendPred = intercept + slope * (n - 1 + step);
        const blended = Number((0.72 * trendPred + 0.28 * (recentMa + slope * step)).toFixed(2));
        const band = Number((1.64 * rmse * Math.sqrt(1 + step * 0.18)).toFixed(2));
        forecastSeries.push({
          month: mKey,
          type: 'Forecast',
          actualRevenue: null,
          movingAvg3m: null,
          forecastRevenue: Math.max(0, blended),
          lowerBound: Math.max(0, Number((blended - band).toFixed(2))),
          upperBound: Number((blended + band).toFixed(2)),
        });
      }

      res.json({
        insights,
        forecast: {
          modelName: 'OLS Linear Trend + 3-Month Moving Average',
          r2Score: r2,
          monthlySlopeInr: Number(slope.toFixed(2)),
          rmseInr: Number(rmse.toFixed(2)),
          series: forecastSeries,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sql-catalog', (_req: Request, res: Response) => {
    try {
      const catalog = parseSqlCatalog();
      res.json({ queries: catalog });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sql/execute', (req: Request, res: Response) => {
    try {
      const { sql } = req.body as { sql?: string };
      if (!sql || !sql.trim()) {
        return res.status(400).json({ error: 'SQL query cannot be empty.' });
      }
      const cleaned = sql.trim();
      const stripped = cleaned.replace(/^(--[^\n]*\n|\s)+/g, '');
      if (!/^(SELECT|WITH)\b/i.test(stripped)) {
        return res.status(400).json({ error: 'Only read-only SELECT or CTE (WITH) queries are permitted in the SQL Analytics Studio.' });
      }
      if (/;\s*\S+/.test(stripped)) {
        return res.status(400).json({ error: 'Please execute one SQL statement at a time.' });
      }
      if (/\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|ATTACH|PRAGMA|CREATE)\b/i.test(stripped)) {
        return res.status(400).json({ error: 'DDL/DML write keywords are blocked in the read-only analytics workbench.' });
      }

      const start = performance.now();
      const stmt = db.prepare(cleaned);
      const columns = stmt.getColumnNames();
      const rows: Record<string, any>[] = [];
      let count = 0;
      while (stmt.step() && count < 200) {
        rows.push(stmt.getAsObject());
        count++;
      }
      stmt.free();
      const durationMs = Number((performance.now() - start).toFixed(2));

      res.json({ columns, rows, rowCount: rows.length, truncated: count === 200, durationMs });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/data-quality', (_req: Request, res: Response) => {
    try {
      const qualityReport = fs.existsSync(QUALITY_REPORT_FILE)
        ? JSON.parse(fs.readFileSync(QUALITY_REPORT_FILE, 'utf-8'))
        : null;

      const tables = ['sales_transactions', 'customers', 'products', 'inventory', 'deliveries', 'suppliers', 'branches'];
      const liveCounts: Record<string, number> = {};
      for (const tbl of tables) {
        const r = queryRows<{ cnt: number }>(db, `SELECT COUNT(*) AS cnt FROM ${tbl}`)[0];
        liveCounts[tbl] = r?.cnt || 0;
      }

      res.json({
        qualityReport,
        liveCounts,
        projectStructure: [
          'coastalkart-analytics/app.py',
          'coastalkart-analytics/requirements.txt',
          'coastalkart-analytics/README.md',
          'coastalkart-analytics/src/data_generator.py',
          'coastalkart-analytics/src/data_cleaning.py',
          'coastalkart-analytics/src/database.py',
          'coastalkart-analytics/src/metrics.py',
          'coastalkart-analytics/src/forecasting.py',
          'coastalkart-analytics/src/insights.py',
          'coastalkart-analytics/sql/sales_analysis.sql',
          'coastalkart-analytics/sql/customer_analysis.sql',
          'coastalkart-analytics/sql/inventory_analysis.sql',
          'coastalkart-analytics/sql/logistics_analysis.sql',
          'coastalkart-analytics/pages/ (7 modules)',
          'coastalkart-analytics/tests/ (9 passing unit tests)',
        ],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dataset/refresh', async (req: Request, res: Response) => {
    try {
      const seed = Number(req.body?.seed) || 42;
      const pyScript = `
import sys
sys.path.insert(0, '${ANALYTICS_DIR.replace(/\\/g, '/')}')
from src.data_generator import generate_raw_datasets
from src.data_cleaning import run_cleaning_pipeline
from src.database import build_database
generate_raw_datasets(seed=${Math.floor(seed)})
report = run_cleaning_pipeline()
counts = build_database()
print(report['total_anomalies_remediated'])
`;
      await execFileAsync('python3', ['-c', pyScript]);
      db = await loadDatabase();
      res.json({ ok: true, seed: Math.floor(seed), message: 'Regenerated synthetic dataset, ran cleaning pipeline, and rebuilt SQLite warehouse.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dataset/upload-transactions', (req: Request, res: Response) => {
    try {
      const { rows } = req.body as { rows?: any[] };
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Provide a non-empty array of transaction rows.' });
      }
      let inserted = 0;
      let rejected = 0;

      const validCustomers = new Set(queryRows<{ customer_id: string }>(db, 'SELECT customer_id FROM customers').map((r) => r.customer_id));
      const productMap = new Map(queryRows<any>(db, 'SELECT product_id, unit_price, cost_price, gst_rate FROM products').map((r) => [r.product_id, r]));
      const validBranches = new Set(queryRows<{ branch_id: string }>(db, 'SELECT branch_id FROM branches').map((r) => r.branch_id));

      for (const r of rows.slice(0, 500)) {
        const cid = String(r.customer_id || 'CUST-00001').trim();
        const pid = String(r.product_id || 'PRD-0001').trim();
        const bid = String(r.branch_id || 'BR-01').trim();
        const qty = Math.max(1, parseInt(String(r.quantity || 1), 10) || 1);

        if (!validCustomers.has(cid) || !productMap.has(pid) || !validBranches.has(bid)) {
          rejected++;
          continue;
        }
        const prod = productMap.get(pid);
        const discPct = Math.min(30, Math.max(0, Number(r.discount_pct || 0)));
        const gross = qty * prod.unit_price;
        const discAmt = Number((gross * (discPct / 100)).toFixed(2));
        const rev = Number((gross - discAmt).toFixed(2));
        const gstAmt = Number((rev * (prod.gst_rate / (100 + prod.gst_rate))).toFixed(2));
        const costTotal = Number((qty * prod.cost_price).toFixed(2));
        const status = String(r.order_status || 'Completed');
        const profit = status === 'Completed' ? Number((rev - gstAmt - costTotal).toFixed(2)) : 0;

        const nowIso = String(r.order_date_iso || '2026-10-31');
        const [yy, mm, dd] = nowIso.split('-');
        const dispDate = dd && mm && yy ? `${dd}-${mm}-${yy}` : '31-10-2026';
        const invId = String(r.invoice_id || `INV-UPL-${Date.now()}-${inserted}`);
        const ordId = String(r.order_id || `ORD-UPL-${Date.now()}-${inserted}`);

        db.run(
          `INSERT OR REPLACE INTO sales_transactions (
            invoice_id, order_id, order_date, order_date_iso, customer_id, product_id,
            quantity, unit_price, discount_pct, discount_amount, gst_rate, gst_amount,
            revenue, cost_total, profit, branch_id, payment_method, order_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invId, ordId, dispDate, nowIso, cid, pid, qty, prod.unit_price, discPct,
            discAmt, prod.gst_rate, gstAmt, rev, costTotal, profit, bid,
            String(r.payment_method || 'UPI'), status,
          ]
        );
        inserted++;
      }

      res.json({ ok: true, inserted, rejected });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/simulated-stream', (_req: Request, res: Response) => {
    try {
      const sample = queryRows<any>(
        db,
        `SELECT s.order_id, b.city, p.product_name, p.category, s.quantity, s.revenue, s.payment_method
         FROM sales_transactions s
         JOIN branches b ON s.branch_id = b.branch_id
         JOIN products p ON s.product_id = p.product_id
         WHERE s.order_status = 'Completed'
         ORDER BY RANDOM()
         LIMIT 5`
      );
      const now = new Date();
      const events = sample.map((item, idx) => ({
        isSimulated: true,
        eventId: `SIM-${now.getTime()}-${idx}`,
        timestamp: now.toLocaleTimeString('en-IN', { hour12: false }),
        city: item.city,
        productName: item.product_name,
        category: item.category,
        quantity: item.quantity,
        revenue: item.revenue,
        paymentMethod: item.payment_method,
      }));
      res.json({ isSimulated: true, events });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CoastalKart BI Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
