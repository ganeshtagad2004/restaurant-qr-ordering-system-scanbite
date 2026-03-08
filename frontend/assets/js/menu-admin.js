'use strict';
/* ================================================================
   menu-admin.js — ScanBite Menu Management
   ================================================================ */

const CATEGORIES = [
    'Starters', 'Soups', 'Main Course', 'Breads',
    'Rice & Biryani', 'South Indian', 'Chaat', 'Thali', 'Desserts', 'Beverages',
];

let allItems = [];
let editingId = null;
let pendingDelId = null;
let selectedFile = null;

/* ── Init ─────────────────────────────────────────────────────── */
async function init() {
    const admin = await requireAuth();
    if (!admin) return;
    buildCategoryFilter();
    await loadMenuItems();
    bindFormEvents();
    bindSearch();
    bindModal();
}

/* ── Build category filter dropdown ──────────────────────────── */
function buildCategoryFilter() {
    const sel = document.getElementById('categoryFilter');
    if (!sel) return;
    CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = `${CATEGORY_EMOJI[cat] || ''} ${cat}`;
        sel.appendChild(opt);
    });
}

/* ── Load items ───────────────────────────────────────────────── */
async function loadMenuItems() {
    try {
        const res = await fetch(`/api/menu?t=${Date.now()}`, { credentials: 'include' });
        const json = await res.json();
        if (!json.success) { showToast(json.message, 'error'); return; }
        allItems = json.data;
        updateSubtitle();
        applyFilters();
    } catch (err) {
        console.error('[loadMenu]', err);
        showToast('Failed to load menu items.', 'error');
    }
}

function updateSubtitle() {
    const el = document.getElementById('menuCount');
    if (el) el.textContent = `${allItems.length} item${allItems.length !== 1 ? 's' : ''} total`;
    const cnt = document.getElementById('menuItemCount');
    if (cnt) cnt.textContent = `${allItems.length} item${allItems.length !== 1 ? 's' : ''}`;
}

/* ── Render grid ──────────────────────────────────────────────── */
function renderGrid(items) {
    const grid = document.getElementById('menuItemsGrid');
    const empty = document.getElementById('menuEmptyState');
    if (!grid) return;

    if (!items.length) {
        grid.innerHTML = '';
        grid.appendChild(empty || makeEmpty());
        return;
    }

    grid.innerHTML = items.map(item => `
    <div class="menu-card" data-id="${item._id}">
      <div class="food-img-container">
        ${item.imageUrl
            ? `<img class="food-img" src="${item.imageUrl}" alt="${item.name}" loading="lazy" onerror="handleFoodImgError(this, '${item.category}', '${item.name.replace(/'/g, "\\'")}', '${item._id}')"/>`
            : `<div class="food-img-fallback" style="opacity:1"><div style="font-size:2rem">${CATEGORY_EMOJI[item.category] || '🍽️'}</div><div class="food-img-fallback-text">${item.category}</div></div>`}
        
        <!-- Veg badge (pure veg) -->
        <div class="veg-badge" aria-label="Pure Veg" title="Pure Veg"></div>
        <!-- Popular badge if orderCount > 0 -->
        ${item.orderCount > 10 ? '<div class="popular-badge" aria-label="Popular">Popular</div>' : ''}
      </div>

      <div class="menu-card-body">
        <div class="menu-card-category">${item.category}</div>
        <div class="menu-card-name">${item.name}</div>
        ${item.description ? `<div class="menu-card-desc">${item.description}</div>` : ''}
      </div>

      <div class="menu-card-footer">
        <div class="menu-card-price"><span>₹</span>${Number(item.price).toLocaleString('en-IN')}</div>

        <div style="display:flex;gap:6px;align-items:center">
          <!-- Availability toggle (small) -->
          <label class="toggle" title="${item.isAvailable ? 'Available' : 'Unavailable'}"
            style="width:34px;height:18px">
            <input type="checkbox" ${item.isAvailable ? 'checked' : ''}
              onchange="toggleAvail('${item._id}',this.checked)" aria-label="Toggle availability"/>
            <span class="toggle-slider" style="border-radius:50px"></span>
          </label>

          <button class="table-btn table-btn-edit" onclick="startEdit('${item._id}')" aria-label="Edit ${item.name}">✏️</button>
          <button class="table-btn table-btn-delete" onclick="openDeleteModal('${item._id}','${item.name.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}

