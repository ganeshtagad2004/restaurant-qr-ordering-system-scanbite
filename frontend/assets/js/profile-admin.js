'use strict';
/* ================================================================
   profile-admin.js — ScanBite Profile & Settings
   ================================================================ */

let profileLogoFile = null;

/* ── Init ─────────────────────────────────────────────────────── */
async function init() {
    const admin = await requireAuth();
    if (!admin) return;
    populateProfile(admin);
    bindLogoUpload();
    bindColorPicker();
    bindProfileForm();
    bindPasswordForm();
    bindDeleteAccount();
    document.getElementById('logoutAllBtn')?.addEventListener('click', handleLogoutAll);
    bindPasswordToggles();
}

/* ── Populate profile form ────────────────────────────────────── */
function populateProfile(admin) {
    setVal('profRestaurantName', admin.restaurantName);
    setVal('profAdminName', admin.adminName);
    setVal('profPhone', admin.phone);
    setVal('profEmail', admin.email);
    setVal('profAddress', admin.address);

    document.getElementById('profileRestaurantName').textContent = admin.restaurantName;
    document.getElementById('profileSlug').textContent = `@${admin.slug}`;

    if (admin.themeColor) {
        const picker = document.getElementById('themeColorInput');
        const hexIns = document.getElementById('themeColorHex');
        if (picker) picker.value = admin.themeColor;
        if (hexIns) hexIns.value = admin.themeColor;

        const preview = document.getElementById('colorPreviewBox');
        if (preview) preview.style.backgroundColor = admin.themeColor;

        applyThemeColor(admin.themeColor);
    }

    if (admin.logoUrl) {
        const img = document.getElementById('logoPreviewImg');
        const ph = document.getElementById('logoPlaceholder');
        if (img && ph) {
            img.src = admin.logoUrl;
            img.style.display = 'block';
            ph.style.display = 'none';
        }
    }
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
}

/* ── Logo file upload ─────────────────────────────────────────── */
function bindLogoUpload() {
    const input = document.getElementById('logoInput');
    if (!input) return;
    input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        profileLogoFile = file;
        const reader = new FileReader();
        reader.onload = ev => {
            const img = document.getElementById('logoPreviewImg');
            const ph = document.getElementById('logoPlaceholder');
            if (img) { img.src = ev.target.result; img.style.display = 'block'; }
            if (ph) ph.style.display = 'none';
        };
        reader.readAsDataURL(file);
    });
}

/* ── Live theme color ─────────────────────────────────────────── */
function bindColorPicker() {
    const picker = document.getElementById('themeColorInput');
    const hexInput = document.getElementById('themeColorHex');
    const preview = document.getElementById('colorPreviewBox');

    if (!picker || !hexInput) return;

    // From Picker
    picker.oninput = e => {
        const val = e.target.value;
        updateThemeUI(val);
    };

    // From Hex Text
    hexInput.addEventListener('input', e => {
        let val = e.target.value;
        if (!val.startsWith('#')) val = '#' + val;
        // Basic hex validation
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            picker.value = val;
            updateThemeUI(val);
        }
    });

    function updateThemeUI(val) {
        hexInput.value = val;
        if (preview) {
            preview.style.backgroundColor = val;
            preview.style.boxShadow = `0 4px 12px ${adjustColor(val, -40)}88`;
        }
        applyThemeColor(val);
    }
}

/* ── Profile form submit ──────────────────────────────────────── */
function bindProfileForm() {
    const form = document.getElementById('profileForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('saveProfileBtn');
        setLoading(btn, true, '💾 Save Profile');

        const fd = new FormData();
        fd.append('restaurantName', document.getElementById('profRestaurantName').value.trim());
        fd.append('adminName', document.getElementById('profAdminName').value.trim());
        fd.append('phone', document.getElementById('profPhone').value.trim());
        fd.append('address', document.getElementById('profAddress').value.trim());
        fd.append('themeColor', document.getElementById('themeColorInput').value);
        if (profileLogoFile) fd.append('logo', profileLogoFile);

        try {
            const res = await fetch('/api/admin/profile', { method: 'PUT', credentials: 'include', body: fd });
            const json = await res.json();
            if (json.success) {
                showToast('Profile saved successfully!', 'success');
                localStorage.setItem('adminName', json.data.adminName);
                localStorage.setItem('restaurantName', json.data.restaurantName);
                document.getElementById('profileRestaurantName').textContent = json.data.restaurantName;
                profileLogoFile = null;
                // Refresh sidebar user name
                const sidebarNameEl = document.getElementById('sidebarName');
                const sidebarAvatarEl = document.getElementById('sidebarAvatar');
                if (sidebarNameEl) sidebarNameEl.textContent = json.data.adminName;
                if (sidebarAvatarEl) sidebarAvatarEl.textContent = json.data.adminName.charAt(0).toUpperCase();
            } else {
                showToast(json.message || 'Failed to save profile.', 'error');
            }
        } catch (err) {
            console.error('[saveProfile]', err);
            showToast('Server error.', 'error');
        } finally {
            setLoading(btn, false, '💾 Save Profile');
        }
    });
}

