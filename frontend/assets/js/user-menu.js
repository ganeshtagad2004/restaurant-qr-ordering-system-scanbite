'use strict';
/* ================================================================
   user-menu.js — ScanBite Customer QR Menu
   URL: /user/menu.html?r=SLUG&table=N
   ================================================================ */

/* ──────────────────────────────────────────────────────────────
   CONSTANTS & STATE
   ──────────────────────────────────────────────────────────── */
const CATEGORY_ORDER = [
    'Starters', 'Soups', 'Main Course', 'Breads',
    'Rice & Biryani', 'South Indian', 'Chaat', 'Thali', 'Desserts', 'Beverages',
];

const CATEGORY_EMOJI = {
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

const GST_RATE = 0.05;

/* ── URL params ────────────────────────────────────────────── */
const params = new URLSearchParams(location.search);
const slug = params.get('r');
const tableNo = params.get('t') || params.get('table');

/* ── Session ──────────────────────────────────────────────────
   Generate a stable session ID per slug+table per browser session
   ──────────────────────────────────────────────────────────── */
const SESSION_KEY = `session_${slug}_${tableNo}`;
let sessionId = localStorage.getItem(SESSION_KEY);
if (!sessionId) {
    sessionId = `${slug}_t${tableNo}_${Date.now()}`;
    localStorage.setItem(SESSION_KEY, sessionId);
}

/* ── App state ──────────────────────────────────────────────── */
let cart = {};    // { itemId: { menuItemId, name, price, quantity, imageUrl, category } }
let allItems = [];    // full menu from server
let filtered = [];    // after search
let activeCat = '';   // currently highlighted tab

/* ──────────────────────────────────────────────────────────────
   TOAST
   ──────────────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const titles = { success: 'Done!', error: 'Oops!', info: 'Note', warning: 'Heads up' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', 'alert');
    t.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${titles[type] || 'Notice'}</div>
      <div class="toast-msg">${esc(message)}</div>
    </div>
    <button class="toast-close" aria-label="Close">✕</button>`;
    tc.appendChild(t);
    const remove = () => { t.classList.add('removing'); setTimeout(() => t.remove(), 220); };
    t.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, 4500);
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatINR(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* ──────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    /* Validate params */
    const table = parseInt(tableNo, 10);
    if (!slug || isNaN(table) || table < 1) {
        if (!slug) {
            showError('This link is missing the restaurant (r=) parameter.');
        } else {
            showError('Invalid table number. Please check the QR code.');
        }
        return;
    }

    /* Update UI with table info */
    document.getElementById('tableBadge').textContent = `🪑 Table ${tableNo}`;
    document.getElementById('successTableBadge').textContent = `🪑 Table ${tableNo}`;

    /* Bind events */
    bindSearch();
    bindCartEvents();
    bindBillEvents();
    bindOverlay();

    /* Load menu */
    loadMenu();
});

/* ──────────────────────────────────────────────────────────────
   ERROR SCREEN
   ──────────────────────────────────────────────────────────── */
function showError(msg) {
    document.getElementById('errorScreen').classList.add('show');
    document.getElementById('menuHeader').style.display = 'none';
    document.getElementById('searchBar').style.display = 'none';
    document.getElementById('categoryTabsWrap').style.display = 'none';
    document.getElementById('menuContent').style.display = 'none';
    document.getElementById('menuFooter').style.display = 'none';
    if (msg) document.getElementById('errorMsg').textContent = msg;
}

/* ──────────────────────────────────────────────────────────────
   LOAD MENU
   ──────────────────────────────────────────────────────────── */
