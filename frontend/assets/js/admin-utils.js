/* ================================================================
   SCANBITE — Shared Admin Utilities
   admin-utils.js  (loaded by every admin page)
   ================================================================ */
'use strict';

/* ──────────────────────────────────────────────────────────────
   TOAST
   ──────────────────────────────────────────────────────────── */
window.showToast = function showToast(message, type = 'info') {
    let tc = document.getElementById('toast-container');
    if (!tc) {
        tc = document.createElement('div');
        tc.id = 'toast-container';
        tc.setAttribute('aria-live', 'polite');
        document.body.appendChild(tc);
    }
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const titles = { success: 'Success', error: 'Error', info: 'Info', warning: 'Warning' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', 'alert');
    t.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${titles[type] || 'Notice'}</div>
      <div class="toast-message">${esc(message)}</div>
    </div>
    <button class="toast-close" aria-label="Close">✕</button>`;
    tc.appendChild(t);
    const remove = () => {
        t.classList.add('removing');
        setTimeout(() => t.remove(), 250);
    };
    t.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, 4500);
};

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ──────────────────────────────────────────────────────────────
   SIDEBAR HTML TEMPLATE
   ──────────────────────────────────────────────────────────── */
const SIDEBAR_HTML = `
<aside class="sidebar" id="sidebar" role="navigation" aria-label="Admin sidebar">
  <div class="sidebar-inner">
    <!-- Brand -->
    <a href="/admin/dashboard.html" class="sidebar-brand" id="sidebarBrand">
      <div class="sidebar-brand-icon" aria-hidden="true">🌿</div>
      <div class="sidebar-brand-text">
        <div class="sidebar-brand-name">ScanBite</div>
        <div class="sidebar-brand-sub">Admin Panel</div>
      </div>
    </a>

    <!-- User snippet -->
    <div class="sidebar-user" id="sidebarUser">
      <div class="sidebar-avatar" id="sidebarAvatar" aria-hidden="true">A</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name" id="sidebarName">Loading…</div>
        <div class="sidebar-user-role">Restaurant Admin</div>
      </div>
    </div>

    <!-- Nav -->
    <nav class="sidebar-nav" aria-label="Admin navigation">
      <div class="sidebar-section-label">MAIN</div>
      <a href="/admin/dashboard.html" class="nav-item" id="nav-dashboard" data-path="/admin/dashboard.html">
        <span class="nav-item-icon" aria-hidden="true">📊</span>
        <span class="nav-item-label">Dashboard</span>
        <span class="nav-tooltip">Dashboard</span>
      </a>
      <a href="/admin/menu.html" class="nav-item" id="nav-menu" data-path="/admin/menu.html">
        <span class="nav-item-icon" aria-hidden="true">🍽️</span>
        <span class="nav-item-label">Menu</span>
        <span class="nav-tooltip">Menu</span>
      </a>
      <a href="/admin/orders.html" class="nav-item" id="nav-orders" data-path="/admin/orders.html">
        <span class="nav-item-icon" aria-hidden="true">🔔</span>
        <span class="nav-item-label">Orders</span>
        <span class="nav-item-badge" id="pendingBadge" style="display:none">0</span>
        <span class="nav-tooltip">Orders</span>
      </a>

      <div class="sidebar-section-label" style="margin-top:8px">SETUP</div>
      <a href="/admin/tables.html" class="nav-item" id="nav-tables" data-path="/admin/tables.html">
        <span class="nav-item-icon" aria-hidden="true">🪑</span>
        <span class="nav-item-label">Tables & QR</span>
        <span class="nav-tooltip">Tables & QR</span>
      </a>
      <a href="/admin/profile.html" class="nav-item" id="nav-profile" data-path="/admin/profile.html">
        <span class="nav-item-icon" aria-hidden="true">👤</span>
        <span class="nav-item-label">Profile</span>
        <span class="nav-tooltip">Profile</span>
      </a>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <button class="sidebar-logout" id="sidebarLogout" aria-label="Logout">
        <span class="nav-item-icon" style="font-size:1rem;" aria-hidden="true">🚪</span>
        <span>Logout</span>
      </button>
    </div>
  </div>
</aside>

<!-- Mobile backdrop -->
<div class="sidebar-backdrop" id="sidebarBackdrop" aria-hidden="true"></div>
`;

/* ──────────────────────────────────────────────────────────────
   INJECT SIDEBAR
   ──────────────────────────────────────────────────────────── */
function injectSidebar() {
    const target = document.getElementById('sidebarMount');
    if (!target) return;
    target.innerHTML = SIDEBAR_HTML;

    // Active link detection
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-item[data-path]').forEach(link => {
        if (link.dataset.path === currentPath) link.classList.add('active');
    });

    // Mobile toggle
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (toggleBtn && sidebar && backdrop) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            backdrop.classList.toggle('open');
        });
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('open');
            backdrop.classList.remove('open');
        });
    }

    // Sidebar collapse (desktop toggle)
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    if (collapseBtn && sidebar) {
        collapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const main = document.querySelector('.admin-main');
            if (main) main.classList.toggle('expanded');
        });
    }

    // Logout
    const logoutBtn = document.getElementById('sidebarLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Load user info
    loadSidebarUser();

    // Load pending orders count
    loadPendingCount();
}

/* ──────────────────────────────────────────────────────────────
   SIDEBAR USER INFO
   ──────────────────────────────────────────────────────────── */
async function loadSidebarUser() {
    const nameEl = document.getElementById('sidebarName');
    const avatarEl = document.getElementById('sidebarAvatar');
    try {
        const cached = localStorage.getItem('adminName');
        if (cached && nameEl) {
            nameEl.textContent = cached;
            if (avatarEl) avatarEl.textContent = cached.charAt(0).toUpperCase();
        }
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (data.success && nameEl) {
            nameEl.textContent = data.data.adminName;
            localStorage.setItem('adminName', data.data.adminName);
            localStorage.setItem('slug', data.data.slug);
            localStorage.setItem('restaurantName', data.data.restaurantName);
            if (avatarEl) avatarEl.textContent = data.data.adminName.charAt(0).toUpperCase();

            // Apply theme color
            if (data.data.themeColor) {
                applyThemeColor(data.data.themeColor);
            }
        }
    } catch (_) { }
}

/* ──────────────────────────────────────────────────────────────
   PENDING ORDERS BADGE
   ──────────────────────────────────────────────────────────── */
async function loadPendingCount() {
    try {
        const res = await fetch('/api/orders?status=Pending', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            const badge = document.getElementById('pendingBadge');
            if (!badge) return;
            const count = data.data.length;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'grid';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (_) { }
}

/* ──────────────────────────────────────────────────────────────
   LOGOUT
   ──────────────────────────────────────────────────────────── */
async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_) { }
    localStorage.clear();
    window.location.href = '/auth/login.html';
}

/* ──────────────────────────────────────────────────────────────
   AUTH GUARD (redirect if not logged in)
   ──────────────────────────────────────────────────────────── */
window.requireAuth = async function requireAuth() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        if (!data.success) throw new Error('Not authenticated');
        return data.data;
    } catch (_) {
        window.location.replace('/auth/login.html');
        return null;
    }
};

/* ──────────────────────────────────────────────────────────────
   THEME COLOR APPLICATION
   ──────────────────────────────────────────────────────────── */
window.applyThemeColor = function (color) {
    if (!color) return;
    const root = document.documentElement;
    root.style.setProperty('--primary', color);

    // Calculate variations if possible, or just use the color
    // For simplicity, we use the same color but different opacities for light/glow
    root.style.setProperty('--primary-dark', adjustColor(color, -20));
    root.style.setProperty('--primary-light', adjustColor(color, 90));
    root.style.setProperty('--primary-glow', color + '48'); // ~28% opacity
};

/** Helper to darken/lighten hex color */
window.adjustColor = function (hex, amt) {
    let usePound = false;
    if (hex[0] === "#") { hex = hex.slice(1); usePound = true; }
    let num = parseInt(hex, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255; else if (r < 0) r = 0;
    let g = ((num >> 8) & 0x00FF) + amt;
    if (g > 255) g = 255; else if (g < 0) g = 0;
    let b = (num & 0x0000FF) + amt;
    if (b > 255) b = 255; else if (b < 0) b = 0;
    return (usePound ? "#" : "") + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
}

/* ──────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */

/** Format currency */
window.formatINR = function (n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

/** Format date/time */
window.formatDateTime = function (iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
};

/** Relative time */
window.timeAgo = function (iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

/** Status badge HTML */
window.statusBadge = function (status) {
    const map = {
        Pending: 'badge-pending',
        Preparing: 'badge-preparing',
        Served: 'badge-served',
        Paid: 'badge-paid',
        Cancelled: 'badge-cancelled',
    };
    return `<span class="badge ${map[status] || 'badge-grey'}">${status}</span>`;
};

/** Category emoji fallback */
window.CATEGORY_EMOJI = {
    'Starters': '🥗',
    'Soups': '🍲',
    'Main Course': '🍛',
    'Breads': '🫓',
    'Rice & Biryani': '🍚',
    'South Indian': '🥞',
    'Chaat': '🥙',
    'Thali': '🍱',
    'Desserts': '🍮',
    'Beverages': '🥤',
};

/* ──────────────────────────────────────────────────────────────
   COUNT-UP ANIMATION
   ──────────────────────────────────────────────────────────── */
window.countUp = function (el, target, prefix = '', suffix = '', duration = 1200) {
    let start = null;
    const from = 0;
    const step = (ts) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(from + (target - from) * ease);
        el.textContent = prefix + current.toLocaleString('en-IN') + suffix;
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
};

/* ──────────────────────────────────────────────────────────────
   INIT ON DOM READY
   ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    injectSidebar();
});

/**
 * Global food image error handler
 */
/**
 * Global food image error handler (UNIQUENESS & QUALITY)
 */
window.handleFoodImgError = async function (img, category, name = '', id = '') {
    if (img.dataset.failed) return;

    // Track attempts
    let attempt = parseInt(img.dataset.attempt || '0', 10);
    img.dataset.attempt = ++attempt;

    // Try Backward Proxy with ID for true uniqueness
    if (attempt === 1) {
        try {
            const q = name || img.alt || 'food';
            const res = await fetch(`/api/menu/auto-image?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&id=${id}`);
            const json = await res.json();
            if (json.success && json.imageUrl) {
                img.src = json.imageUrl;
                return;
            }
        } catch (e) {
            console.error('[ImageFallback] Backend Proxy failed:', e.message);
        }
    }

    // If proxy failed or multiple errors, show final fallback
    img.dataset.failed = "true";
    img.classList.add('broken');
    img.style.display = 'none';

    const parent = img.parentElement;
    if (parent && !parent.querySelector('.food-img-fallback')) {
        const fb = document.createElement('div');
        fb.className = 'food-img-fallback';
        fb.style.opacity = '1';
        fb.style.position = 'relative';
        fb.style.height = '100%';
        fb.innerHTML = `
            <div style="font-size: 2.3rem">${window.CATEGORY_EMOJI?.[category] || '🍽️'}</div>
            <div class="food-img-fallback-text">${category || 'Food Item'}</div>
        `;
        parent.appendChild(fb);
    }
};
