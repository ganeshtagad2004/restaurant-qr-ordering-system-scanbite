'use strict';
/* ================================================================
   tables-admin.js — ScanBite Tables & QR Management
   ================================================================ */

let allTables = [];
let pendingDelId = null;
let selectedIds = new Set();

/* ── Init ─────────────────────────────────────────────────────── */
async function init() {
    const admin = await requireAuth();
    if (!admin) return;
    await loadTables();
    bindGenerate();
    bindBulkActions();
    bindModal();
}

/* ── Load tables ──────────────────────────────────────────────── */
async function loadTables() {
    try {
        const res = await fetch('/api/tables', { credentials: 'include' });
        const json = await res.json();
        if (!json.success) { showToast(json.message || 'Failed to load tables.', 'error'); return; }
        allTables = json.data;
        selectedIds.clear();
        updateBulkPanel();
        updateSubtitle();
        renderTables();
    } catch (err) {
        console.error('[loadTables]', err);
        showToast('Could not reach server.', 'error');
    }
}

function updateSubtitle() {
    const el = document.getElementById('tableCount');
    if (el) el.textContent = `${allTables.length} table${allTables.length !== 1 ? 's' : ''} configured`;
}

/* ── Render table cards ───────────────────────────────────────── */
function renderTables() {
    const grid = document.getElementById('tablesGrid');
    const empty = document.getElementById('tablesEmpty');
    if (!grid) return;

    if (!allTables.length) {
        grid.innerHTML = '';
        if (empty) grid.appendChild(empty);
        else grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon" aria-hidden="true">🪑</div>
        <div class="empty-state-title">No tables yet</div>
        <div class="empty-state-desc">Generate tables above to create QR codes</div>
      </div>`;
        return;
    }

    grid.innerHTML = allTables.map(table => `
    <div class="table-qr-card" data-id="${table._id}">
      <!-- Checkbox for multi-select -->
      <label class="table-check" aria-label="Select table ${table.tableNumber}">
        <input type="checkbox" class="table-checkbox" value="${table._id}" 
               ${selectedIds.has(table._id) ? 'checked' : ''} 
               onchange="toggleTableSelection('${table._id}')" />
      </label>

      <!-- QR image -->
      <div class="table-qr-img">
        ${table.qrCodeDataUrl
            ? `<img src="${table.qrCodeDataUrl}" alt="QR Code for Table ${table.tableNumber}" style="width:100%;border-radius:6px"/>`
            : `<div style="width:100%;aspect-ratio:1;background:var(--bg);display:grid;place-items:center;font-size:2rem;border-radius:6px">📷</div>`}
      </div>

      <div class="table-qr-num">Table ${table.tableNumber}</div>
      <div class="table-qr-status" style="font-size:.72rem;color:var(--muted);word-break:break-all;margin-bottom:14px;padding:0 4px">
        ${table.qrLink || '—'}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        ${table.qrCodeDataUrl
            ? `<button class="btn btn-outline btn-sm btn-full" onclick="downloadQR('${table.qrCodeDataUrl.replace(/'/g, "\\'")}',${table.tableNumber})"
               aria-label="Download QR code for table ${table.tableNumber}">
               ⬇️ Download QR
             </button>`
            : ''}
        <button class="btn btn-danger btn-sm btn-full"
          onclick="openDeleteTableModal('${table._id}','Table ${table.tableNumber}')"
          aria-label="Delete table ${table.tableNumber}">
          🗑️ Delete
        </button>
      </div>
    </div>`
    ).join('');
}

/* ── Selection logic ─────────────────────────────────────────── */
window.toggleTableSelection = function (id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    updateBulkPanel();
};

function updateBulkPanel() {
    const panel = document.getElementById('bulkActionsPanel');
    const countEl = document.getElementById('selectedCount');
    const selectAll = document.getElementById('selectAllTables');

    if (!panel) return;

    if (selectedIds.size > 0) {
        panel.style.display = 'block';
        countEl.textContent = `${selectedIds.size} table${selectedIds.size !== 1 ? 's' : ''} selected`;
    } else {
        panel.style.display = 'none';
    }

    if (selectAll) {
        selectAll.checked = selectedIds.size > 0 && selectedIds.size === allTables.length;
        selectAll.indeterminate = selectedIds.size > 0 && selectedIds.size < allTables.length;
    }
}

function bindBulkActions() {
    const selectAll = document.getElementById('selectAllTables');
    const deleteBtn = document.getElementById('deleteSelectedBtn');

    selectAll?.addEventListener('change', (e) => {
        if (e.target.checked) {
            allTables.forEach(t => selectedIds.add(t._id));
        } else {
            selectedIds.clear();
        }
        updateBulkPanel();
        renderTables();
    });

    deleteBtn?.addEventListener('click', () => {
        if (selectedIds.size === 0) return;
        openDeleteTableModal('bulk', `${selectedIds.size} selected tables`);
    });
}

/* ── Download QR ──────────────────────────────────────────────── */
window.downloadQR = function (dataUrl, tableNumber) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `table-${tableNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`QR for Table ${tableNumber} downloaded!`, 'success');
};

/* ── Generate tables ──────────────────────────────────────────── */
function bindGenerate() {
    const btn = document.getElementById('generateBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const input = document.getElementById('tableCountInput');
        const count = parseInt(input?.value || '0', 10);
        if (!count || count < 1) { showToast('Please enter a number ≥ 1.', 'warning'); return; }
        if (count > 200) { showToast('Maximum 200 tables at a time.', 'warning'); return; }

        setLoading(btn, true);
        try {
            const res = await fetch('/api/tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ count }),
            });
            const json = await res.json();
            if (json.success) {
                showToast(json.message || `${json.data.length} table(s) generated!`, 'success');
                if (input) input.value = '';
                await loadTables();
            } else {
                showToast(json.message || 'Generation failed.', 'error');
            }
        } catch (err) {
            console.error('[generateTables]', err);
            showToast('Server error. Please try again.', 'error');
        } finally {
            setLoading(btn, false);
        }
    });
}

