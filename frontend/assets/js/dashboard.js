'use strict';
/* ================================================================
   dashboard.js — ScanBite Admin Dashboard
   ================================================================ */

let barChartInstance = null;
let doughnutChartInstance = null;

/* ── Date subtitle ────────────────────────────────────────────── */
(function setDate() {
    const el = document.getElementById('dashDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-IN',
        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
})();

/* ── Main init ────────────────────────────────────────────────── */
async function init() {
    const admin = await requireAuth();
    if (!admin) return;
    startLiveClock();
    startTimeAgoRefresh();
    await loadDashboard();
}

function startTimeAgoRefresh() {
    // Refresh timeAgo strings every 30 seconds to keep them live
    setInterval(() => {
        document.querySelectorAll('.order-time-ago').forEach(el => {
            const iso = el.dataset.created;
            if (iso) el.textContent = timeAgo(iso);
        });
    }, 30000);
}

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
    setInterval(update, 1000);
}

/* ── Fetch & render ───────────────────────────────────────────── */
async function loadDashboard() {
    try {
        const res = await fetch('/api/dashboard', { credentials: 'include' });
        const json = await res.json();
        if (!json.success) { showToast(json.message || 'Failed to load dashboard.', 'error'); return; }
        const d = json.data;
        renderStats(d);
        renderBarChart(d.last7Days || []);
        renderDoughnut(d.topItems || []);
        await loadRecentOrders();
    } catch (err) {
        console.error('[dashboard]', err);
        showToast('Could not connect to server.', 'error');
    }
}

/* ── Stats ────────────────────────────────────────────────────── */
function renderStats(d) {
    const animate = (id, val, prefix = '', suffix = '') => {
        const el = document.getElementById(id);
        if (el) countUp(el, val, prefix, suffix);
    };
    animate('statTodayOrders', d.today?.count || 0);
    animate('statTodayRevenue', d.today?.revenue || 0, '₹');
    animate('statMonthlyOrders', d.monthly?.count || 0);
    animate('statMonthlyRevenue', d.monthly?.revenue || 0, '₹');
    animate('statPending', d.pendingOrders || 0);
    animate('statItems', d.totalItems || 0);
}

/* ── Bar Chart ────────────────────────────────────────────────── */
function renderBarChart(last7Days) {
    const canvas = document.getElementById('barChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (barChartInstance) barChartInstance.destroy();

    // Get colors from CSS variables
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ff6b35';
    const primaryDark = getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim() || '#e85d2e';

    const labels = last7Days.map(d => {
        const dt = new Date(d.date);
        return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    });
    const counts = last7Days.map(d => d.count);

    barChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Orders',
                data: counts,
                backgroundColor: primaryColor + 'D9', // ~85% opacity
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: primaryDark,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} order${ctx.parsed.y !== 1 ? 's' : ''}`,
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 } } },
                y: {
                    beginAtZero: true, grid: { color: '#eef0f4' },
                    ticks: { font: { family: 'Poppins', size: 11 }, stepSize: 1 },
                },
            },
        },
    });
}

/* ── Doughnut Chart ───────────────────────────────────────────── */
function renderDoughnut(topItems) {
    const canvas = document.getElementById('doughnutChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (doughnutChartInstance) doughnutChartInstance.destroy();

    if (!topItems.length) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Poppins';
        ctx.fillStyle = '#8892a4';
        ctx.textAlign = 'center';
        ctx.fillText('No orders yet', canvas.width / 2, canvas.height / 2);
        return;
    }

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ff6b35';
    const COLORS = [primaryColor, '#f39c12', '#27ae60', '#2980b9', '#8e44ad'];
    doughnutChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: topItems.map(i => i.name),
            datasets: [{
                data: topItems.map(i => i.orderCount),
                backgroundColor: COLORS,
                hoverOffset: 8,
                borderWidth: 2,
                borderColor: '#fff',
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Poppins', size: 11 }, padding: 14, usePointStyle: true },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} orders`,
                    },
                },
            },
        },
    });
}

/* ── Recent Orders Table ──────────────────────────────────────── */
async function loadRecentOrders() {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;
    try {
        const res = await fetch('/api/orders', { credentials: 'include' });
        const json = await res.json();
        if (!json.success) return;

        const orders = json.data.slice(0, 10);
        if (!orders.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">No orders yet</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>Table ${o.tableNumber}</strong></td>
        <td style="color:var(--muted);font-size:.82rem">${o.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}</td>
        <td style="font-weight:700;color:var(--primary)">${formatINR(o.subtotal)}</td>
        <td>${statusBadge(o.status)}</td>
        <td class="order-time-ago" data-created="${o.createdAt}" style="color:var(--muted);font-size:.8rem">${timeAgo(o.createdAt)}</td>
      </tr>`).join('');
    } catch (err) {
        console.error('[recentOrders]', err);
    }
}

/* ── Refresh button ───────────────────────────────────────────── */
document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true; btn.textContent = '⏳ Loading…';
    await loadDashboard();
    btn.disabled = false; btn.textContent = '🔄 Refresh';
    showToast('Dashboard refreshed.', 'success');
});

/* ── Boot ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
