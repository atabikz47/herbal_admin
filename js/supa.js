// A small, dependency-free client for the Supabase REST, Auth and Storage
// APIs — just what the admin panel needs. No build step, no CDN.

const SESSION_KEY = 'herbify_admin_session_v1';

export class ApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class SupaClient {
  constructor(url, anonKey) {
    this.url = String(url || '').replace(/\/+$/, '');
    this.key = anonKey;
    this.session = this._loadSession();
    this._refreshing = null;
  }

  // ------------------------------------------------------------ session

  get user() {
    return this.session?.user ?? null;
  }

  _loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _saveSession(data) {
    if (!data?.access_token) {
      this.session = null;
      try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    this.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || now + (data.expires_in || 3600),
      user: data.user,
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch { /* ignore */ }
  }

  async _authFetch(path, body) {
    let response;
    try {
      response = await fetch(`${this.url}/auth/v1/${path}`, {
        method: 'POST',
        headers: { apikey: this.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Cannot reach Supabase. Check your internet connection and the URL in js/config.js.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error_description || data.msg || data.message || 'Sign-in failed';
      throw new ApiError(
        /invalid login/i.test(message) ? 'Incorrect email or password.' : message,
        { status: response.status, code: data.error_code || data.error || '' },
      );
    }
    return data;
  }

  async signIn(email, password) {
    const data = await this._authFetch('token?grant_type=password', { email, password });
    this._saveSession(data);
    return data.user;
  }

  async refreshSession() {
    if (!this.session?.refresh_token) throw new ApiError('Session expired', { status: 401 });
    // Share one refresh between concurrent requests.
    this._refreshing ??= this._authFetch('token?grant_type=refresh_token', {
      refresh_token: this.session.refresh_token,
    })
      .then((data) => this._saveSession(data))
      .catch((error) => {
        this._saveSession(null);
        throw error;
      })
      .finally(() => { this._refreshing = null; });
    return this._refreshing;
  }

  async _ensureFreshToken() {
    if (!this.session) return;
    const now = Math.floor(Date.now() / 1000);
    if (this.session.expires_at - 60 <= now) await this.refreshSession();
  }

  async signOut() {
    const token = this.session?.access_token;
    this._saveSession(null);
    if (!token) return;
    try {
      await fetch(`${this.url}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: this.key, Authorization: `Bearer ${token}` },
      });
    } catch { /* already signed out locally */ }
  }

  _headers(extra = {}) {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.session?.access_token || this.key}`,
      ...extra,
    };
  }

  // --------------------------------------------------------------- REST

  /**
   * Low-level PostgREST request.
   * @param {string} path      e.g. "products" or "rpc/place_order"
   * @param {object} options   { method, params: [[key, value], ...] | object, body, prefer, count }
   */
  async rest(path, { method = 'GET', params, body, prefer, count = false } = {}, retried = false) {
    await this._ensureFreshToken();
    const search = new URLSearchParams(
      Array.isArray(params) ? params : Object.entries(params || {}),
    ).toString();
    const preferParts = [prefer, count ? 'count=exact' : null].filter(Boolean);
    const headers = this._headers({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(preferParts.length ? { Prefer: preferParts.join(',') } : {}),
    });

    let response;
    try {
      response = await fetch(`${this.url}/rest/v1/${path}${search ? `?${search}` : ''}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Network error — check your internet connection.');
    }

    if (response.status === 401 && !retried && this.session?.refresh_token) {
      await this.refreshSession();
      return this.rest(path, { method, params, body, prefer, count }, true);
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!response.ok) {
      const message = (data && (data.message || data.error_description || data.msg)) || `Request failed (${response.status})`;
      throw new ApiError(friendlyDbError(message, data?.code), {
        status: response.status,
        code: data?.code || '',
      });
    }
    if (count) {
      const range = response.headers.get('Content-Range') || '';
      const total = Number(range.split('/')[1]);
      return { data, count: Number.isFinite(total) ? total : (data?.length ?? 0) };
    }
    return data;
  }

  select(table, params = {}) {
    return this.rest(table, { params });
  }

  insert(table, row) {
    return this.rest(table, { method: 'POST', body: row, prefer: 'return=representation' });
  }

  update(table, filters, patch) {
    return this.rest(table, { method: 'PATCH', params: filters, body: patch, prefer: 'return=representation' });
  }

  remove(table, filters) {
    return this.rest(table, { method: 'DELETE', params: filters, prefer: 'return=representation' });
  }

  rpc(fn, args = {}) {
    return this.rest(`rpc/${fn}`, { method: 'POST', body: args });
  }

  // ------------------------------------------------------------ storage

  publicUrl(bucket, path) {
    return `${this.url}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  async upload(bucket, path, file) {
    await this._ensureFreshToken();
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    let response;
    try {
      response = await fetch(`${this.url}/storage/v1/object/${bucket}/${encoded}`, {
        method: 'POST',
        headers: this._headers({
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true',
          'cache-control': '3600',
        }),
        body: file,
      });
    } catch {
      throw new ApiError('Upload failed — check your internet connection.');
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(data.message || data.error || `Upload failed (${response.status})`, {
        status: response.status,
      });
    }
    return this.publicUrl(bucket, path);
  }
}

function friendlyDbError(message, code) {
  switch (code) {
    case '23505': return 'That value is already used — please choose a different one.';
    case '23503': return 'This item is still in use (for example, products are in this category). Move or remove those first.';
    case '23514': return 'Some values are not valid. Please check the form.';
    case '42501': return 'Permission denied. Is your account an admin?';
    case 'PGRST301':
    case 'PGRST303': return 'Your session has expired. Please sign in again.';
    default: return message;
  }
}