function makeEmpty() {
    const d = document.createElement('div');
    d.className = 'empty-state';
    d.innerHTML = `<div class="empty-state-icon">🍽️</div>
    <div class="empty-state-title">No items match</div>
    <div class="empty-state-desc">Try a different search or category</div>`;
    return d;
}

/* ── Search & filter ──────────────────────────────────────────── */
window.applyFilters = function () {
    const searchEl = document.getElementById('menuSearch');
    const catEl = document.getElementById('categoryFilter');
    const q = (searchEl?.value || '').toLowerCase().trim();
    const cat = catEl?.value || '';
    const filtered = allItems.filter(i =>
        (!q || i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)) &&
        (!cat || i.category === cat)
    );
    renderGrid(filtered);
    const cnt = document.getElementById('menuItemCount');
    if (cnt) cnt.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
};

function bindSearch() {
    const searchEl = document.getElementById('menuSearch');
    const catEl = document.getElementById('categoryFilter');
    searchEl?.addEventListener('input', applyFilters);
    catEl?.addEventListener('change', applyFilters);
}

/* ── Image preview ────────────────────────────────────────────── */
function bindFormEvents() {
    const imageInput = document.getElementById('itemImage');
    const previewWrap = document.getElementById('imagePreviewWrap');
    const previewImg = document.getElementById('imagePreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    const removeBtn = document.getElementById('removeImageBtn');
    const availToggle = document.getElementById('itemAvailable');
    const availLabel = document.getElementById('availableLabel');

    imageInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = ev => {
            previewImg.src = ev.target.result;
            previewWrap.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    });

    removeBtn?.addEventListener('click', () => {
        selectedFile = null;
        imageInput.value = '';
        previewImg.src = '';
        previewWrap.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
    });

    availToggle?.addEventListener('change', () => {
        if (availLabel) availLabel.textContent = availToggle.checked ? 'Available' : 'Unavailable';
    });

    document.getElementById('resetFormBtn')?.addEventListener('click', resetForm);
    document.getElementById('menuItemForm')?.addEventListener('submit', handleSubmit);
}

/* ── Submit (add or edit) ─────────────────────────────────────── */
async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const btn = document.getElementById('menuSubmitBtn');
    setLoading(btn, true);

    const fd = new FormData();
    fd.append('name', document.getElementById('itemName').value.trim());
    fd.append('description', document.getElementById('itemDesc').value.trim());
    fd.append('price', document.getElementById('itemPrice').value);
    fd.append('category', document.getElementById('itemCategory').value);
    fd.append('isAvailable', document.getElementById('itemAvailable').checked);
    fd.append('isVeg', 'true');
    if (selectedFile) fd.append('image', selectedFile);

    try {
        const url = editingId ? `/api/menu/${editingId}` : '/api/menu';
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, { method, credentials: 'include', body: fd });
        const json = await res.json();

        if (json.success) {
            showToast(editingId ? 'Item updated!' : 'Item added!', 'success');

            // Update local state for instant feedback
            if (editingId) {
                const idx = allItems.findIndex(i => i._id === editingId);
                if (idx !== -1) allItems[idx] = json.data;
            } else {
                allItems.unshift(json.data);
            }
            resetForm();
            applyFilters();
            updateSubtitle();

            // Background sync
            loadMenuItems();
        } else {
            showToast(json.message || 'Failed to save item.', 'error');
        }
    } catch (err) {
        console.error('[menuSubmit]', err);
        showToast('Server error. Please try again.', 'error');
    } finally {
        setLoading(btn, false);
    }
}

