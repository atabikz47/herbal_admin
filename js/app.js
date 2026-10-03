import { SUPABASE_URL, SUPABASE_ANON_KEY, IMAGE_BUCKET } from './config.js';
import { SupaClient } from './supa.js';

// =====================================================================
//  Helpers
// =====================================================================
const db = new SupaClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape ANY value before putting it into HTML (customer input is untrusted). */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const rs = (n) => (n === null || n === undefined || n === '' ? '—' : `Rs ${Number(n).toLocaleString('en-US')}`);
const fmtDate = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (name) => (name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const slugify = (text) => String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
const isConfigured = () => /^https?:\/\//.test(SUPABASE_URL) && !SUPABASE_ANON_KEY.startsWith('PASTE_');
const intOrNull = (v) => {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

const STATUS = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};
const FLOW = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];
// Must match public.order_status_allowed() in the database.
const NEXT = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
const ACTION_LABEL = {
  confirmed: 'Confirm order', preparing: 'Start preparing', shipped: 'Mark as shipped',
  delivered: 'Mark as delivered', cancelled: 'Cancel order',
};
const statusBadge = (s) => `<span class="badge b-${esc(s)}">${esc(STATUS[s] || s)}</span>`;

const I = {
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
};

const brandHTML = (light = false) => `
  <div class="brand ${light ? 'light' : ''}">
    <div class="brand-mark">${I.leaf}</div>
    <div class="brand-name">Herb<span>ify</span></div>
    <span class="brand-tag">Admin</span>
  </div>`;

function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