async function loadMenu() {
    renderSkeleton();
    try {
        const res = await fetch(`/api/menu/${encodeURIComponent(slug)}?t=${encodeURIComponent(tableNo)}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
            showError(json.message || 'Restaurant not found. Please scan the QR code again.');
            return;
        }

        const menuData = json.data || {};
        allItems = menuData.menuItems || [];
        filtered = [...allItems];

        // Update restaurant details if provided
        if (menuData.restaurant) {
            const logoEl = document.getElementById('restaurantLogo');
            if (logoEl && menuData.restaurant.logo) logoEl.src = menuData.restaurant.logo;
            const nameEl = document.getElementById('restaurantName');
            if (nameEl) nameEl.textContent = menuData.restaurant.name;
        }

        if (!allItems.length) {
            document.getElementById('menuContent').innerHTML = `
        <div class="no-results">
          <div class="no-results-icon" aria-hidden="true">🍽️</div>
          <div class="no-results-title">Menu coming soon!</div>
          <div class="no-results-sub">The restaurant is still setting up their menu.</div>
        </div>`;
            document.getElementById('categoryTabs').innerHTML = '';
            return;
        }

        // Use categories from API or build them from items
        const catList = menuData.categories || [...new Set(allItems.map(i => i.category))];
        buildCategoryTabs(catList);
        renderMenu(allItems);
    } catch (err) {
        console.error('[loadMenu]', err);
        showError('Could not connect to server. Please check your connection and try again.');
    }
}

/* ── Skeleton while loading ───────────────────────────────── */
function renderSkeleton() {
    const content = document.getElementById('menuContent');
    let html = '';
    for (let s = 0; s < 2; s++) {
        html += `<div class="menu-section">
      <div class="section-heading">
        <div class="skel skel-line" style="height:20px;width:160px;border-radius:4px;"></div>
      </div>
      <div class="skeleton-grid">
        ${Array.from({ length: 4 }).map(() => `
          <div class="skeleton-card">
            <div class="skel skel-img"></div>
            <div class="skel-body">
              <div class="skel skel-line wide"></div>
              <div class="skel skel-line med"></div>
              <div class="skel skel-line short"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
    }
    content.innerHTML = html;
}

/* ──────────────────────────────────────────────────────────────
   BUILD CATEGORY TABS
   ──────────────────────────────────────────────────────────── */
function buildCategoryTabs(catList) {
    const tabsEl = document.getElementById('categoryTabs');
    const inDB = catList || [...new Set(allItems.map(i => i.category))];
    const cats = CATEGORY_ORDER.filter(c => inDB.includes(c));

    /* "All" tab */
    let html = `<button class="cat-tab active" data-cat="" id="tab-all" role="tab" aria-selected="true">🍽️ All</button>`;
    cats.forEach(cat => {
        html += `<button class="cat-tab" data-cat="${esc(cat)}" id="tab-${cat.replace(/\s/g, '-').replace(/&/g, '')}"
      role="tab" aria-selected="false">
      ${CATEGORY_EMOJI[cat] || ''} ${cat}
    </button>`;
    });
    tabsEl.innerHTML = html;

    tabsEl.querySelectorAll('.cat-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat;
            setActiveTab(cat);
            if (cat) {
                const sectionEl = document.getElementById(`section-${cat.replace(/\s/g, '-').replace(/[&]/g, '')}`);
                if (sectionEl) {
                    const OFFSETS = 64 + 56 + 52 + 12; // header + search + tabs + margin
                    const top = sectionEl.getBoundingClientRect().top + window.scrollY - OFFSETS;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

function setActiveTab(cat) {
    activeCat = cat;
    document.querySelectorAll('.cat-tab').forEach(btn => {
        const isActive = btn.dataset.cat === cat;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
    });
}

/* ──────────────────────────────────────────────────────────────
   RENDER MENU
   ──────────────────────────────────────────────────────────── */
function renderMenu(items) {
    const content = document.getElementById('menuContent');
    if (!items.length) {
        content.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon" aria-hidden="true">🔍</div>
        <div class="no-results-title">Nothing found</div>
        <div class="no-results-sub">Try a different search term</div>
      </div>`;
        return;
    }

    /* Group by category in ordered fashion */
    const inDB = [...new Set(allItems.map(i => i.category))];
    const cats = CATEGORY_ORDER.filter(c => inDB.includes(c));
    const catMap = {};
    cats.forEach(c => catMap[c] = []);
    items.forEach(item => { if (catMap[item.category]) catMap[item.category].push(item); });

    let html = '';
    cats.forEach(cat => {
        const catItems = catMap[cat];
        if (!catItems || !catItems.length) return;
        const sectionId = `section-${cat.replace(/\s/g, '-').replace(/[&]/g, '')}`;
        html += `
      <div class="menu-section" id="${sectionId}" aria-label="${cat} section">
        <div class="section-heading">
          <div class="section-heading-bar" aria-hidden="true"></div>
          <h2 class="section-heading-title">${CATEGORY_EMOJI[cat] || ''} ${cat}</h2>
          <span class="section-heading-count">${catItems.length} item${catItems.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="menu-items-grid">${catItems.map(buildItemCard).join('')}</div>
      </div>`;
    });
    content.innerHTML = html;
}

/* ──────────────────────────────────────────────────────────────
   BUILD ITEM CARD
   ──────────────────────────────────────────────────────────── */
function buildItemCard(item) {
    const inCart = !!cart[item._id];
    const qty = inCart ? cart[item._id].quantity : 0;
    const unavail = !item.isAvailable;
    const popular = item.orderCount > 15;

    const imgHtml = item.imageUrl
        ? `<img class="food-img" src="${item.imageUrl}" alt="${esc(item.name)}" loading="lazy" onerror="handleFoodImgError(this, '${esc(item.category)}', '${esc(item.name)}', '${item._id}')"/>`
        : `<div class="food-img-fallback" style="opacity:1"><div style="font-size:2.5rem">${CATEGORY_EMOJI[item.category] || '🍽️'}</div><div class="food-img-fallback-text">${esc(item.category)}</div></div>`;

    const overlayHtml = unavail
        ? `<div class="unavail-overlay" aria-label="Currently unavailable">Unavailable</div>` : '';

    const actionHtml = unavail
        ? `<button class="add-btn" disabled aria-disabled="true" aria-label="${esc(item.name)} unavailable">Unavailable</button>`
        : inCart
            ? `<div class="qty-controls" role="group" aria-label="Quantity for ${esc(item.name)}">
           <button class="qty-btn" onclick="changeQty('${item._id}',-1)" aria-label="Remove one">−</button>
           <span class="qty-num" id="qty-${item._id}">${qty}</span>
           <button class="qty-btn" onclick="changeQty('${item._id}',1)" aria-label="Add one">+</button>
         </div>`
            : `<button class="add-btn" onclick="addToCart('${item._id}')" aria-label="Add ${esc(item.name)} to cart">+ Add</button>`;

    return `
    <article class="item-card${unavail ? ' unavailable' : ''}" id="card-${item._id}" data-id="${item._id}">
      <div class="food-img-container">
        ${imgHtml}
        ${overlayHtml}
        <div class="veg-badge" aria-label="Pure Veg" title="100% Pure Veg"></div>
        ${popular ? `<div class="popular-badge" aria-label="Popular item">Popular</div>` : ''}
      </div>
      <div class="item-card-body">
        <div class="item-card-cat">${esc(item.category)}</div>
        <div class="item-card-name">${esc(item.name)}</div>
        ${item.description ? `<div class="item-card-desc">${esc(item.description)}</div>` : ''}
      </div>
      <div class="item-card-footer">
        <div class="item-price"><span>₹</span>${Number(item.price).toLocaleString('en-IN')}</div>
        <div id="action-${item._id}">${actionHtml}</div>
      </div>
    </article>`;
}

/* ──────────────────────────────────────────────────────────────
   CART OPERATIONS
   ──────────────────────────────────────────────────────────── */
window.addToCart = function (id) {
    const item = allItems.find(i => i._id === id);
    if (!item || !item.isAvailable) return;

    cart[id] = {
        menuItemId: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        imageUrl: item.imageUrl || '',
        category: item.category,
    };
    updateActionEl(id);
    updateCartBadges();
};

window.changeQty = function (id, delta) {
    if (!cart[id]) return;
    cart[id].quantity += delta;
    if (cart[id].quantity <= 0) {
        delete cart[id];
    }
    updateActionEl(id);
    updateCartBadges();
    /* If cart drawer is open, re-render it */
    if (document.getElementById('cartDrawer').classList.contains('open')) {
        renderCartDrawer();
    }
};

function updateActionEl(id) {
    const el = document.getElementById(`action-${id}`);
    const item = allItems.find(i => i._id === id);
    if (!el || !item) return;

    if (!cart[id]) {
        el.innerHTML = `<button class="add-btn" onclick="addToCart('${id}')" aria-label="Add ${esc(item.name)} to cart">+ Add</button>`;
    } else {
        const qty = cart[id].quantity;
        el.innerHTML = `
      <div class="qty-controls" role="group" aria-label="Quantity for ${esc(item.name)}">
        <button class="qty-btn" onclick="changeQty('${id}',-1)" aria-label="Remove one">−</button>
        <span class="qty-num" id="qty-${id}">${qty}</span>
        <button class="qty-btn" onclick="changeQty('${id}',1)" aria-label="Add one">+</button>
      </div>`;
    }
}

/* ──────────────────────────────────────────────────────────────
   BADGE & COUNT UPDATES
   ──────────────────────────────────────────────────────────── */
function totalCartItems() {
    return Object.values(cart).reduce((s, i) => s + i.quantity, 0);
}
function cartSubtotal() {
    return Object.values(cart).reduce((s, i) => s + i.price * i.quantity, 0);
}

function updateCartBadges() {
    const total = totalCartItems();
    /* Header badge */
    const headerBadge = document.getElementById('headerCartCount');
    if (headerBadge) {
        headerBadge.textContent = total;
        headerBadge.classList.toggle('show', total > 0);
    }
    /* Float badge */
    const floatBadge = document.getElementById('floatCartBadge');
    if (floatBadge) floatBadge.textContent = total;
    /* Floating button */
    const floatBtn = document.getElementById('floatingCart');
    if (floatBtn) floatBtn.classList.toggle('show', total > 0);
}

/* ──────────────────────────────────────────────────────────────
   SEARCH
   ──────────────────────────────────────────────────────────── */
function bindSearch() {
    const input = document.getElementById('menuSearch');
    const clearEl = document.getElementById('searchClear');
    if (!input) return;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        clearEl.classList.toggle('show', q.length > 0);
        const result = q
            ? allItems.filter(i =>
                i.name.toLowerCase().includes(q) ||
                (i.description || '').toLowerCase().includes(q) ||
                i.category.toLowerCase().includes(q))
            : allItems;
        filtered = result;
        renderMenu(filtered);
        /* Re-sync cart action elements */
        Object.keys(cart).forEach(id => updateActionEl(id));
        if (!q) setActiveTab('');
    });

    clearEl.addEventListener('click', () => {
        input.value = '';
        clearEl.classList.remove('show');
        filtered = [...allItems];
        renderMenu(filtered);
        Object.keys(cart).forEach(id => updateActionEl(id));
        setActiveTab('');
        input.focus();
    });
}

/* ──────────────────────────────────────────────────────────────
   SCROLL → HIGHLIGHT ACTIVE TAB
   ──────────────────────────────────────────────────────────── */
window.addEventListener('scroll', () => {
    const OFFSET = 64 + 56 + 52 + 32;
    const inDB = [...new Set(allItems.map(i => i.category))];
    const cats = CATEGORY_ORDER.filter(c => inDB.includes(c));

    let current = '';
    cats.forEach(cat => {
        const sectionId = `section-${cat.replace(/\s/g, '-').replace(/[&]/g, '')}`;
        const el = document.getElementById(sectionId);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top <= OFFSET + 20) current = cat;
    });

    if (current !== activeCat) {
        setActiveTab(current);
        /* Scroll active tab into view */
        const tabEl = document.getElementById(`tab-${current.replace(/\s/g, '-').replace(/[&]/g, '') || 'all'}`);
        tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}, { passive: true });

/* ──────────────────────────────────────────────────────────────
   CART DRAWER
   ──────────────────────────────────────────────────────────── */
function bindCartEvents() {
    document.getElementById('headerCartBtn')?.addEventListener('click', openCart);
    document.getElementById('floatCartBtn')?.addEventListener('click', openCart);
    document.getElementById('closeCart')?.addEventListener('click', closeCart);
}

function openCart() {
    renderCartDrawer();
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
    document.body.style.overflow = '';
}

function renderCartDrawer() {
    const bodyEl = document.getElementById('cartBody');
    const summaryEl = document.getElementById('cartSummary');
    const footerEl = document.getElementById('cartFooter');
    const items = Object.values(cart);

    if (!items.length) {
        bodyEl.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon" aria-hidden="true">🛒</div>
        <div class="cart-empty-title">Your cart is empty</div>
        <div class="cart-empty-sub">Browse the menu and add delicious items!</div>
      </div>`;
        summaryEl.style.display = 'none';
        footerEl.innerHTML = '';
        return;
    }

    /* Items */
    bodyEl.innerHTML = items.map(item => {
        const lineTotal = item.price * item.quantity;
        const imgHtml = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${esc(item.name)}" loading="lazy"/>`
            : `<span aria-hidden="true">${CATEGORY_EMOJI[item.category] || '🍽️'}</span>`;
        return `
      <div class="cart-item">
        <div class="cart-item-img">${imgHtml}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${esc(item.name)}</div>
          <div class="cart-item-price">${formatINR(item.price)} each</div>
        </div>
        <div class="cart-qty-controls" role="group" aria-label="Quantity for ${esc(item.name)}">
          <button class="cart-qty-btn" onclick="changeQty('${item.menuItemId}',-1)" aria-label="Remove one">−</button>
          <span class="cart-qty-num">${item.quantity}</span>
          <button class="cart-qty-btn" onclick="changeQty('${item.menuItemId}',1)" aria-label="Add one">+</button>
        </div>
        <div class="cart-item-total">${formatINR(lineTotal)}</div>
      </div>`;
    }).join('');

    /* Special instructions */
    const existingText = document.getElementById('specialInstructions')?.value || '';
    bodyEl.innerHTML += `
    <div class="instructions-wrap">
      <label class="instructions-label" for="specialInstructions">
        📝 Special Instructions (optional)
      </label>
      <textarea id="specialInstructions" maxlength="300"
        placeholder="e.g. No spice, extra chutney, jain food…">${existingText}</textarea>
    </div>`;

    /* Summary */
    const subtotal = cartSubtotal();
    const gst = Math.round(subtotal * GST_RATE * 100) / 100;
    const total = subtotal + gst;
    document.getElementById('summarySubtotal').textContent = formatINR(subtotal);
    document.getElementById('summaryGST').textContent = formatINR(gst);
    document.getElementById('summaryTotal').textContent = formatINR(total);
    summaryEl.style.display = 'block';

    /* Place order button */
    footerEl.innerHTML = `
    <button class="place-order-btn" id="placeOrderBtn" aria-label="Place order">
      <span class="btn-text">🍽️ Place Order · ${formatINR(total)}</span>
    </button>`;
    document.getElementById('placeOrderBtn')?.addEventListener('click', placeOrder);
}