function validateForm() {
    let ok = true;
    const name = document.getElementById('itemName').value.trim();
    const price = parseFloat(document.getElementById('itemPrice').value);
    const cat = document.getElementById('itemCategory').value;

    const show = (id, msg) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = msg; el.style.display = 'flex'; }
        ok = false;
    };
    const clear = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

    clear('nameErr'); clear('priceErr'); clear('categoryErr');

    if (!name) show('nameErr', 'Item name is required.');
    if (isNaN(price) || price < 0) show('priceErr', 'Enter a valid price (≥ 0).');
    if (!cat) show('categoryErr', 'Please select a category.');

    return ok;
}

/* ── Edit mode ────────────────────────────────────────────────── */
window.startEdit = function (id) {
    const item = allItems.find(i => i._id === id);
    if (!item) return;

    editingId = id;
    document.getElementById('editItemId').value = id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDesc').value = item.description || '';
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemAvailable').checked = item.isAvailable;
    document.getElementById('availableLabel').textContent = item.isAvailable ? 'Available' : 'Unavailable';

    const previewWrap = document.getElementById('imagePreviewWrap');
    const previewImg = document.getElementById('imagePreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    if (item.imageUrl) {
        previewImg.src = item.imageUrl;
        previewWrap.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        previewWrap.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
    }

    document.getElementById('formTitle').textContent = 'Edit Menu Item';
    document.getElementById('resetFormBtn').style.display = 'inline-flex';
    const btn = document.getElementById('menuSubmitBtn');
    btn.querySelector('.btn-text').textContent = '💾 Save Changes';

    // Scroll form into view on mobile
    document.getElementById('menuFormPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function resetForm() {
    editingId = null;
    selectedFile = null;
    document.getElementById('menuItemForm').reset();
    document.getElementById('editItemId').value = '';
    document.getElementById('formTitle').textContent = 'Add Menu Item';
    document.getElementById('resetFormBtn').style.display = 'none';
    document.getElementById('menuSubmitBtn').querySelector('.btn-text').textContent = '➕ Add Item';
    document.getElementById('imagePreviewWrap').style.display = 'none';
    const ph = document.getElementById('uploadPlaceholder');
    if (ph) ph.style.display = 'block';
    document.getElementById('availableLabel').textContent = 'Available';
    ['nameErr', 'priceErr', 'categoryErr'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

/* ── Toggle availability ──────────────────────────────────────── */
window.toggleAvail = async function (id, val) {
    try {
        const res = await fetch(`/api/menu/${id}/toggle`, { method: 'PATCH', credentials: 'include' });
        const json = await res.json();
        if (!json.success) {
            showToast(json.message, 'error');
            await loadMenuItems();
        } else {
            showToast(json.message, 'success');
            const item = allItems.find(i => i._id === id);
            if (item) item.isAvailable = json.data.isAvailable;
            applyFilters();
        }
    } catch (err) { showToast('Failed to toggle.', 'error'); }
};

/* ── Delete modal ─────────────────────────────────────────────── */
function bindModal() {
    document.getElementById('closeDeleteModal')?.addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);
}

window.openDeleteModal = function (id, name) {
    pendingDelId = id;
    const nameEl = document.getElementById('deleteItemName');
    if (nameEl) nameEl.textContent = name;
    document.getElementById('deleteModal')?.classList.remove('hidden');
};

function closeDeleteModal() {
    pendingDelId = null;
    document.getElementById('deleteModal')?.classList.add('hidden');
}

async function confirmDelete() {
    if (!pendingDelId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true; btn.textContent = '⏳ Deleting…';
    try {
        const res = await fetch(`/api/menu/${pendingDelId}`, { method: 'DELETE', credentials: 'include' });
        const json = await res.json();
        if (json.success) {
            showToast('Item deleted.', 'success');
            closeDeleteModal();
            if (editingId === pendingDelId) resetForm();
            await loadMenuItems();
        } else {
            showToast(json.message || 'Delete failed.', 'error');
        }
    } catch (err) {
        showToast('Server error.', 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Delete';
    }
}

/* ── Loading helper ───────────────────────────────────────────── */
function setLoading(btn, on) {
    btn.disabled = on;
    const t = btn.querySelector('.btn-text');
    if (on) t.innerHTML = '<span class="btn-spinner"></span> Saving…';
    else t.textContent = editingId ? '💾 Save Changes' : '➕ Add Item';
}

/* ── Boot ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