/* ── Password form submit ─────────────────────────────────────── */
function bindPasswordForm() {
    const form = document.getElementById('passwordForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!validatePassword()) return;

        const btn = document.getElementById('savePasswordBtn');
        setLoading(btn, true, '🔐 Change Password');

        try {
            const res = await fetch('/api/admin/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword: document.getElementById('currentPw').value,
                    newPassword: document.getElementById('newPw').value,
                }),
            });
            const json = await res.json();
            if (json.success) {
                showToast('Password changed successfully!', 'success');
                form.reset();
                clearPwErrors();
            } else {
                showToast(json.message || 'Failed to change password.', 'error');
                if (json.message?.toLowerCase().includes('current')) {
                    showFieldError('currentPwErr', json.message);
                }
            }
        } catch (err) {
            console.error('[changePassword]', err);
            showToast('Server error.', 'error');
        } finally {
            setLoading(btn, false, '🔐 Change Password');
        }
    });
}

function validatePassword() {
    clearPwErrors();
    let ok = true;

    const cur = document.getElementById('currentPw').value;
    const nw = document.getElementById('newPw').value;
    const conf = document.getElementById('confirmPw').value;

    if (!cur) { showFieldError('currentPwErr', 'Current password is required.'); ok = false; }
    if (!nw) { showFieldError('newPwErr', 'New password is required.'); ok = false; }
    else if (nw.length < 8) { showFieldError('newPwErr', 'Must be at least 8 characters.'); ok = false; }
    if (!conf) { showFieldError('confirmPwErr', 'Please confirm your new password.'); ok = false; }
    else if (nw && conf !== nw) { showFieldError('confirmPwErr', 'Passwords do not match.'); ok = false; }

    return ok;
}

function showFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'flex'; }
}
function clearPwErrors() {
    ['currentPwErr', 'newPwErr', 'confirmPwErr'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

/* ── Password toggles ─────────────────────────────────────────── */
function bindPasswordToggles() {
    const pairs = [
        ['toggleCurrentPw', 'currentPw'],
        ['toggleNewPw', 'newPw'],
        ['toggleConfirmPw', 'confirmPw'],
    ];
    pairs.forEach(([btnId, inputId]) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;
        btn.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.textContent = show ? '🙈' : '👁';
            input.focus();
        });
    });
}

/* ── Logout all ───────────────────────────────────────────────── */
async function handleLogoutAll() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) { }
    localStorage.clear();
    window.location.href = '/auth/login.html';
}

/* ── Delete Account ───────────────────────────────────────────── */
function bindDeleteAccount() {
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (!deleteBtn) return;

    const modal = document.getElementById('deleteAccountModal');
    const confirmBtn = document.getElementById('confirmDeleteAccountBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const closeBtn = document.getElementById('closeDeleteModal');

    deleteBtn.onclick = () => modal?.classList.remove('hidden');

    const closeModal = () => modal?.classList.add('hidden');
    [cancelBtn, closeBtn].forEach(el => el && el.addEventListener('click', closeModal));

    confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="btn-spinner"></span> Deleting…';

        try {
            const res = await fetch('/api/admin/profile', {
                method: 'DELETE',
                credentials: 'include'
            });
            const json = await res.json();
            if (json.success) {
                localStorage.clear();
                window.location.href = '/auth/register.html?status=deleted';
            } else {
                showToast(json.message || 'Error deleting account.', 'error');
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Delete Forever';
            }
        } catch (err) {
            console.error('[deleteAccount]', err);
            showToast('Server error.', 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Delete Forever';
        }
    };
}

/* ── Loading helper ───────────────────────────────────────────── */
function setLoading(btn, on, defaultText) {
    btn.disabled = on;
    const t = btn.querySelector('.btn-text');
    if (t) t.innerHTML = on ? '<span class="btn-spinner"></span> Saving…' : defaultText;
}

/* ── Boot ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