function errorMessage(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

/** Opens a modal. Returns { el, close }. */
function openModal(html, { size = '', drawer = false, onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = `overlay ${drawer ? 'drawer' : ''}`;
  overlay.innerHTML = drawer
    ? `<div class="drawer-panel" role="dialog" aria-modal="true">${html}</div>`
    : `<div class="modal ${size}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  overlay.querySelector('input, select, textarea')?.focus();
  return { el: overlay, close };
}

function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const { el, close } = openModal(`
      <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${I.x}</button></div>
      <div class="modal-body"><p style="margin:0;line-height:1.55">${esc(message)}</p></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmLabel)}</button>
      </div>`, { size: 'sm', onClose: () => { if (!answered) resolve(false); } });
    el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; close(); resolve(true); });
    el.querySelector('[data-ok]').focus();
  });
}

async function withBusy(button, fn) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner sm"></span>';
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

// =====================================================================
//  State
// =====================================================================
const state = {
  profile: null,
  categories: [],
  pendingCount: 0,
};

async function loadCategories() {
  state.categories = await db.select('categories', {
    select: 'id,name,parent_id,sort_order,is_active',
    order: 'sort_order.asc,name.asc',
  });
  return state.categories;
}

const categoryName = (id) => state.categories.find((c) => c.id === id)?.name ?? id;
function categoryOptions(selected, { includeAll = false } = {}) {
  const tops = state.categories.filter((c) => !c.parent_id);
  const out = includeAll ? ['<option value="">All categories</option>'] : [];
  for (const top of tops) {
    out.push(`<option value="${esc(top.id)}" ${top.id === selected ? 'selected' : ''}>${esc(top.name)}</option>`);
    for (const sub of state.categories.filter((c) => c.parent_id === top.id)) {
      out.push(`<option value="${esc(sub.id)}" ${sub.id === selected ? 'selected' : ''}>&nbsp;&nbsp;↳ ${esc(sub.name)}</option>`);
    }
  }
  // Orphans (parent removed)
  for (const c of state.categories.filter((c) => c.parent_id && !tops.some((t) => t.id === c.parent_id))) {
    out.push(`<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`);
  }
  return out.join('');
}

// =====================================================================
//  Boot & auth
// =====================================================================
async function boot() {
  if (!isConfigured()) {
    app.innerHTML = `
      <div class="auth-form-wrap" style="min-height:100vh">
        <div class="auth-card card card-pad">
          ${brandHTML()}
          <h2 style="margin-top:20px">Connect Supabase</h2>
          <p class="sub">Open <b>admin_panel/js/config.js</b> and paste your Supabase Project URL and anon public key
          (Supabase → Project Settings → API), then reload this page.</p>
        </div>
      </div>`;
    return;
  }
  if (!db.session) return renderLogin();
  await enterAdmin();
}

function renderLogin(errorText = '') {
  app.innerHTML = `
    <div class="auth">
      <div class="auth-art">
        ${brandHTML(true)}
        <div>
          <h1>Run your herbal store from one place.</h1>
          <p>Manage products and prices, process orders, and keep your customers happy.</p>
        </div>
        <p class="small" style="opacity:.6">Only accounts with the admin role can sign in.</p>
      </div>
      <div class="auth-form-wrap">
        <form class="auth-card" id="login-form" novalidate>
          <div class="hide-desktop" style="margin-bottom:24px">${brandHTML()}</div>
          <h2>Admin sign in</h2>
          <p class="sub">Use your Herbify admin account.</p>
          ${errorText ? `<div class="form-error">${esc(errorText)}</div>` : ''}
          <div class="field"><label for="email">Email</label>
            <input class="input" id="email" name="email" type="email" autocomplete="username" required /></div>
          <div class="field"><label for="password">Password</label>
            <input class="input" id="password" name="password" type="password" autocomplete="current-password" required /></div>
          <button class="btn btn-primary btn-block" type="submit">Sign in</button>
        </form>
      </div>
    </div>`;
  const form = document.getElementById('login-form');
  form.email.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return renderLogin('Enter your email and password.');
    const button = form.querySelector('button[type=submit]');
    try {
      await withBusy(button, () => db.signIn(email, password));
      await enterAdmin();
    } catch (error) {
      renderLogin(errorMessage(error));
      document.getElementById('login-form').email.value = email;
    }
  });
}

async function enterAdmin() {
  app.innerHTML = '<div class="boot"><div class="spinner"></div></div>';
  try {
    const rows = await db.select('profiles', {
      select: 'id,email,full_name,role',
      id: `eq.${db.user?.id}`,
    });
    const profile = rows?.[0];
    if (!profile || profile.role !== 'admin') {
      await db.signOut();
      return renderLogin('This account is not an admin. Ask the store owner to grant admin access (see README).');
    }
    state.profile = profile;
    await loadCategories();
    renderShell();
    window.addEventListener('hashchange', route);
    route();
  } catch (error) {
    await db.signOut();
    renderLogin(errorMessage(error));
  }
}

// =====================================================================
//  Shell & routing
// =====================================================================
const ROUTES = {
  dashboard: { label: 'Dashboard', icon: I.dash, render: renderDashboard },
  orders: { label: 'Orders', icon: I.orders, render: renderOrders },
  products: { label: 'Products', icon: I.box, render: renderProducts },
  categories: { label: 'Categories', icon: I.tag, render: renderCategories },
  customers: { label: 'Customers', icon: I.users, render: renderCustomers },
  settings: { label: 'Store settings', icon: I.gear, render: renderSettings },
};

function renderShell() {
  const p = state.profile;
  app.innerHTML = `
    <div class="shell" id="shell">
      <aside class="sidebar">
        ${brandHTML(true)}
        <nav class="nav" id="nav">
          ${Object.entries(ROUTES).map(([key, r]) => `
            <a href="#/${key}" data-route="${key}">${r.icon}<span>${r.label}</span>${key === 'orders' ? '<span class="count hidden" id="pending-count"></span>' : ''}</a>`).join('')}
        </nav>
        <div class="sidebar-foot">
          <div class="me">
            <div class="avatar">${esc(initials(p.full_name || p.email))}</div>
            <div style="min-width:0">
              <div class="me-name">${esc(p.full_name || 'Admin')}</div>
              <div class="me-mail">${esc(p.email || db.user?.email || '')}</div>
            </div>
          </div>
          <button class="btn btn-signout" id="signout">${I.logout} Sign out</button>
        </div>
      </aside>
      <div class="main">
        <div class="topbar">
          <button class="icon-btn" id="menu" aria-label="Menu" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.2)">${I.menu}</button>
          ${brandHTML(true)}
          <span style="width:34px"></span>
        </div>
        <main class="content" id="view"></main>
      </div>
    </div>`;
  document.getElementById('signout').addEventListener('click', async () => {
    await db.signOut();
    window.removeEventListener('hashchange', route);
    location.hash = '';
    renderLogin();
  });
  const shell = document.getElementById('shell');
  document.getElementById('menu').addEventListener('click', () => shell.classList.toggle('nav-open'));
  document.getElementById('nav').addEventListener('click', () => shell.classList.remove('nav-open'));
  refreshPendingBadge();
}

async function refreshPendingBadge() {
  try {
    const { count } = await db.rest('orders', {
      params: { select: 'id', status: 'eq.pending', limit: '1' }, count: true,
    });
    state.pendingCount = count;
    const el = document.getElementById('pending-count');
    if (el) {
      el.textContent = count;
      el.classList.toggle('hidden', !count);
    }
  } catch { /* non-critical */ }
}

let currentTimer = null;
async function route() {
  clearInterval(currentTimer);
  currentTimer = null;
  const key = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
  const r = ROUTES[key] ? key : 'dashboard';
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
  const oldView = document.getElementById('view');
  if (!oldView) return;
  // Replace the element so listeners from the previous page are dropped.
  const view = oldView.cloneNode(false);
  oldView.replaceWith(view);
  view.innerHTML = '<div class="boot" style="min-height:50vh"><div class="spinner"></div></div>';
  document.title = `${ROUTES[r].label} · Herbify Admin`;
  try {
    await ROUTES[r].render(view);
  } catch (error) {
    if (error?.status === 401) {
      await db.signOut();
      return renderLogin('Your session has expired. Please sign in again.');
    }
    view.innerHTML = `<div class="card empty"><div class="big">Couldn’t load this page</div>${esc(errorMessage(error))}
      <div style="margin-top:14px"><button class="btn btn-ghost" id="retry">${I.refresh} Try again</button></div></div>`;
    document.getElementById('retry').addEventListener('click', route);
  }
}

// =====================================================================
//  Dashboard
// =====================================================================
async function renderDashboard(view) {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const [orders, products, customers] = await Promise.all([
    db.select('orders', {
      select: 'id,order_number,customer_name,total,status,created_at',
      created_at: `gte.${since.toISOString()}`,
      order: 'created_at.desc',
      limit: '2000',
    }),
    db.select('products', { select: 'id,name,price,stock,is_active', limit: '5000' }),
    db.rest('profiles', { params: { select: 'id', role: 'eq.customer', limit: '1' }, count: true }),
  ]);

  const live = orders.filter((o) => o.status !== 'cancelled');
  const revenue = live.reduce((sum, o) => sum + o.total, 0);
  const today = new Date().toDateString();
  const todays = live.filter((o) => new Date(o.created_at).toDateString() === today);
  const open = orders.filter((o) => ['pending', 'confirmed', 'preparing', 'shipped'].includes(o.status));
  const pending = orders.filter((o) => o.status === 'pending');
  const activeProducts = products.filter((p) => p.is_active);
  const lowStock = activeProducts.filter((p) => p.stock !== null && p.stock <= 5);
  const unpriced = activeProducts.filter((p) => p.price === null);

  // Last 14 days revenue chart
  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: d, total: 0, count: 0 });
  }
  for (const o of live) {
    const key = new Date(o.created_at).toDateString();
    const day = days.find((d) => d.date.toDateString() === key);
    if (day) { day.total += o.total; day.count += 1; }
  }
  const max = Math.max(1, ...days.map((d) => d.total));
  const fortnight = days.reduce((s, d) => s + d.total, 0);

  const stat = (icon, label, value, foot) => `
    <div class="card stat">
      <div class="stat-label"><span class="dot">${icon}</span>${esc(label)}</div>
      <div class="stat-value mono">${value}</div>
      <div class="stat-foot">${foot}</div>
    </div>`;

  const attention = [];
  if (pending.length) attention.push({ cls: 'b-pending', icon: I.clock, t: `${pending.length} order${pending.length > 1 ? 's' : ''} waiting for confirmation`, s: 'Call the customer and confirm.', href: '#/orders?status=pending' });
  if (lowStock.length) attention.push({ cls: 'b-warn', icon: I.alert, t: `${lowStock.length} product${lowStock.length > 1 ? 's' : ''} low on stock`, s: lowStock.slice(0, 3).map((p) => p.name).join(', '), href: '#/products?filter=low' });
  if (unpriced.length) attention.push({ cls: 'b-neutral', icon: I.tag, t: `${unpriced.length} product${unpriced.length > 1 ? 's' : ''} without a price`, s: 'Customers can’t order these until you add a price.', href: '#/products?filter=unpriced' });

  view.innerHTML = `
    <div class="page-head">
      <div><h1>Good ${greeting()}, ${esc((state.profile.full_name || 'Admin').split(' ')[0])}</h1>
      <p>Here’s how your store is doing over the last 30 days.</p></div>
      <div class="page-actions"><a class="btn btn-accent" href="#/products?new=1">${I.plus} Add product</a></div>
    </div>
    <div class="stats">
      ${stat(I.cash, 'Revenue (30 days)', rs(revenue), `${live.length} orders, excl. cancelled`)}
      ${stat(I.orders, 'Orders today', todays.length, `${rs(todays.reduce((s, o) => s + o.total, 0))} in sales`)}
      ${stat(I.clock, 'Open orders', open.length, `${pending.length} awaiting confirmation`)}
      ${stat(I.users, 'Customers', customers.count, `${activeProducts.length} products live`)}
    </div>
    <div class="dash-grid">
      <div class="stack">
        <div class="card">
          <div class="card-head"><h2>Sales — last 14 days</h2><span class="muted small">${rs(fortnight)}</span></div>
          <div class="chart" role="img" aria-label="Daily sales for the last 14 days">
            ${days.map((d, i) => `
              <div class="bar-wrap" title="${esc(fmtDay(d.date))}: ${esc(rs(d.total))} (${d.count} orders)">
                <div class="bar ${i === days.length - 1 ? 'today' : ''}" style="height:${Math.round((d.total / max) * 100)}%"></div>
                <div class="bar-label">${d.date.getDate()}</div>
              </div>`).join('')}
          </div>
          <div class="chart-foot"><span>${esc(fmtDay(days[0].date))}</span><span>Today</span></div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Recent orders</h2><a href="#/orders" class="small">View all</a></div>
          ${orders.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Order</th><th>Customer</th><th class="hide-sm">Date</th><th>Status</th><th class="num">Total</th></tr></thead>
            <tbody>${orders.slice(0, 8).map((o) => `
              <tr class="clickable" data-order="${esc(o.id)}">
                <td class="strong nowrap">${esc(o.order_number)}</td>
                <td>${esc(o.customer_name)}</td>
                <td class="muted small hide-sm">${esc(fmtDate(o.created_at))}</td>
                <td>${statusBadge(o.status)}</td>
                <td class="num mono">${rs(o.total)}</td>
              </tr>`).join('')}</tbody></table></div>`
            : '<div class="empty"><div class="big">No orders yet</div>New orders from the app will show up here.</div>'}
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h2>Needs attention</h2></div>
          ${attention.length ? `<ul class="alist">${attention.map((a) => `
            <li><span class="ico badge plain ${a.cls}" style="padding:0">${a.icon}</span>
              <div class="grow"><div class="t">${esc(a.t)}</div><div class="s">${esc(a.s)}</div></div>
              <a class="btn btn-ghost btn-sm" href="${a.href}">View</a></li>`).join('')}</ul>`
            : '<div class="empty"><div class="big">All caught up</div>Nothing needs your attention right now.</div>'}
        </div>
      </div>
    </div>`;

  view.querySelectorAll('[data-order]').forEach((row) =>
    row.addEventListener('click', () => openOrderDrawer(row.dataset.order, () => route())));
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

const hashParams = () => new URLSearchParams(location.hash.split('?')[1] || '');

// =====================================================================
//  Orders
// =====================================================================
async function renderOrders(view) {
  const params = hashParams();
  let filter = STATUS[params.get('status')] ? params.get('status') : 'all';
  let query = '';
  let orders = [];

  view.innerHTML = `
    <div class="page-head">
      <div><h1>Orders</h1><p>Confirm, prepare and ship customer orders.</p></div>
      <div class="page-actions"><button class="btn btn-ghost" id="reload">${I.refresh} Refresh</button></div>
    </div>
    <div class="card">
      <div class="tabs" id="tabs"></div>
      <div class="toolbar">
        <div class="search">${I.search}<input class="input" id="q" placeholder="Search order number, name, phone or city" /></div>
      </div>
      <div id="list"></div>
    </div>`;

  const load = async () => {
    orders = await db.select('orders', {
      select: 'id,order_number,customer_name,phone,city,total,status,created_at',
      order: 'created_at.desc',
      limit: '500',
    });
    draw();
    refreshPendingBadge();
  };

  const draw = () => {
    const counts = { all: orders.length };
    for (const s of Object.keys(STATUS)) counts[s] = orders.filter((o) => o.status === s).length;
    document.getElementById('tabs').innerHTML = ['all', ...Object.keys(STATUS)].map((s) => `
      <button class="tab ${filter === s ? 'active' : ''}" data-tab="${s}">${s === 'all' ? 'All' : STATUS[s]} <span class="n">${counts[s]}</span></button>`).join('');

    const q = query.trim().toLowerCase();
    const rows = orders.filter((o) => (filter === 'all' || o.status === filter)
      && (!q || `${o.order_number} ${o.customer_name} ${o.phone} ${o.city}`.toLowerCase().includes(q)));

    document.getElementById('list').innerHTML = rows.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Order</th><th>Customer</th><th class="hide-sm">City</th><th class="hide-sm">Placed</th><th>Status</th><th class="num">Total</th></tr></thead>
        <tbody>${rows.map((o) => `
          <tr class="clickable" data-order="${esc(o.id)}">
            <td class="strong nowrap">${esc(o.order_number)}</td>
            <td><div class="strong">${esc(o.customer_name)}</div><div class="muted small">${esc(o.phone)}</div></td>
            <td class="hide-sm">${esc(o.city || '—')}</td>
            <td class="muted small hide-sm">${esc(fmtDate(o.created_at))}</td>
            <td>${statusBadge(o.status)}</td>
            <td class="num mono strong">${rs(o.total)}</td>
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="big">No orders found</div>${orders.length ? 'Try a different filter or search.' : 'Orders placed in the app will appear here.'}</div>`;
  };

  view.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { filter = tab.dataset.tab; draw(); return; }
    const row = e.target.closest('[data-order]');
    if (row) openOrderDrawer(row.dataset.order, load);
  });
  document.getElementById('q').addEventListener('input', (e) => { query = e.target.value; draw(); });
  document.getElementById('reload').addEventListener('click', (e) => withBusy(e.currentTarget, load).catch((err) => toast(errorMessage(err), 'error')));

  await load();
  // Check for new orders every 30 seconds while this page is open.
  currentTimer = setInterval(() => { if (!document.querySelector('.overlay')) load().catch(() => {}); }, 30000);
}

async function openOrderDrawer(orderId, onChanged) {
  const { el, close } = openModal(`<div class="boot" style="min-height:60vh"><div class="spinner"></div></div>`, { drawer: true });
  const panel = el.querySelector('.drawer-panel');

  const render = async () => {
    const [orderRows, items] = await Promise.all([
      db.select('orders', { select: '*', id: `eq.${orderId}` }),
      db.select('order_items', { select: 'product_name,pack_size,unit_price,quantity,line_total', order_id: `eq.${orderId}`, order: 'id.asc' }),
    ]);
    const profileRows = orderRows[0]
      ? await db.select('profiles', { select: 'email', id: `eq.${orderRows[0].user_id}` })
      : [];
    const o = orderRows[0];
    if (!o) {
      panel.innerHTML = `<div class="modal-head"><h2>Order</h2><button class="icon-btn" data-close>${I.x}</button></div><div class="empty">Order not found.</div>`;
      return;
    }
    const step = FLOW.indexOf(o.status);
    const email = profileRows[0]?.email;
    panel.innerHTML = `
      <div class="modal-head">
        <div><h2>${esc(o.order_number)}</h2><div class="muted small">${esc(fmtDate(o.created_at))}</div></div>
        <button class="icon-btn" data-close aria-label="Close">${I.x}</button>
      </div>
      <div class="drawer-body">
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            ${statusBadge(o.status)}<span class="muted small">Cash on delivery</span>
          </div>
          ${o.status === 'cancelled' ? '<div class="muted">This order was cancelled. Stock has been returned.</div>' : `
          <div class="timeline">${FLOW.map((s, i) => `<div class="step ${i <= step ? 'done' : ''}" title="${STATUS[s]}"></div>`).join('')}</div>`}
          ${NEXT[o.status].length ? `
            <div class="section-title" style="margin-top:16px">Next step</div>
            <div class="status-actions">
              ${NEXT[o.status].map((s) => `<button class="btn ${s === 'cancelled' ? 'btn-danger-ghost' : 'btn-primary'}" data-status="${s}">${ACTION_LABEL[s]}</button>`).join('')}
            </div>` : ''}
        </div>
        <div class="card card-pad">
          <div class="section-title">Customer</div>
          <dl class="kv">
            <dt>Name</dt><dd>${esc(o.customer_name)}</dd>
            <dt>Phone</dt><dd><a href="tel:${esc(o.phone.replace(/[^0-9+]/g, ''))}">${esc(o.phone)}</a></dd>
            ${email ? `<dt>Email</dt><dd>${esc(email)}</dd>` : ''}
            <dt>City</dt><dd>${esc(o.city || '—')}</dd>
            <dt>Address</dt><dd>${esc(o.address)}</dd>
            ${o.notes ? `<dt>Notes</dt><dd>${esc(o.notes)}</dd>` : ''}
          </dl>
        </div>
        <div class="card card-pad">
          <div class="section-title">Items</div>
          <div class="line-items">${items.map((it) => `
            <div class="li"><div><div class="strong">${esc(it.product_name)}</div>
              <div class="muted small">${it.pack_size ? `${esc(it.pack_size)} · ` : ''}${it.quantity} × ${rs(it.unit_price)}</div></div>
              <div class="mono">${rs(it.line_total)}</div></div>`).join('')}</div>
          <div class="totals" style="margin-top:8px">
            <div class="row"><span>Subtotal</span><span class="mono">${rs(o.subtotal)}</span></div>
            <div class="row"><span>Delivery</span><span class="mono">${o.delivery_fee ? rs(o.delivery_fee) : 'Free'}</span></div>
            <div class="row total"><span>Total to collect</span><span class="mono">${rs(o.total)}</span></div>
          </div>
        </div>
      </div>`;

    panel.querySelectorAll('[data-status]').forEach((btn) => btn.addEventListener('click', async () => {
      const next = btn.dataset.status;
      if (next === 'cancelled') {
        const ok = await confirmDialog({
          title: 'Cancel this order?',
          message: `Order ${o.order_number} will be cancelled and its stock returned. This can’t be undone.`,
          confirmLabel: 'Cancel order',
          danger: true,
        });
        if (!ok) return;
      }
      try {
        await withBusy(btn, () => db.rpc('update_order_status', { p_order_id: o.id, p_status: next }));
        toast(`${o.order_number} → ${STATUS[next]}`, 'success');
        await render();
        onChanged?.();
      } catch (error) {
        toast(errorMessage(error), 'error');
      }
    }));
  };

  try {
    await render();
  } catch (error) {
    toast(errorMessage(error), 'error');
    close();
  }
}

// =====================================================================
//  Products
// =====================================================================
async function renderProducts(view) {
  const params = hashParams();
  let products = [];
  let query = '';
  let category = '';
  let filter = params.get('filter') || 'all';

  view.innerHTML = `
    <div class="page-head">
      <div><h1>Products</h1><p>Add products, set prices and stock, and choose what customers see.</p></div>
      <div class="page-actions"><button class="btn btn-accent" id="add">${I.plus} Add product</button></div>
    </div>
    <div class="card">
      <div class="toolbar">
        <div class="search">${I.search}<input class="input" id="q" placeholder="Search products" /></div>
        <select class="select" id="cat">${categoryOptions('', { includeAll: true })}</select>
        <select class="select" id="filter">
          <option value="all">All products</option>
          <option value="visible">Visible in app</option>
          <option value="hidden">Hidden</option>
          <option value="low">Low / out of stock</option>
          <option value="unpriced">No price yet</option>
          <option value="sale">On sale</option>
          <option value="featured">Featured</option>
        </select>
      </div>
      <div id="list"></div>
    </div>`;
  document.getElementById('filter').value = filter;

  const load = async () => {
    products = await db.select('products', {
      select: '*',
      order: 'sort_order.asc,name.asc',
      limit: '5000',
    });
    draw();
  };

  const matchesCategory = (p) => {
    if (!category) return true;
    if (p.category_id === category) return true;
    return state.categories.some((c) => c.id === p.category_id && c.parent_id === category);
  };

  const draw = () => {
    const q = query.trim().toLowerCase();
    const rows = products.filter((p) => matchesCategory(p)
      && (!q || `${p.name} ${p.pack_size} ${p.manufacturer || ''} ${p.slug}`.toLowerCase().includes(q))
      && ({
        all: true,
        visible: p.is_active,
        hidden: !p.is_active,
        low: p.stock !== null && p.stock <= 5,
        unpriced: p.price === null,
        sale: p.compare_at_price !== null && p.price !== null && p.compare_at_price > p.price,
        featured: p.is_featured,
      }[filter] ?? true));

    document.getElementById('list').innerHTML = rows.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Product</th><th class="hide-sm">Category</th><th class="num">Price</th><th class="num">Stock</th><th>Visible</th><th class="hide-sm">Featured</th><th></th></tr></thead>
        <tbody>${rows.map((p) => `
          <tr data-id="${esc(p.id)}">
            <td><div class="prod-cell">
              ${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}" alt="" loading="lazy" />` : `<div class="thumb">${I.leaf}</div>`}
              <div><div class="strong">${esc(p.name)}</div><div class="muted small">${esc([p.pack_size, p.manufacturer].filter(Boolean).join(' · ') || '—')}</div></div>
            </div></td>
            <td class="hide-sm">${esc(categoryName(p.category_id))}</td>
            <td class="num mono">${p.price === null ? '<span class="badge b-neutral plain">No price</span>' : `${rs(p.price)}${p.compare_at_price > p.price ? `<span class="strike">${rs(p.compare_at_price)}</span>` : ''}`}</td>
            <td class="num">${p.stock === null ? '<span class="muted">—</span>' : p.stock === 0 ? '<span class="badge b-bad">Sold out</span>' : p.stock <= 5 ? `<span class="badge b-warn">${p.stock} left</span>` : `<span class="mono">${p.stock}</span>`}</td>
            <td><label class="switch" title="Show in app"><input type="checkbox" data-toggle="is_active" ${p.is_active ? 'checked' : ''} /><span></span></label></td>
            <td class="hide-sm"><button class="star ${p.is_featured ? 'on' : ''}" data-toggle="is_featured" title="Featured on home screen">${I.star}</button></td>
            <td class="actions">
              <button class="icon-btn" data-edit title="Edit">${I.edit}</button>
              <button class="icon-btn danger" data-delete title="Delete">${I.trash}</button>
            </td>
          </tr>`).join('')}</tbody></table></div>
      <div class="muted small" style="padding:12px 16px">${rows.length} of ${products.length} products</div>`
      : `<div class="empty"><div class="big">No products found</div>${products.length ? 'Try a different search or filter.' : 'Add your first product to get started.'}</div>`;
  };

  view.addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-id]');
    const product = row && products.find((p) => p.id === row.dataset.id);
    if (!product) return;
    if (e.target.closest('[data-edit]')) {
      openProductForm(product, load);
    } else if (e.target.closest('[data-delete]')) {
      const ok = await confirmDialog({
        title: 'Delete product?',
        message: `“${product.name}” will be removed from the store. Past orders keep their details. Tip: switch “Visible” off instead if you might sell it again.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      try {
        const deleted = await db.remove('products', { id: `eq.${product.id}` });
        if (!deleted?.length) throw new Error('Could not delete — permission denied.');
        toast('Product deleted', 'success');
        await load();
      } catch (error) { toast(errorMessage(error), 'error'); }
    } else if (e.target.closest('button[data-toggle]')) {
      await quickToggle(product, 'is_featured');
    }
  });
  view.addEventListener('change', async (e) => {
    const input = e.target.closest('input[data-toggle]');
    if (!input) return;
    const product = products.find((p) => p.id === input.closest('tr').dataset.id);
    if (product) await quickToggle(product, 'is_active');
  });

  async function quickToggle(product, field) {
    try {
      const rows = await db.update('products', { id: `eq.${product.id}` }, { [field]: !product[field] });
      if (!rows?.length) throw new Error('Could not update — permission denied.');
      Object.assign(product, rows[0]);
      toast(field === 'is_active'
        ? `${product.name} is now ${product.is_active ? 'visible' : 'hidden'}`
        : `${product.name} ${product.is_featured ? 'featured' : 'removed from featured'}`, 'success');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
    draw();
  }

  view.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement && e.target.classList.contains('thumb')) {
      const box = document.createElement('div');
      box.className = 'thumb';
      box.innerHTML = I.leaf;
      e.target.replaceWith(box);
    }
  }, true);
  document.getElementById('q').addEventListener('input', (e) => { query = e.target.value; draw(); });
  document.getElementById('cat').addEventListener('change', (e) => { category = e.target.value; draw(); });
  document.getElementById('filter').addEventListener('change', (e) => { filter = e.target.value; draw(); });
  document.getElementById('add').addEventListener('click', () => openProductForm(null, load));

  await load();
  if (params.get('new')) openProductForm(null, load);
}

function openProductForm(product, onSaved) {
  const isNew = !product;
  const p = product || { is_active: true, is_featured: false, sort_order: 0, category_id: state.categories[0]?.id };
  let imageUrl = p.image_url || '';
  let pendingFile = null;

  const { el, close } = openModal(`
    <form id="pform" novalidate>
      <div class="modal-head"><h2>${isNew ? 'Add product' : 'Edit product'}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${I.x}</button></div>
      <div class="modal-body">
        <div id="perr"></div>
        <div class="field"><label>Photo</label>
          <div class="image-picker">
            <div class="image-preview" id="preview"></div>
            <div style="flex:1">
              <input type="file" id="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="btn btn-ghost btn-sm" id="pick">${I.image} Upload photo</button>
                <button type="button" class="btn btn-ghost btn-sm ${imageUrl ? '' : 'hidden'}" id="clearimg">Remove</button>
              </div>
              <input class="input" id="image_url" placeholder="…or paste an image URL" style="margin-top:8px" value="${esc(imageUrl)}" />
              <div class="hint small muted" style="margin-top:4px">JPG, PNG or WebP, up to 5 MB. Square photos look best.</div>
            </div>
          </div>
        </div>
        <div class="field"><label for="name">Name *</label><input class="input" id="name" maxlength="120" required value="${esc(p.name || '')}" /></div>
        <div class="grid-2">
          <div class="field"><label for="category_id">Category *</label><select class="select" id="category_id">${categoryOptions(p.category_id)}</select></div>
          <div class="field"><label for="pack_size">Pack size</label><input class="input" id="pack_size" maxlength="40" placeholder="e.g. 100g, 60 caps" value="${esc(p.pack_size || '')}" /></div>
        </div>
        <div class="grid-3">
          <div class="field"><label for="price">Price (Rs)</label><input class="input" id="price" type="number" min="0" step="1" value="${p.price ?? ''}" /><span class="hint">Empty = “price on request”</span></div>
          <div class="field"><label for="compare_at_price">Old price (Rs)</label><input class="input" id="compare_at_price" type="number" min="0" step="1" value="${p.compare_at_price ?? ''}" /><span class="hint">Shows a discount</span></div>
          <div class="field"><label for="stock">Stock</label><input class="input" id="stock" type="number" min="0" step="1" value="${p.stock ?? ''}" /><span class="hint">Empty = don’t track</span></div>
        </div>
        <div class="field"><label for="manufacturer">Brand / manufacturer</label><input class="input" id="manufacturer" maxlength="80" value="${esc(p.manufacturer || '')}" /></div>
        <div class="field"><label for="description">Description</label><textarea class="textarea" id="description" maxlength="2000" placeholder="What is it, how is it used, ingredients…">${esc(p.description || '')}</textarea></div>
        <div class="grid-2">
          <div class="field"><label for="slug">URL name (slug)</label><input class="input" id="slug" maxlength="80" value="${esc(p.slug || '')}" placeholder="auto from name" /></div>
          <div class="field"><label for="sort_order">Sort order</label><input class="input" id="sort_order" type="number" step="1" value="${p.sort_order ?? 0}" /><span class="hint">Lower numbers show first</span></div>
        </div>
        <label class="check"><input type="checkbox" id="is_active" ${p.is_active ? 'checked' : ''} /> Visible in the app</label>
        <label class="check"><input type="checkbox" id="is_featured" ${p.is_featured ? 'checked' : ''} /> Featured on the home screen</label>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary" id="save">${isNew ? 'Add product' : 'Save changes'}</button>
      </div>
    </form>`);

  const $ = (id) => el.querySelector(`#${id}`);
  const showPreview = () => {
    const src = pendingFile ? URL.createObjectURL(pendingFile) : $('image_url').value.trim();
    $('preview').innerHTML = src ? `<img src="${esc(src)}" alt="" />` : I.image;
    $('clearimg').classList.toggle('hidden', !src);
  };
  showPreview();
  let slugTouched = !isNew;
  $('slug').addEventListener('input', () => { slugTouched = true; });
  const autoSlug = () => { if (!slugTouched) $('slug').value = slugify(`${$('name').value} ${$('pack_size').value}`); };
  $('name').addEventListener('input', autoSlug);
  $('pack_size').addEventListener('input', autoSlug);
  $('pick').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', () => {
    const file = $('file').files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image is larger than 5 MB.', 'error'); return; }
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast('Please choose a JPG, PNG or WebP image.', 'error'); return; }
    pendingFile = file;
    showPreview();
  });
  $('image_url').addEventListener('input', () => { pendingFile = null; showPreview(); });
  $('clearimg').addEventListener('click', () => { pendingFile = null; $('image_url').value = ''; $('file').value = ''; showPreview(); });

  $('pform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fail = (msg) => { $('perr').innerHTML = `<div class="form-error">${esc(msg)}</div>`; $('perr').scrollIntoView({ block: 'nearest' }); };
    $('perr').innerHTML = '';

    const name = $('name').value.trim();
    const price = intOrNull($('price').value);
    const compare = intOrNull($('compare_at_price').value);
    const stock = intOrNull($('stock').value);
    const sortOrder = intOrNull($('sort_order').value) ?? 0;
    const slug = slugify($('slug').value || `${name} ${$('pack_size').value}`);
    const url = $('image_url').value.trim();

    if (name.length < 2) return fail('Please enter a product name (at least 2 characters).');
    if (!$('category_id').value) return fail('Please choose a category.');
    if ([price, compare, stock, sortOrder].some(Number.isNaN)) return fail('Price, old price, stock and sort order must be whole numbers.');
    if ((price ?? 0) < 0 || (compare ?? 0) < 0 || (stock ?? 0) < 0) return fail('Numbers can’t be negative.');
    if (compare !== null && price === null) return fail('Set a price before adding an old price.');
    if (compare !== null && compare <= price) return fail('Old price must be higher than the price to show a discount.');
    if (slug.length < 2) return fail('Slug must be at least 2 characters (letters, numbers and dashes).');
    if (url && !/^https?:\/\//i.test(url) && !pendingFile) return fail('Image URL must start with http:// or https://');

    const button = $('save');
    try {
      await withBusy(button, async () => {
        let finalUrl = url || null;
        if (pendingFile) {
          const ext = (pendingFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
          const path = `products/${slug}-${Date.now().toString(36)}.${ext}`;
          finalUrl = await db.upload(IMAGE_BUCKET, path, pendingFile);
        }
        const row = {
          name,
          slug,
          category_id: $('category_id').value,
          pack_size: $('pack_size').value.trim(),
          price,
          compare_at_price: compare,
          stock,
          manufacturer: $('manufacturer').value.trim() || null,
          description: $('description').value.trim(),
          image_url: finalUrl,
          sort_order: sortOrder,
          is_active: $('is_active').checked,
          is_featured: $('is_featured').checked,
        };
        const saved = isNew
          ? await db.insert('products', row)
          : await db.update('products', { id: `eq.${p.id}` }, row);
        if (!saved?.length) throw new Error('Could not save — permission denied.');
      });
      toast(isNew ? 'Product added' : 'Product saved', 'success');
      close();
      await onSaved?.();
    } catch (error) {
      fail(errorMessage(error));
    }
  });
}

// =====================================================================
//  Categories
// =====================================================================
async function renderCategories(view) {
  const draw = async () => {
    await loadCategories();
    const products = await db.select('products', { select: 'category_id', limit: '10000' });
    const counts = {};
    for (const p of products) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    const tops = state.categories.filter((c) => !c.parent_id);
    const ordered = [];
    for (const t of tops) {
      ordered.push(t);
      ordered.push(...state.categories.filter((c) => c.parent_id === t.id));
    }
    for (const c of state.categories) if (!ordered.includes(c)) ordered.push(c);

    view.innerHTML = `
      <div class="page-head">
        <div><h1>Categories</h1><p>Organise products into collections. Sub-categories appear as filters inside their parent.</p></div>
        <div class="page-actions"><button class="btn btn-accent" id="add">${I.plus} Add category</button></div>
      </div>
      <div class="card">
        ${ordered.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Name</th><th class="hide-sm">ID</th><th class="num">Products</th><th class="num hide-sm">Order</th><th>Status</th><th></th></tr></thead>
          <tbody>${ordered.map((c) => `
            <tr data-id="${esc(c.id)}">
              <td>${c.parent_id ? '<span class="muted" style="margin-right:6px">↳</span>' : ''}<span class="strong">${esc(c.name)}</span>
                ${c.parent_id ? `<div class="muted small" style="margin-left:20px">in ${esc(categoryName(c.parent_id))}</div>` : ''}</td>
              <td class="muted small hide-sm mono">${esc(c.id)}</td>
              <td class="num mono">${counts[c.id] || 0}</td>
              <td class="num mono hide-sm">${c.sort_order}</td>
              <td>${c.is_active ? '<span class="badge b-ok">Visible</span>' : '<span class="badge b-neutral">Hidden</span>'}</td>
              <td class="actions"><button class="icon-btn" data-edit title="Edit">${I.edit}</button><button class="icon-btn danger" data-delete title="Delete">${I.trash}</button></td>
            </tr>`).join('')}</tbody></table></div>`
          : '<div class="empty"><div class="big">No categories yet</div>Add a category before adding products.</div>'}
      </div>`;

    view.querySelector('#add').addEventListener('click', () => openCategoryForm(null, draw));
    view.querySelectorAll('tr[data-id]').forEach((row) => {
      const cat = state.categories.find((c) => c.id === row.dataset.id);
      row.querySelector('[data-edit]').addEventListener('click', () => openCategoryForm(cat, draw));
      row.querySelector('[data-delete]').addEventListener('click', async () => {
        if (counts[cat.id]) {
          toast(`“${cat.name}” still has ${counts[cat.id]} product(s). Move them to another category first.`, 'error');
          return;
        }
        const ok = await confirmDialog({ title: 'Delete category?', message: `“${cat.name}” will be deleted.`, confirmLabel: 'Delete', danger: true });
        if (!ok) return;
        try {
          const deleted = await db.remove('categories', { id: `eq.${cat.id}` });
          if (!deleted?.length) throw new Error('Could not delete — permission denied.');
          toast('Category deleted', 'success');
          await draw();
        } catch (error) { toast(errorMessage(error), 'error'); }
      });
    });
  };
  await draw();
}

function openCategoryForm(category, onSaved) {
  const isNew = !category;
  const c = category || { is_active: true, sort_order: 0, parent_id: null };
  const parents = state.categories.filter((x) => !x.parent_id && x.id !== c.id);
  const hasChildren = !isNew && state.categories.some((x) => x.parent_id === c.id);

  const { el, close } = openModal(`
    <form id="cform" novalidate>
      <div class="modal-head"><h2>${isNew ? 'Add category' : 'Edit category'}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${I.x}</button></div>
      <div class="modal-body">
        <div id="cerr"></div>
        <div class="field"><label for="cname">Name *</label><input class="input" id="cname" maxlength="60" value="${esc(c.name || '')}" /></div>
        <div class="field"><label for="cid">ID</label><input class="input" id="cid" maxlength="60" value="${esc(c.id || '')}" ${isNew ? '' : 'disabled'} placeholder="auto from name" />
          <span class="hint">${isNew ? 'Lowercase letters, numbers and dashes. Can’t be changed later.' : 'The ID can’t be changed.'}</span></div>
        <div class="grid-2">
          <div class="field"><label for="cparent">Parent category</label>
            <select class="select" id="cparent" ${hasChildren ? 'disabled' : ''}>
              <option value="">— None (top level) —</option>
              ${parents.map((x) => `<option value="${esc(x.id)}" ${x.id === c.parent_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
            </select>
            ${hasChildren ? '<span class="hint">Has sub-categories, so it stays top level.</span>' : ''}</div>
          <div class="field"><label for="corder">Sort order</label><input class="input" id="corder" type="number" step="1" value="${c.sort_order ?? 0}" /></div>
        </div>
        <label class="check"><input type="checkbox" id="cactive" ${c.is_active ? 'checked' : ''} /> Visible in the app</label>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit" id="csave">${isNew ? 'Add category' : 'Save'}</button></div>
    </form>`, { size: 'sm' });

  const $ = (id) => el.querySelector(`#${id}`);
  let idTouched = false;
  $('cid').addEventListener('input', () => { idTouched = true; });
  $('cname').addEventListener('input', () => { if (isNew && !idTouched) $('cid').value = slugify($('cname').value); });

  $('cform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fail = (msg) => { $('cerr').innerHTML = `<div class="form-error">${esc(msg)}</div>`; };
    const name = $('cname').value.trim();
    const id = isNew ? slugify($('cid').value || name) : c.id;
    const order = intOrNull($('corder').value) ?? 0;
    if (name.length < 2) return fail('Name must be at least 2 characters.');
    if (!/^[a-z0-9-]{2,60}$/.test(id)) return fail('ID must be 2–60 lowercase letters, numbers or dashes.');
    if (Number.isNaN(order)) return fail('Sort order must be a whole number.');
    const row = { name, parent_id: $('cparent').value || null, sort_order: order, is_active: $('cactive').checked };
    try {
      await withBusy($('csave'), async () => {
        const saved = isNew
          ? await db.insert('categories', { id, ...row })
          : await db.update('categories', { id: `eq.${c.id}` }, row);
        if (!saved?.length) throw new Error('Could not save — permission denied.');
      });
      toast(isNew ? 'Category added' : 'Category saved', 'success');
      close();
      await onSaved?.();
    } catch (error) {
      fail(errorMessage(error));
    }
  });
}

// =====================================================================
//  Customers
// =====================================================================
async function renderCustomers(view) {
  let query = '';
  let people = [];
  let stats = {};

  const load = async () => {
    const [profiles, orders] = await Promise.all([
      db.select('profiles', { select: 'id,email,full_name,phone,city,role,created_at', order: 'created_at.desc', limit: '5000' }),
      db.select('orders', { select: 'user_id,total,status,created_at', limit: '20000' }),
    ]);
    people = profiles;
    stats = {};
    for (const o of orders) {
      const s = (stats[o.user_id] ||= { count: 0, spent: 0, last: null });
      s.count += 1;
      if (o.status !== 'cancelled') s.spent += o.total;
      if (!s.last || o.created_at > s.last) s.last = o.created_at;
    }
    draw();
  };

  view.innerHTML = `
    <div class="page-head"><div><h1>Customers</h1><p>Everyone who has created an account in the app.</p></div></div>
    <div class="card">
      <div class="toolbar"><div class="search">${I.search}<input class="input" id="q" placeholder="Search name, email, phone or city" /></div></div>
      <div id="list"></div>
    </div>`;

  const draw = () => {
    const q = query.trim().toLowerCase();
    const rows = people.filter((p) => !q || `${p.full_name || ''} ${p.email || ''} ${p.phone || ''} ${p.city || ''}`.toLowerCase().includes(q));
    document.getElementById('list').innerHTML = rows.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Customer</th><th class="hide-sm">Phone</th><th class="hide-sm">City</th><th class="num">Orders</th><th class="num">Spent</th><th class="hide-sm">Joined</th><th>Role</th><th></th></tr></thead>
        <tbody>${rows.map((p) => {
          const s = stats[p.id] || { count: 0, spent: 0 };
          const isMe = p.id === state.profile.id;
          return `<tr data-id="${esc(p.id)}">
            <td><div class="prod-cell" style="min-width:200px"><div class="avatar">${esc(initials(p.full_name || p.email))}</div>
              <div><div class="strong">${esc(p.full_name || '—')}${isMe ? ' <span class="muted small">(you)</span>' : ''}</div><div class="muted small">${esc(p.email || '')}</div></div></div></td>
            <td class="hide-sm">${esc(p.phone || '—')}</td>
            <td class="hide-sm">${esc(p.city || '—')}</td>
            <td class="num mono">${s.count}</td>
            <td class="num mono">${rs(s.spent)}</td>
            <td class="muted small hide-sm">${esc(fmtDay(p.created_at))}</td>
            <td>${p.role === 'admin' ? '<span class="badge b-admin plain">Admin</span>' : '<span class="badge b-neutral plain">Customer</span>'}</td>
            <td class="actions">${isMe ? '' : `<button class="btn btn-ghost btn-sm" data-role="${p.role === 'admin' ? 'customer' : 'admin'}">${p.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>`}</td>
          </tr>`;
        }).join('')}</tbody></table></div>
      <div class="muted small" style="padding:12px 16px">${rows.length} of ${people.length} people</div>`
      : '<div class="empty"><div class="big">No customers found</div>Customers appear here after they sign up in the app.</div>';
  };

  view.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-role]');
    if (!btn) return;
    const person = people.find((p) => p.id === btn.closest('tr').dataset.id);
    const makeAdmin = btn.dataset.role === 'admin';
    const ok = await confirmDialog({
      title: makeAdmin ? 'Give admin access?' : 'Remove admin access?',
      message: makeAdmin
        ? `${person.full_name || person.email} will be able to sign in here and manage products, orders, customers and settings.`
        : `${person.full_name || person.email} will no longer be able to use the admin panel.`,
      confirmLabel: makeAdmin ? 'Make admin' : 'Remove admin',
      danger: makeAdmin,
    });
    if (!ok) return;
    try {
      const rows = await db.update('profiles', { id: `eq.${person.id}` }, { role: btn.dataset.role });
      if (!rows?.length) throw new Error('Could not update — permission denied.');
      toast('Role updated', 'success');
      await load();
    } catch (error) { toast(errorMessage(error), 'error'); }
  });
  document.getElementById('q').addEventListener('input', (e) => { query = e.target.value; draw(); });
  await load();
}

// =====================================================================
//  Settings
// =====================================================================
async function renderSettings(view) {
  const rows = await db.select('store_settings', { select: '*', id: 'eq.1' });
  const s = rows[0] || {};
  view.innerHTML = `
    <div class="page-head"><div><h1>Store settings</h1><p>These settings update the app instantly.</p></div></div>
    <form id="sform" novalidate>
      <div id="serr"></div>
      <div class="settings-grid">
        <div class="card card-pad">
          <h2>Store</h2><p>Shown to customers in the app.</p>
          <div class="field"><label for="store_name">Store name</label><input class="input" id="store_name" maxlength="60" value="${esc(s.store_name || '')}" /></div>
          <div class="field"><label for="contact_phone">Contact phone / WhatsApp</label><input class="input" id="contact_phone" maxlength="30" value="${esc(s.contact_phone || '')}" placeholder="0300 1234567" /></div>
          <div class="field"><label for="announcement">Announcement banner</label><input class="input" id="announcement" maxlength="200" value="${esc(s.announcement || '')}" placeholder="e.g. Free delivery on orders over Rs 3,000!" />
            <span class="hint">Leave empty to hide the banner.</span></div>
        </div>
        <div class="card card-pad">
          <h2>Delivery & orders</h2><p>Used to calculate order totals at checkout.</p>
          <div class="grid-2">
            <div class="field"><label for="delivery_fee">Delivery fee (Rs)</label><input class="input" id="delivery_fee" type="number" min="0" step="1" value="${s.delivery_fee ?? 0}" /></div>
            <div class="field"><label for="free_delivery_threshold">Free delivery over (Rs)</label><input class="input" id="free_delivery_threshold" type="number" min="0" step="1" value="${s.free_delivery_threshold ?? ''}" />
              <span class="hint">Empty = never free</span></div>
          </div>
          <label class="check" style="margin-top:6px"><input type="checkbox" id="accepting_orders" ${s.accepting_orders ? 'checked' : ''} /> Accepting new orders</label>
          <div class="hint small muted">Turn off to pause checkout (e.g. during holidays). Customers can still browse.</div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-primary" id="ssave" type="submit">Save settings</button></div>
    </form>`;

  const $ = (id) => view.querySelector(`#${id}`);
  $('sform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fail = (msg) => { $('serr').innerHTML = `<div class="form-error">${esc(msg)}</div>`; };
    $('serr').innerHTML = '';
    const fee = intOrNull($('delivery_fee').value) ?? 0;
    const threshold = intOrNull($('free_delivery_threshold').value);
    if (Number.isNaN(fee) || Number.isNaN(threshold) || fee < 0 || (threshold ?? 0) < 0) return fail('Fees must be whole numbers, zero or more.');
    if (!$('store_name').value.trim()) return fail('Store name can’t be empty.');
    try {
      await withBusy($('ssave'), async () => {
        const saved = await db.update('store_settings', { id: 'eq.1' }, {
          store_name: $('store_name').value.trim(),
          contact_phone: $('contact_phone').value.trim(),
          announcement: $('announcement').value.trim(),
          delivery_fee: fee,
          free_delivery_threshold: threshold,
          accepting_orders: $('accepting_orders').checked,
        });
        if (!saved?.length) throw new Error('Could not save — permission denied.');
      });
      toast('Settings saved', 'success');
    } catch (error) {
      fail(errorMessage(error));
    }
  });
}

boot();
