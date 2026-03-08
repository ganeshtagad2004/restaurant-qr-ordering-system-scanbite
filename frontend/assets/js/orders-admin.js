'use strict';
/* ================================================================
   orders-admin.js — ScanBite Orders Management
   ================================================================ */

const STATUS_OPTIONS = ['Pending', 'Preparing', 'Served', 'Paid', 'Cancelled'];
let allOrders = [];
let activeFilter = 'all';
let refreshTimer = null;
let liveClockTimer = null;
let timeAgoTimer = null;
let selectedIds = new Set();

/* ── Init ─────────────────────────────────────────────────────── */
async function init() {
    const admin = await requireAuth();
    if (!admin) return;
    bindFilterTabs();
    bindBulkActions();
    await loadOrders();
    startAutoRefresh();
    startLiveClock();
    startTimeAgoRefresh();
}

/* ── Filter tabs ──────────────────────────────────────────────── */
function bindFilterTabs() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            activeFilter = btn.dataset.filter;
            document.querySelectorAll('[data-filter]').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-ghost');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.remove('btn-ghost');
            btn.classList.add('btn-primary');
            btn.setAttribute('aria-selected', 'true');
            renderOrders();
        });
    });
}

/* ── Load orders ──────────────────────────────────────────────── */
async function loadOrders() {
    try {
        const res = await fetch('/api/orders', { credentials: 'include' });
        const json = await res.json();
        if (!json.success) { showToast(json.message || 'Failed to load orders.', 'error'); return; }
        allOrders = json.data;
        updateSubtitle();
        renderOrders();
        updateLastRefreshed();
    } catch (err) {
        console.error('[loadOrders]', err);
        showToast('Could not reach server.', 'error');
    }
}

function updateSubtitle() {
    const el = document.getElementById('ordersSubtitle');
    if (el) el.textContent = `${allOrders.length} total order${allOrders.length !== 1 ? 's' : ''} · Auto-refreshes every 15s`;
}

function updateLastRefreshed() {
    const el = document.getElementById('lastRefreshed');
    if (el) el.textContent = `Last refreshed: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

/* ── Render order cards ───────────────────────────────────────── */
function renderOrders() {
    const board = document.getElementById('ordersBoard');
    const empty = document.getElementById('ordersEmpty');
    if (!board) return;

    const filtered = activeFilter === 'all'
        ? allOrders
        : allOrders.filter(o => o.status === activeFilter);

    if (!filtered.length) {
        board.innerHTML = '';
        const msg = activeFilter === 'all' ? 'No orders yet' : `No ${activeFilter} orders`;
        const sub = activeFilter === 'all'
            ? 'Orders placed by customers will appear here'
            : 'Orders with this status will appear here';
        board.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon" aria-hidden="true">🔔</div>
        <div class="empty-state-title">${msg}</div>
        <div class="empty-state-desc">${sub}</div>
      </div>`;
        return;
    }

    board.innerHTML = filtered.map(order => {
        const itemsHtml = order.items.map(i =>
            `<div class="order-item-row">
        <span class="order-item-name">🌿 ${i.name}</span>
        <span class="order-item-qty">×${i.quantity}</span>
        <span class="order-item-price">${formatINR(i.price * i.quantity)}</span>
      </div>`
        ).join('');

        const options = STATUS_OPTIONS.map(s =>
            `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`
        ).join('');

        const isChecked = selectedIds.has(order._id);

        return `
    <article class="order-card ${isChecked ? 'selected' : ''}" data-id="${order._id}">
      <div class="order-card-header">
        <div style="display:flex; align-items:center; gap:12px">
            <input type="checkbox" class="order-checkbox" value="${order._id}" 
                   ${isChecked ? 'checked' : ''} 
                   onchange="toggleOrderSelection('${order._id}')" 
                   style="width:18px;height:18px;cursor:pointer"/>
            <div>
              <div class="order-card-num">🪑 Table ${order.tableNumber}</div>
              <div class="order-timestamp" data-created="${order.createdAt}" style="font-size:.72rem;color:var(--muted);margin-top:2px">${timeAgo(order.createdAt)}</div>
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px">
            ${statusBadge(order.status)}
            <button class="btn btn-ghost btn-sm" onclick="deleteSingleOrder('${order._id}')" 
                    style="padding:5px; color:var(--danger); font-size:1.1rem" title="Delete Order">🗑️</button>
        </div>
      </div>
      <div class="order-card-body">
        ${itemsHtml}
        ${order.specialInstructions
                ? `<div style="margin-top:8px;padding:8px 10px;background:#fffbf7;border-left:3px solid var(--gold);border-radius:0 6px 6px 0;font-size:.78rem;color:var(--muted)">
              📝 ${order.specialInstructions}
             </div>` : ''}
      </div>
      <div class="order-card-footer">
        <div>
          <div class="order-total-label">Total</div>
          <div class="order-total">${formatINR(order.subtotal)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <select class="status-select" aria-label="Update status for table ${order.tableNumber}"
            onchange="updateOrderStatus('${order._id}', this.value, this)">
            ${options}
          </select>
          <label style="display:flex;align-items:center;gap:7px;font-size:.75rem;color:var(--muted);cursor:pointer">
            <input type="checkbox" ${order.paymentStatus === 'Paid' ? 'checked' : ''}
              onchange="togglePayment('${order._id}',this.checked)" aria-label="Mark as paid"/>
            💳 Paid
          </label>
        </div>
      </div>
    </article>`;
    }).join('');
}

