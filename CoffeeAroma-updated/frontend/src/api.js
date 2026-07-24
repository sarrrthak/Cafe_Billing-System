/* ============================================================
   src/api.js — Frontend API Client
   Toggle USE_API=true in app.js to activate backend calls.
   All methods mirror the localStorage DB helpers.
   ============================================================ */

const API_BASE = 'http://localhost:5000/api';

/* ---- Token Management ---- */
const Token = {
  get:   ()  => localStorage.getItem('bf_token'),
  set:   (t) => localStorage.setItem('bf_token', t),
  clear: ()  => localStorage.removeItem('bf_token'),
};

/* ---- Base fetch wrapper ---- */
async function apiFetch(path, options = {}) {
  const token = Token.get();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.message || `API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ============================================================
   AUTH
   ============================================================ */
const AuthAPI = {
  async login(email, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    Token.set(data.token);
    return data.user;
  },

  async register(payload) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    Token.set(data.token);
    return data.user;
  },

  async getProfile()            { return (await apiFetch('/auth/profile')).user; },
  async updateProfile(payload)  { return (await apiFetch('/auth/profile', { method:'PUT', body: JSON.stringify(payload) })).user; },
  async changePassword(payload) { return apiFetch('/auth/password', { method:'PUT', body: JSON.stringify(payload) }); },

  logout() { Token.clear(); },
};

/* ============================================================
   PRODUCTS
   ============================================================ */
const ProductsAPI = {
  async getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return (await apiFetch(`/products${qs ? '?'+qs : ''}`)).data;
  },
  async getOne(id)           { return (await apiFetch(`/products/${id}`)).data; },
  async getCategories()      { return (await apiFetch('/products/categories')).data; },
  async create(payload)      { return (await apiFetch('/products', { method:'POST', body: JSON.stringify(payload) })).data; },
  async update(id, payload)  { return (await apiFetch(`/products/${id}`, { method:'PUT',    body: JSON.stringify(payload) })).data; },
  async delete(id)           { return apiFetch(`/products/${id}`, { method:'DELETE' }); },
};

/* ============================================================
   INVOICES
   ============================================================ */
const InvoicesAPI = {
  async getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/invoices${qs ? '?'+qs : ''}`);
    // returns { data, pagination }
  },
  async getOne(id)           { return (await apiFetch(`/invoices/${id}`)).data; },
  async getStats()           { return (await apiFetch('/invoices/stats')).data; },
  async create(payload)      { return (await apiFetch('/invoices', { method:'POST', body: JSON.stringify(payload) })).data; },
  async updateStatus(id, status) {
    return (await apiFetch(`/invoices/${id}/status`, { method:'PATCH', body: JSON.stringify({ status }) })).data;
  },
  async delete(id)           { return apiFetch(`/invoices/${id}`, { method:'DELETE' }); },
};

/* ============================================================
   EXPORT
   ============================================================ */
window.BillFlowAPI = { Auth: AuthAPI, Products: ProductsAPI, Invoices: InvoicesAPI, Token };
