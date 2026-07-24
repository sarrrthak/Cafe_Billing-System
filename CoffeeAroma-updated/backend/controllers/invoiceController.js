/* ============================================================
   controllers/invoiceController.js — Invoice Management
   ============================================================ */
const db = require('../config/db');
const { validateRequired } = require('../middleware/errorHandler');

/* ---- helpers ---- */
function nextInvNumber(seq) {
  return `INV-${String(seq).padStart(4,'0')}`;
}

/* ---------- LIST INVOICES ---------- */
exports.getAll = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10,
      search, status, sortBy = 'invoice_date', sortDir = 'DESC',
      dateFrom, dateTo,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [req.user.id];
    let where    = 'WHERE i.user_id = $1';
    let idx      = 2;

    if (status)   { where += ` AND i.status = $${idx++}`; params.push(status); }
    if (dateFrom) { where += ` AND i.invoice_date >= $${idx++}`; params.push(dateFrom); }
    if (dateTo)   { where += ` AND i.invoice_date <= $${idx++}`; params.push(dateTo); }
    if (search) {
      where += ` AND (i.client_name ILIKE $${idx} OR i.invoice_number ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }

    const allowed = ['invoice_date','invoice_number','client_name','total','created_at'];
    const col     = allowed.includes(sortBy) ? sortBy : 'invoice_date';
    const dir     = sortDir === 'ASC' ? 'ASC' : 'DESC';

    const countRes = await db.query(`SELECT COUNT(*) FROM invoices i ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await db.query(
      `SELECT i.*,
         COALESCE(
           json_agg(
             json_build_object(
               'id',ii.id,'name',ii.name,'quantity',ii.quantity,
               'unitPrice',ii.unit_price,'taxRate',ii.tax_rate,'lineTotal',ii.line_total
             ) ORDER BY ii.id
           ) FILTER (WHERE ii.id IS NOT NULL), '[]'
         ) AS items
       FROM invoices i
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       ${where}
       GROUP BY i.id
       ORDER BY i.${col} ${dir}
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({
      success: true,
      data:    result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total/parseInt(limit)) }
    });
  } catch (err) { next(err); }
};

/* ---------- GET ONE ---------- */
exports.getOne = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT i.*,
         COALESCE(
           json_agg(json_build_object('id',ii.id,'name',ii.name,'quantity',ii.quantity,
             'unitPrice',ii.unit_price,'taxRate',ii.tax_rate,'lineTotal',ii.line_total
           ) ORDER BY ii.id) FILTER (WHERE ii.id IS NOT NULL), '[]'
         ) AS items
       FROM invoices i
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.id=$1 AND i.user_id=$2
       GROUP BY i.id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ success:false, message:'Invoice not found' });
    res.json({ success:true, data: result.rows[0] });
  } catch (err) { next(err); }
};

/* ---------- CREATE INVOICE ---------- */
exports.create = async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const {
      clientName, clientEmail, clientPhone,
      invoiceDate, orderType, items,
      subtotal, cgst, sgst, serviceCharge, discount, total, notes
    } = req.body;

    validateRequired(['clientName','items'], req.body);
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success:false, message:'At least one item is required' });
    }

    // Get & increment sequence
    const seqRes = await client.query(
      `UPDATE invoice_sequences SET next_seq = next_seq + 1 WHERE user_id = $1 RETURNING next_seq - 1 AS seq`,
      [req.user.id]
    );
    if (!seqRes.rows.length) {
      // First invoice for this user
      await client.query('INSERT INTO invoice_sequences (user_id, next_seq) VALUES ($1, 2)', [req.user.id]);
      seqRes.rows = [{ seq: 1 }];
    }
    const invNum = nextInvNumber(seqRes.rows[0].seq);

    const invRes = await client.query(
      `INSERT INTO invoices
         (user_id,invoice_number,client_name,client_email,client_phone,
          invoice_date,order_type,subtotal,cgst,sgst,service_charge,discount,total,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [req.user.id, invNum, clientName.trim(), clientEmail||null, clientPhone||null,
       invoiceDate || new Date().toISOString().split('T')[0],
       orderType||'Dine In',
       parseFloat(subtotal)||0, parseFloat(cgst)||0, parseFloat(sgst)||0,
       parseFloat(serviceCharge)||0, parseFloat(discount)||0,
       parseFloat(total)||0, notes||'']
    );
    const inv = invRes.rows[0];

    // Insert line items
    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id,product_id,name,quantity,unit_price,tax_rate,line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [inv.id, item.productId||null, item.name, parseFloat(item.quantity)||1,
         parseFloat(item.unitPrice)||0, parseFloat(item.taxRate)||0,
         parseFloat(item.lineTotal)||0]
      );
    }

    await client.query('COMMIT');

    // Return with items
    const full = await db.query(
      `SELECT i.*, COALESCE(json_agg(json_build_object('id',ii.id,'name',ii.name,
         'quantity',ii.quantity,'unitPrice',ii.unit_price,'taxRate',ii.tax_rate,'lineTotal',ii.line_total
       ) ORDER BY ii.id) FILTER (WHERE ii.id IS NOT NULL),'[]') AS items
       FROM invoices i LEFT JOIN invoice_items ii ON ii.invoice_id=i.id
       WHERE i.id=$1 GROUP BY i.id`, [inv.id]
    );
    res.status(201).json({ success:true, message:`Invoice ${invNum} created`, data: full.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
};

/* ---------- UPDATE STATUS ---------- */
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending','paid','cancelled'].includes(status)) {
      return res.status(400).json({ success:false, message:'Invalid status' });
    }
    const check = await db.query('SELECT id FROM invoices WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ success:false, message:'Invoice not found' });

    const result = await db.query(
      'UPDATE invoices SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]
    );
    res.json({ success:true, message:'Status updated', data: result.rows[0] });
  } catch (err) { next(err); }
};

