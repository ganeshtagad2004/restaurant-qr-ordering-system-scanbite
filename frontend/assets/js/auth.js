/* ================================================================
   SCANBITE — Auth Logic
   auth.js
   Handles: validation, register, login, redirect
   ================================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   TOAST SYSTEM
   ──────────────────────────────────────────────────────────── */
function showToast(type, title, msg = '') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', 'alert');
    t.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${escHtml(title)}</div>
      ${msg ? `<div class="toast-msg">${escHtml(msg)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Close notification">✕</button>`;
    tc.appendChild(t);

    const remove = () => {
        t.classList.add('removing');
        setTimeout(() => t.remove(), 250);
    };
    t.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, 4500);
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ──────────────────────────────────────────────────────────────
    CLEAR AUTOFILL & CACHE (Ensure empty form on load)
    ──────────────────────────────────────────────────────────── */
window.addEventListener('load', () => {
    // Basic cleanup of sensitive status if needed, but DO NOT clear inputs
    // so browser autofill can work.
    sessionStorage.removeItem('lastError');
});

/* ──────────────────────────────────────────────────────────────
   VALIDATION REGEXES & HELPERS
   ──────────────────────────────────────────────────────────── */
const REGEX = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[6-9][0-9]{9}$/,
    capital: /[A-Z]/,
    number: /[0-9]/,
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/,
};

function setFieldState(inputEl, errEl, isError, message = '') {
    if (!inputEl || !errEl) return;
    inputEl.classList.remove('error', 'success');
    if (message && isError) {
        inputEl.classList.add('error');
        errEl.textContent = message;
        errEl.classList.add('show');
    } else if (!isError && inputEl && inputEl.value && inputEl.value.trim()) {
        inputEl.classList.add('success');
        errEl.classList.remove('show');
    } else {
        errEl.classList.remove('show');
    }
}

function clearField(inputEl, errEl) {
    if (!inputEl || !errEl) return;
    inputEl.classList.remove('error', 'success');
    errEl.classList.remove('show');
}

/* ──────────────────────────────────────────────────────────────
   SLUG PREVIEW GENERATOR
   ──────────────────────────────────────────────────────────── */
