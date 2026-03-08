const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/* ─── helper ─────────────────────────────────────────────── */
const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '24h' });

const cookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 h in ms
};

const generateUniqueSlug = async (restaurantName) => {
    let base = restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-');
    let slug = base;
    let c = 1;
    while (await Admin.findOne({ slug })) {
        slug = base + '-' + c++;
    }
    return slug;
};

/* ─── REGISTER ───────────────────────────────────────────── */
exports.register = async (req, res) => {
    try {
        const { restaurantName, adminName, email, password, phone, address, themeColor } = req.body;

        if (!restaurantName || !adminName || !email || !password || !phone || !address) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Email already registered.' });
        }

        const slug = await generateUniqueSlug(restaurantName);
        const hashed = await bcrypt.hash(password, 10);
        const logoUrl = req.file ? `/uploads/${req.file.filename}` : '';

        const admin = await Admin.create({
            restaurantName,
            adminName,
            email: email.toLowerCase().trim(),
            password: hashed,
            phone,
            address,
            slug,
            logoUrl,
            themeColor: themeColor || '#ff6b35',
        });


        const token = signToken(admin._id);
        res.cookie('token', token, cookieOptions);

        return res.status(201).json({
            success: true,
            data: {
                adminName: admin.adminName,
                slug: admin.slug,
                restaurantName: admin.restaurantName,
                email: admin.email,
                themeColor: admin.themeColor,
                logoUrl: admin.logoUrl,
            },
            message: 'Registered successfully.',
        });
    } catch (err) {
        console.error('[register]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── LOGIN ──────────────────────────────────────────────── */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        console.log(`[DEBUG] Attempting login for email: ${email}`);
        const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
        if (!admin) {
            console.log(`[DEBUG] Admin user not found for email: ${email}`);
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        console.log(`[DEBUG] Admin user found: ${admin.adminName} (${admin.email})`);

        let match = false;
        if (admin.password && admin.password.startsWith('$2')) {
            // It's a bcrypt hash
            match = await bcrypt.compare(password, admin.password);
            console.log(`[DEBUG] Password check (bcrypt): ${match ? 'MATCH' : 'MISMATCH'}`);
        } else {
            // Fallback for plain text password
            match = (password === admin.password);
            console.log(`[DEBUG] Password check (plain text): ${match ? 'MATCH' : 'MISMATCH'}`);
            if (match) {
                // Auto-upgrade to bcrypt hash if plain text matches
                console.log(`[DEBUG] Upgrading plain text password to bcrypt hash for ${admin.email}`);
                admin.password = await bcrypt.hash(password, 10);
                await admin.save();
            }
        }

        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const token = signToken(admin._id);
        res.cookie('token', token, cookieOptions);

        return res.status(200).json({
            success: true,
            data: {
                adminName: admin.adminName,
                slug: admin.slug,
                restaurantName: admin.restaurantName,
                email: admin.email,
                themeColor: admin.themeColor,
                logoUrl: admin.logoUrl,
            },
            message: 'Logged in successfully.',
        });
    } catch (err) {
        console.error('[login]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── LOGOUT ─────────────────────────────────────────────── */
exports.logout = (_req, res) => {
    res.clearCookie('token', { path: '/' });
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

/* ─── ME ─────────────────────────────────────────────────── */
exports.me = async (req, res) => {
    try {
        const admin = await Admin.findById(req.adminId).select('-password');
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }
        return res.status(200).json({ success: true, data: admin });
    } catch (err) {
        console.error('[me]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