/* ──────────────────────────────────────────────────────────────
   PLACE ORDER
   ──────────────────────────────────────────────────────────── */
async function placeOrder() {
    const items = Object.values(cart);
    if (!items.length) { showToast('Your cart is empty.', 'warning'); return; }

    const btn = document.getElementById('placeOrderBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-spinner"></span> Placing order…';
    }

    const specialInstructions = (document.getElementById('specialInstructions')?.value || '').trim();

    try {
        const subtotal = cartSubtotal();
        const total = subtotal + (subtotal * GST_RATE);

        const body = {
            sessionId,
            tableNumber: parseInt(tableNo, 10),
            restaurantSlug: slug,
            slug, // keep for safety
            specialInstructions,
            items: items.map(i => ({
                menuItemId: i.menuItemId,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                imageUrl: i.imageUrl,
            })),
            total
        };

        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const json = await res.json();

        if (res.ok && json.success) {
            /* Clear cart */
            cart = {};
            updateCartBadges();
            /* Update all item action buttons */
            allItems.forEach(item => updateActionEl(item._id));
            closeCart();
            showSuccessPopup();
        } else {
            showToast(json.message || 'Failed to place order. Please try again.', 'error');
            if (btn) {
                btn.disabled = false;
                const subtotal = cartSubtotal();
                const gst = Math.round(subtotal * GST_RATE * 100) / 100;
                btn.innerHTML = `<span class="btn-text">🍽️ Place Order · ${formatINR(subtotal + gst)}</span>`;
            }
        }
    } catch (err) {
        console.error('[placeOrder]', err);
        showToast('Could not connect to server. Please check your connection.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-text">🍽️ Try Again</span>';
        }
    }
}