/* ── Bulk Actions & Selection ─────────────────────────────────── */
function bindBulkActions() {
    const selectAll = document.getElementById('selectAllOrders');
    const deleteBtn = document.getElementById('deleteSelectedBtn');

    selectAll?.addEventListener('change', (e) => {
        if (e.target.checked) {
            allOrders.forEach(o => selectedIds.add(o._id));
        } else {
            selectedIds.clear();
        }
        updateBulkPanel();
        renderOrders();
    });

    deleteBtn?.addEventListener('click', deleteSelectedOrders);
}

window.toggleOrderSelection = function (id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    updateBulkPanel();

    // Update card styling instantly
    const card = document.querySelector(`.order-card[data-id="${id}"]`);
    if (card) card.classList.toggle('selected');

    // Manage Select All checkbox state
    const selectAll = document.getElementById('selectAllOrders');
    if (selectAll) {
        selectAll.checked = selectedIds.size > 0 && selectedIds.size === allOrders.length;
        selectAll.indeterminate = selectedIds.size > 0 && selectedIds.size < allOrders.length;
    }
};

function updateBulkPanel() {
    const panel = document.getElementById('bulkActionsPanel');
    const countEl = document.getElementById('selectedCount');
    if (!panel) return;

    if (selectedIds.size > 0) {
        panel.style.display = 'flex';
        countEl.textContent = `${selectedIds.size} order${selectedIds.size !== 1 ? 's' : ''} selected`;
    } else {
        panel.style.display = 'none';
        const selectAll = document.getElementById('selectAllOrders');
        if (selectAll) selectAll.checked = false;
    }
}

/* ── Deletion Logic ───────────────────────────────────────────── */
window.deleteSingleOrder = async function (id) {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
        const res = await fetch(`/api/orders/${id}`, { method: 'DELETE', credentials: 'include' });
        const json = await res.json();
        if (json.success) {
            showToast('Order deleted.', 'success');
            allOrders = allOrders.filter(o => o._id !== id);
            selectedIds.delete(id);
            updateBulkPanel();
            renderOrders();
            updateSubtitle();
        } else {
            showToast(json.message || 'Delete failed.', 'error');
        }
    } catch (err) {
        showToast('Server error.', 'error');
    }
};

async function deleteSelectedOrders() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected orders?`)) return;

    try {
        const res = await fetch('/api/orders/bulk-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderIds: Array.from(selectedIds) })
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message, 'success');
            const deletedSet = new Set(selectedIds);
            allOrders = allOrders.filter(o => !deletedSet.has(o._id));
            selectedIds.clear();
            updateBulkPanel();
            renderOrders();
            updateSubtitle();
        } else {
            showToast(json.message || 'Bulk delete failed.', 'error');
        }
    } catch (err) {
        showToast('Server error.', 'error');
    }
}

/* ── Live Updates (Clock & Time Ago) ─────────────────────────── */
function startLiveClock() {
    const clockEl = document.getElementById('liveClock');
    const update = () => {
        if (!clockEl) return;
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };
    update();
    liveClockTimer = setInterval(update, 1000);
}

function startTimeAgoRefresh() {
    // Refresh timeAgo strings every 30 seconds to keep them live
    timeAgoTimer = setInterval(() => {
        document.querySelectorAll('.order-timestamp').forEach(el => {
            const iso = el.dataset.created;
            if (iso) el.textContent = timeAgo(iso);
        });
    }, 30000);
}

/* ── Update order status ──────────────────────────────────────── */
window.updateOrderStatus = async function (id, status, selectEl) {
    const prev = selectEl.dataset.prev || selectEl.value;
    try {
        const res = await fetch(`/api/orders/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status }),
        });
        const json = await res.json();
        if (json.success) {
            showToast(`Order → ${status}`, 'success');
            selectEl.dataset.prev = status;
            // Update local state without full reload
            const order = allOrders.find(o => o._id === id);
            if (order) order.status = status;
            // Refresh badge in header
            const card = selectEl.closest('.order-card');
            if (card) {
                const badgeEl = card.querySelector('.badge');
                if (badgeEl && badgeEl.parentElement === card.querySelector('.order-card-header')) {
                    badgeEl.outerHTML = statusBadge(status);
                }
            }
        } else {
            showToast(json.message || 'Update failed.', 'error');
            selectEl.value = prev;
        }
    } catch (err) {
        showToast('Server error.', 'error');
        selectEl.value = prev;
    }
};

/* ── Toggle payment ───────────────────────────────────────────── */
window.togglePayment = async function (id, paid) {
    try {
        const res = await fetch(`/api/orders/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ paymentStatus: paid ? 'Paid' : 'Unpaid' }),
        });
        const json = await res.json();
        if (json.success) showToast(`Payment marked as ${paid ? 'Paid' : 'Unpaid'}.`, 'success');
        else showToast(json.message, 'error');
    } catch (_) { showToast('Server error.', 'error'); }
};

/* ── Auto-refresh every 15s ───────────────────────────────────── */
function startAutoRefresh() {
    refreshTimer = setInterval(async () => {
        await loadOrders();
    }, 15000);
}

/* ── Manual refresh ───────────────────────────────────────────── */
document.getElementById('refreshOrdersBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshOrdersBtn');
    btn.disabled = true; btn.textContent = '⏳…';
    await loadOrders();
    btn.disabled = false; btn.textContent = '🔄 Refresh';
    showToast('Orders refreshed.', 'success');
});

/* ── Clean up on page leave ───────────────────────────────────── */
window.addEventListener('beforeunload', () => {
    if (refreshTimer) clearInterval(refreshTimer);
});

/* ── Boot ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