/* ── Delete modal ─────────────────────────────────────────────── */
function bindModal() {
    document.getElementById('closeTableDeleteModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelTableDeleteBtn')?.addEventListener('click', closeModal);
    document.getElementById('confirmTableDeleteBtn')?.addEventListener('click', confirmDelete);
}

window.openDeleteTableModal = function (id, name) {
    pendingDelId = id;
    const nameEl = document.getElementById('deleteTableName');
    if (nameEl) nameEl.textContent = name;
    document.getElementById('deleteTableModal')?.classList.remove('hidden');
};

function closeModal() {
    pendingDelId = null;
    document.getElementById('deleteTableModal')?.classList.add('hidden');
}

async function confirmDelete() {
    if (!pendingDelId) return;
    const btn = document.getElementById('confirmTableDeleteBtn');
    btn.disabled = true; btn.textContent = '⏳ Deleting…';

    try {
        let res, json;
        if (pendingDelId === 'bulk') {
            res = await fetch('/api/tables', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tableIds: Array.from(selectedIds) })
            });
        } else {
            res = await fetch(`/api/tables/${pendingDelId}`, { method: 'DELETE', credentials: 'include' });
        }

        json = await res.json();
        if (json.success) {
            showToast(json.message || 'Deleted successfully.', 'success');
            closeModal();
            await loadTables();
        } else {
            showToast(json.message || 'Delete failed.', 'error');
        }
    } catch (err) {
        showToast('Server error.', 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Delete';
    }
}

function setLoading(btn, on) {
    btn.disabled = on;
    const t = btn.querySelector('.btn-text');
    if (t) t.innerHTML = on ? '<span class="btn-spinner"></span> Generating…' : '⚡ Generate QR Codes';
}

/* ── Boot ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