/* ──────────────────────────────────────────────────────────────
   SUCCESS POPUP
   ──────────────────────────────────────────────────────────── */
function showSuccessPopup() {
    document.getElementById('successPopup').classList.add('show');
}

function hideSuccessPopup() {
    document.getElementById('successPopup').classList.remove('show');
}

document.getElementById('successCloseBtn')?.addEventListener('click', hideSuccessPopup);
document.getElementById('successPopup')?.addEventListener('click', function (e) {
    if (e.target === this) hideSuccessPopup();
});

/* ──────────────────────────────────────────────────────────────
   MY BILL MODAL
   ──────────────────────────────────────────────────────────── */
function bindBillEvents() {
    document.getElementById('myBillBtn')?.addEventListener('click', openBill);
    document.getElementById('closeBill')?.addEventListener('click', closeBill);
    document.getElementById('billModal')?.addEventListener('click', function (e) {
        if (e.target === this) closeBill();
    });
    document.getElementById('payBtn')?.addEventListener('click', () => {
        showToast('Please pay at the counter. Thank you! 🙏', 'info');
        closeBill();
    });
}

async function openBill() {
    const billBody = document.getElementById('billBody');
    document.getElementById('billModal').classList.add('show');
    document.body.style.overflow = 'hidden';

    billBody.innerHTML = `
    <div class="bill-empty">
      <div class="bill-empty-icon" aria-hidden="true">📋</div>
      Loading your orders…
    </div>`;

    try {
        const res = await fetch(`/api/orders/session/${encodeURIComponent(sessionId)}`);
        const json = await res.json();

        if (!json.success || !json.data.length) {
            billBody.innerHTML = `
        <div class="bill-empty">
          <div class="bill-empty-icon" aria-hidden="true">🛒</div>
          <div style="font-weight:700;color:var(--dark);margin-bottom:6px">No orders yet</div>
          <div>Add items to your cart and place an order.</div>
        </div>`;
            return;
        }

        renderBill(json.data);
    } catch (err) {
        console.error('[bill]', err);
        billBody.innerHTML = `
      <div class="bill-empty">
        <div class="bill-empty-icon" aria-hidden="true">⚠️</div>
        Could not load orders. Please try again.
      </div>`;
    }
}

