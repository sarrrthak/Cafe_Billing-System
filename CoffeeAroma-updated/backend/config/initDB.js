/* ============================================================
   config/initDB.js — Create all tables + seed demo data
   Run: node config/initDB.js
   ============================================================ */
require('dotenv').config();
const { pool } = require('./db');
const bcrypt   = require('bcryptjs');

async function initDB() {
  const client = await pool.connect();
  console.log('✅  Connected to PostgreSQL');

  try {
    await client.query('BEGIN');

    /* ---- USERS ---- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        first_name    VARCHAR(80)  NOT NULL,
        last_name     VARCHAR(80)  NOT NULL,
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        business_name VARCHAR(255) NOT NULL DEFAULT 'My Restaurant',
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    /* ---- PRODUCTS (menu items) ---- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        category    VARCHAR(100) NOT NULL DEFAULT 'General',
        price       NUMERIC(10,2) NOT NULL DEFAULT 0,
        tax_rate    NUMERIC(5,2)  NOT NULL DEFAULT 5,
        unit        VARCHAR(50)   NOT NULL DEFAULT 'plate',
        emoji       VARCHAR(10)   DEFAULT '🍽️',
        description TEXT,
        is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(user_id, category);
    `);

    /* ---- INVOICES ---- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_number VARCHAR(50)  NOT NULL,
        client_name    VARCHAR(255) NOT NULL,
        client_email   VARCHAR(255),
        client_phone   VARCHAR(30),
        invoice_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
        order_type     VARCHAR(50)  NOT NULL DEFAULT 'Dine In',
        subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
        cgst           NUMERIC(12,2) NOT NULL DEFAULT 0,
        sgst           NUMERIC(12,2) NOT NULL DEFAULT 0,
        service_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount       NUMERIC(12,2) NOT NULL DEFAULT 0,
        total          NUMERIC(12,2) NOT NULL DEFAULT 0,
        status         VARCHAR(20)  NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','paid','cancelled')),
        notes          TEXT,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, invoice_number)
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_user   ON invoices(user_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_date   ON invoices(user_id, invoice_date);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(user_id, status);
    `);

    /* ---- INVOICE ITEMS ---- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id          SERIAL PRIMARY KEY,
        invoice_id  INTEGER       NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        product_id  INTEGER       REFERENCES products(id) ON DELETE SET NULL,
        name        VARCHAR(255)  NOT NULL,
        quantity    NUMERIC(8,2)  NOT NULL DEFAULT 1,
        unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
        tax_rate    NUMERIC(5,2)  NOT NULL DEFAULT 0,
        line_total  NUMERIC(12,2) NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);
    `);

    /* ---- INVOICE SEQUENCE (per user) ---- */
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_sequences (
        user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        next_seq   INTEGER NOT NULL DEFAULT 1
      );
    `);

    /* ---- updated_at trigger function ---- */
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
    `);
    for (const tbl of ['users','products','invoices']) {
      await client.query(`
        DROP TRIGGER IF EXISTS trg_${tbl}_updated_at ON ${tbl};
        CREATE TRIGGER trg_${tbl}_updated_at
          BEFORE UPDATE ON ${tbl}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
    }

    /* ---- DEMO USER + SEED DATA ---- */
    const existing = await client.query(`SELECT id FROM users WHERE email = 'admin@cafearoma.com'`);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('password123', 10);
      const userRes = await client.query(`
        INSERT INTO users (first_name, last_name, email, password_hash, business_name)
        VALUES ('Admin','User','admin@cafearoma.com',$1,'Cafe Aroma')
        RETURNING id`, [hash]);
      const uid = userRes.rows[0].id;

      await client.query(`INSERT INTO invoice_sequences (user_id, next_seq) VALUES ($1, 1)`, [uid]);

      // Seed menu items
      const menuItems = [
        ['Masala Dosa',        'Breakfast',    120, 5,  'plate', '🥞', 'Crispy dosa with sambar & chutney'],
        ['Filter Coffee',      'Beverages',     60, 5,  'cup',   '☕', 'South Indian decoction coffee'],
        ['Paneer Butter Masala','Main Course', 260, 5,  'plate', '🍛', 'Rich creamy tomato-based curry'],
        ['Chicken Biryani',    'Main Course',  320, 5,  'plate', '🍚', 'Dum cooked aromatic biryani'],
        ['Gulab Jamun',        'Desserts',      80, 0,  'piece', '🍮', 'Soft khoya dumplings in sugar syrup'],
        ['Veg Thali',          'Thali',        180, 5,  'plate', '🍱', 'Full meal with dal, sabzi, roti, rice'],
        ['Masala Chai',        'Beverages',     40, 5,  'cup',   '🫖', 'Indian spiced milk tea'],
        ['Mango Lassi',        'Beverages',     90, 5,  'glass', '🥛', 'Chilled mango yoghurt drink'],
      ];
      for (const [name,cat,price,tax,unit,emoji,desc] of menuItems) {
        await client.query(`
          INSERT INTO products (user_id,name,category,price,tax_rate,unit,emoji,description)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uid,name,cat,price,tax,unit,emoji,desc]);
      }

      // Seed 20 demo invoices
      const clients  = ['Ramesh Kumar','Priya Sharma','Table 3','Anjali Mehta','Delivery - Swiggy'];
      const types    = ['Dine In','Takeaway','Delivery','Online Order'];
      const statuses = ['paid','paid','paid','paid','pending'];
      const prodRes  = await client.query(`SELECT id,name,price,tax_rate FROM products WHERE user_id=$1`, [uid]);
      const prods    = prodRes.rows;

      for (let i = 0; i < 20; i++) {
        const invDate = new Date();
        invDate.setDate(invDate.getDate() - Math.floor(Math.random() * 90));
        const dateStr = invDate.toISOString().split('T')[0];
        const p1 = prods[Math.floor(Math.random()*prods.length)];
        const p2 = prods[Math.floor(Math.random()*prods.length)];
        const q1 = Math.ceil(Math.random()*3), q2 = Math.ceil(Math.random()*2);
        const sub = p1.price*q1 + p2.price*q2;
        const cgst = +(sub*0.025).toFixed(2), sgst = +(sub*0.025).toFixed(2);
        const total = +(sub+cgst+sgst).toFixed(2);
        const invNum = `INV-${String(i+1).padStart(4,'0')}`;

        const invRes = await client.query(`
          INSERT INTO invoices (user_id,invoice_number,client_name,invoice_date,order_type,subtotal,cgst,sgst,total,status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [uid,invNum,clients[i%clients.length],dateStr,types[i%types.length],sub,cgst,sgst,total,statuses[i%statuses.length]]);
        const invId = invRes.rows[0].id;

        await client.query(`
          INSERT INTO invoice_items (invoice_id,product_id,name,quantity,unit_price,tax_rate,line_total)
          VALUES ($1,$2,$3,$4,$5,$6,$7),($1,$8,$9,$10,$11,$12,$13)`,
          [invId,p1.id,p1.name,q1,p1.price,p1.tax_rate,+(p1.price*q1).toFixed(2),
               p2.id,p2.name,q2,p2.price,p2.tax_rate,+(p2.price*q2).toFixed(2)]);
      }
      await client.query(`UPDATE invoice_sequences SET next_seq = 21 WHERE user_id = $1`, [uid]);
      console.log('✅  Demo data seeded (admin@cafearoma.com / password123)');
    } else {
      console.log('ℹ️  Demo user already exists, skipping seed');
    }

    await client.query('COMMIT');
    console.log('✅  Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Database init failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initDB().catch(() => process.exit(1));