/* ---------- DELETE ---------- */
exports.delete = async (req, res, next) => {
  try {
    const check = await db.query('SELECT id FROM invoices WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ success:false, message:'Invoice not found' });
    await db.query('DELETE FROM invoices WHERE id=$1', [req.params.id]);
    res.json({ success:true, message:'Invoice deleted' });
  } catch (err) { next(err); }
};

/* ---------- ANALYTICS / DASHBOARD ---------- */
exports.getStats = async (req, res, next) => {
  try {
    const uid = req.user.id;

    // Totals
    const totals = await db.query(
      `SELECT COUNT(*) as invoice_count,
              COALESCE(SUM(total),0) as total_revenue,
              COALESCE(AVG(total),0) as avg_bill
       FROM invoices WHERE user_id=$1`, [uid]
    );

    // Revenue last 30 days (daily)
    const daily = await db.query(
      `SELECT invoice_date::text as date, SUM(total) as revenue, COUNT(*) as count
       FROM invoices
       WHERE user_id=$1 AND invoice_date >= NOW()-INTERVAL '30 days'
       GROUP BY invoice_date ORDER BY invoice_date`, [uid]
    );

    // Revenue last 12 months (monthly)
    const monthly = await db.query(
      `SELECT TO_CHAR(invoice_date,'YYYY-MM') as month,
              SUM(total) as revenue, COUNT(*) as count
       FROM invoices
       WHERE user_id=$1 AND invoice_date >= NOW()-INTERVAL '12 months'
       GROUP BY month ORDER BY month`, [uid]
    );

    // Order type breakdown
    const byType = await db.query(
      `SELECT order_type, COUNT(*) as count, SUM(total) as revenue
       FROM invoices WHERE user_id=$1
       GROUP BY order_type ORDER BY count DESC`, [uid]
    );

    // Top items by revenue
    const topItems = await db.query(
      `SELECT ii.name, SUM(ii.line_total) as revenue, SUM(ii.quantity) as qty_sold
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.user_id=$1
       GROUP BY ii.name
       ORDER BY revenue DESC LIMIT 10`, [uid]
    );

    // Status breakdown
    const byStatus = await db.query(
      `SELECT status, COUNT(*) as count, SUM(total) as revenue
       FROM invoices WHERE user_id=$1
       GROUP BY status`, [uid]
    );

    // Product count
    const prodCount = await db.query(
      'SELECT COUNT(*) FROM products WHERE user_id=$1 AND is_active=TRUE', [uid]
    );

    res.json({
      success: true,
      data: {
        summary:   totals.rows[0],
        daily:     daily.rows,
        monthly:   monthly.rows,
        byType:    byType.rows,
        byStatus:  byStatus.rows,
        topItems:  topItems.rows,
        productCount: parseInt(prodCount.rows[0].count),
      }
    });
  } catch (err) { next(err); }
};