function renderBill(orders) {
    const billBody = document.getElementById('billBody');
    let grandSubtotal = 0;

    const ordersHtml = orders.map((order, idx) => {
        grandSubtotal += order.subtotal || 0;
        const itemsHtml = order.items.map(i =>
            `<div class="bill-row">
        <span class="bill-row-name">🌿 ${esc(i.name)} ×${i.quantity}</span>
        <span class="bill-row-price">${formatINR(i.price * i.quantity)}</span>
      </div>`
        ).join('');

        return `
      <div class="bill-order-block">
        <div class="bill-block-title">Order #${idx + 1} — ${order.status}</div>
        ${itemsHtml}
        <div class="bill-row" style="margin-top:6px;font-weight:700;color:var(--dark)">
          <span>Order Total</span>
          <span>${formatINR(order.subtotal)}</span>
        </div>
      </div>`;
    }).join('');

    const gst = Math.round(grandSubtotal * GST_RATE * 100) / 100;
    const total = grandSubtotal + gst;

    billBody.innerHTML = `
    ${ordersHtml}
    <div class="bill-grand">
      <div class="bill-row"><span>Subtotal</span><span>${formatINR(grandSubtotal)}</span></div>
      <div class="bill-row"><span>GST (5%)</span><span>${formatINR(gst)}</span></div>
      <div class="bill-row" style="font-weight:800;font-size:1.1rem;color:var(--dark)">
        <span>Grand Total</span>
        <span style="color:var(--primary);font-family:'Playfair Display',serif">${formatINR(total)}</span>
      </div>
    </div>
    <div style="text-align:center;margin-top:14px;font-size:.72rem;color:var(--muted)">
      Table ${tableNo} · Session ID: ${sessionId.slice(-8)}
    </div>`;
}

function closeBill() {
    document.getElementById('billModal').classList.remove('show');
    document.body.style.overflow = '';
}

/* ──────────────────────────────────────────────────────────────
   BACKDROP / OVERLAY
   ──────────────────────────────────────────────────────────── */
function bindOverlay() {
    document.getElementById('overlay')?.addEventListener('click', closeCart);
}

/* ──────────────────────────────────────────────────────────────
   IMAGE ERROR HANDLER (UNIQUENESS & QUALITY)
   ──────────────────────────────────────────────────────────── */
window.handleFoodImgError = async function (img, category, name = '', id = '') {
    if (img.dataset.failed) return;

    // Track attempts
    let attempt = parseInt(img.dataset.attempt || '0', 10);
    img.dataset.attempt = ++attempt;

    // Try Backend Proxy with Item ID for true uniqueness
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

    // Final fallback: Hide broken tag and show themed placeholder
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
            <div style="font-size: 2.5rem">${CATEGORY_EMOJI[category] || '🍽️'}</div>
            <div class="food-img-fallback-text">${category || 'Food Item'}</div>
        `;
        parent.appendChild(fb);
    }
};