function generateSlugPreview(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/* ──────────────────────────────────────────────────────────────
   LIVE SLUG PREVIEW
   ─────────────────────────────────────────────────────────── */
const regRestaurant = document.getElementById('gx_reg_shop');
const slugPreview = document.getElementById('slugPreview');

if (regRestaurant && slugPreview) {
    regRestaurant.addEventListener('input', () => {
        const slug = generateSlugPreview(regRestaurant.value);
        if (slug) {
            slugPreview.innerHTML =
                `🔗 Your menu link: <strong>localhost:5000/user/menu.html?r=${escHtml(slug)}&t=1</strong>`;
            slugPreview.classList.add('show');
        } else {
            slugPreview.classList.remove('show');
        }
    });
}

/* ──────────────────────────────────────────────────────────────
   LIVE PASSWORD RULES
   ──────────────────────────────────────────────────────────── */
const regPassword = document.getElementById('gx_reg_pass');
const pwRulesBox = document.getElementById('pwRulesBox');

if (regPassword && pwRulesBox) {
    const RULES = [
        { id: 'rule-length', test: v => v.length >= 8 },
        { id: 'rule-capital', test: v => REGEX.capital.test(v) },
        { id: 'rule-number', test: v => REGEX.number.test(v) },
        { id: 'rule-symbol', test: v => REGEX.symbol.test(v) },
    ];

    regPassword.addEventListener('focus', () => pwRulesBox.classList.add('show'));
    regPassword.addEventListener('blur', () => {
        const allValid = RULES.every(r => r.test(regPassword.value));
        if (allValid) pwRulesBox.classList.remove('show');
    });

    regPassword.addEventListener('input', () => {
        const val = regPassword.value;
        pwRulesBox.classList.add('show');
        RULES.forEach(rule => {
            const el = document.getElementById(rule.id);
            if (!el) return;
            el.classList.toggle('valid', rule.test(val));
        });
    });
}

/* ──────────────────────────────────────────────────────────────
   BUTTON LOADING HELPERS
   ──────────────────────────────────────────────────────────── */
function setButtonLoading(btn, loading) {
    const textEl = btn.querySelector('.btn-text');
    btn.disabled = loading;
    if (loading) {
        btn.dataset.originalText = textEl ? textEl.innerHTML : btn.innerHTML;
        const spinner = '<span class="btn-spinner"></span> Processing…';
        if (textEl) textEl.innerHTML = spinner;
        else btn.innerHTML = spinner;
    } else {
        const original = btn.dataset.originalText;
        if (textEl) textEl.innerHTML = original;
        else btn.innerHTML = original;
    }
}

/* ──────────────────────────────────────────────────────────────
   REGISTER SUBMIT
   ──────────────────────────────────────────────────────────── */
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Inline Validation
        let valid = true;
        const rName = regRestaurant.value.trim();
        const rErr = document.getElementById('restaurantError');
        if (!rName || rName.length < 3) {
            setFieldState(regRestaurant, rErr, true, 'Name must be at least 3 characters.');
            valid = false;
        }

        const nameEl = document.getElementById('gx_reg_owner');
        const nameErr = document.getElementById('nameError');
        if (!nameEl.value.trim().includes(' ')) {
            setFieldState(nameEl, nameErr, true, 'Please enter your full name (First Last).');
            valid = false;
        }

        const emailEl = document.getElementById('gx_reg_mail');
        const emailErr = document.getElementById('emailError');
        if (!REGEX.email.test(emailEl.value.trim())) {
            setFieldState(emailEl, emailErr, true, 'Valid email required.');
            valid = false;
        }

        const phoneEl = document.getElementById('gx_reg_cell');
        const phoneErr = document.getElementById('phoneError');
        if (!REGEX.phone.test(phoneEl.value.trim())) {
            setFieldState(phoneEl, phoneErr, true, '10-digit phone required.');
            valid = false;
        }

        const pwVal = regPassword.value;
        const pwErr = document.getElementById('passwordError');
        if (pwVal.length < 8 || !REGEX.capital.test(pwVal) || !REGEX.number.test(pwVal) || !REGEX.symbol.test(pwVal)) {
            setFieldState(regPassword, pwErr, true, 'Password does not meet requirements.');
            valid = false;
        }

        const confirmEl = document.getElementById('gx_reg_confirm');
        const confirmErr = document.getElementById('confirmError');
        if (confirmEl.value !== pwVal) {
            setFieldState(confirmEl, confirmErr, true, 'Passwords do not match.');
            valid = false;
        }

        if (!valid) return;

        const btn = document.getElementById('registerBtn');
        setButtonLoading(btn, true);

        try {
            const body = {
                restaurantName: rName,
                adminName: nameEl.value.trim(),
                email: emailEl.value.trim().toLowerCase(),
                phone: phoneEl.value.trim(),
                address: document.getElementById('gx_reg_loc').value.trim(),
                password: pwVal,
            };

            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                localStorage.setItem('adminName', data.data.adminName);
                localStorage.setItem('slug', data.data.slug);
                showToast('success', 'Welcome!', 'Account created. Redirecting…');
                setTimeout(() => window.location.href = '/admin/dashboard.html', 900);
            } else {
                showToast('error', 'Failed', data.message || 'Registration failed.');
                setButtonLoading(btn, false);
            }
        } catch (err) {
            showToast('error', 'Error', 'Server unreachable.');
            setButtonLoading(btn, false);
        }
    });

    // Real-time digit restriction
    const phoneInput = document.getElementById('gx_reg_cell');
    if (phoneInput) {
        phoneInput.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });
    }
}

/* ──────────────────────────────────────────────────────────────
   LOGIN SUBMIT
   ──────────────────────────────────────────────────────────── */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailEl = document.getElementById('gx_auth_ident');
        const emailErr = document.getElementById('loginEmailError');
        const pwEl = document.getElementById('gx_auth_security');
        const pwErr = document.getElementById('loginPasswordError');

        let valid = true;
        if (!REGEX.email.test(emailEl.value.trim())) {
            setFieldState(emailEl, emailErr, true, 'Enter a valid email.');
            valid = false;
        }
        if (!pwEl.value) {
            setFieldState(pwEl, pwErr, true, 'Password is required.');
            valid = false;
        }

        if (!valid) return;

        const btn = document.getElementById('loginBtn');
        setButtonLoading(btn, true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: emailEl.value.trim().toLowerCase(),
                    password: pwEl.value
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                localStorage.setItem('adminName', data.data.adminName);
                localStorage.setItem('slug', data.data.slug);
                showToast('success', 'Logged in', 'Redirecting…');
                setTimeout(() => window.location.href = '/admin/dashboard.html', 900);
            } else {
                showToast('error', 'Login Failed', data.message);
                setButtonLoading(btn, false);
            }
        } catch (err) {
            showToast('error', 'Error', 'Server unreachable.');
            setButtonLoading(btn, false);
        }
    });
}

/* ──────────────────────────────────────────────────────────────
   CHECK IF ALREADY LOGGED IN
   ──────────────────────────────────────────────────────────── */
(async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                window.location.replace('/admin/dashboard.html');
            }
        }
    } catch (_) { }
})();
