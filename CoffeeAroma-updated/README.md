# ☕ Coffee Aroma — Billing System

**Version:** 2.1 (UI/UX Redesign)  
**Store:** Near Ranka Jwellers, Pimple Saudagar - 411017

---

## What's New in v2.1

### ✅ Address Updated
- All invoices, PDFs, and reports now show: **Near Ranka Jwellers, Pimple Saudagar - 411017**

### ✅ Modern POS Product Selection
The "New Invoice" page is completely redesigned with a fast café POS experience:

- **Product Grid** — Visual card layout with emoji, name, category, price
- **Category Tabs** — Instant filter by Hot Beverages, Cold Beverages, Shakes, etc.
- **Search Bar** — Real-time search across product name and category
- **One-Click Add** — Tap any product card to instantly add it to cart
- **Quantity +/−** — Inline qty buttons directly on cart rows; badge shows qty on product cards
- **Sticky Cart Panel** — Order items visible at all times on the right
- **Manual Add** — "+ Manual" button for custom/unlisted items with editable name, rate, tax
- **Notes Field** — Special instructions below the cart
- **Responsive** — Works on desktop (3-col), tablet (2-col), and mobile (stacked)

### ✅ Invoice Export (Excel)
- Export filtered by **Today / This Week / This Month / Custom Range**
- Filter by **Invoice Status** (All / Paid / Pending)
- **Optional Password Protection** — exports as ZIP containing Excel when password set
- Multi-sheet Excel: Summary, Item Breakdown, Statistics

### ✅ Invoice Section
- Clean professional PDF with updated address
- Mark as Paid
- All filters: search, status, date range, sort

---

## Getting Started

### Backend (Node.js)
```bash
cd backend
cp .env.example .env  # edit DB credentials
npm install
node server.js
```

### Frontend
Open `frontend/index.html` directly in browser — no build step needed.

**Demo credentials:** admin@coffeearoma.com / password123

---

## Project Structure
```
coffee-aroma-updated/
├── frontend/
│   ├── index.html          # Main SPA shell (POS layout)
│   ├── assets/logo.jpeg
│   └── src/
│       ├── app.js          # All UI logic, POS, invoicing
│       ├── styles/main.css # Full styles incl. POS components
│       └── api.js          # API layer (when backend enabled)
└── backend/
    ├── server.js
    ├── routes/
    ├── controllers/
    ├── config/
    └── middleware/
```
