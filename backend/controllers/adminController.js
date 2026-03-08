const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Table = require('../models/Table');

/* ─── UPDATE PROFILE ──────────────────────────────── */
exports.updateProfile = async (req, res) => {
    try {
        const { restaurantName, adminName, phone, address, themeColor } = req.body;
        const admin = await Admin.findById(req.adminId);
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });

        if (restaurantName) admin.restaurantName = restaurantName.trim();
        if (adminName) admin.adminName = adminName.trim();
        if (phone) admin.phone = phone.trim();
        if (address) admin.address = address.trim();
        if (themeColor) admin.themeColor = themeColor;
        if (req.file) admin.logoUrl = `/uploads/${req.file.filename}`;

        await admin.save();
        const result = admin.toObject();
        delete result.password;
        return res.status(200).json({ success: true, data: result, message: 'Profile updated.' });
    } catch (err) {
        console.error('[updateProfile]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── CHANGE PASSWORD ─────────────────────────────── */
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required.' });

        const admin = await Admin.findById(req.adminId);
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });

        const match = await bcrypt.compare(currentPassword, admin.password);
        if (!match)
            return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

        if (newPassword.length < 8)
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

        admin.password = await bcrypt.hash(newPassword, 10);
        await admin.save();
        return res.status(200).json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error('[changePassword]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── DELETE ACCOUNT (DANGER) ─────────────────────── */
exports.deleteAccount = async (req, res) => {
    try {
        const adminId = req.adminId;
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }

        // 1. Delete all related data
        await MenuItem.deleteMany({ adminId });
        await Order.deleteMany({ adminId });
        await Table.deleteMany({ adminId });

        // 2. Delete admin account
        await Admin.findByIdAndDelete(adminId);

        // 3. Clear auth cookie
        res.clearCookie('token', { path: '/' });

        return res.status(200).json({
            success: true,
            message: 'Account and all related data deleted permanently.'
        });
    } catch (err) {
        console.error('[deleteAccount]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
