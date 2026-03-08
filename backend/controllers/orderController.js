const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Admin = require('../models/Admin');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');

/* ─── PUBLIC: place order (write-once) ───────────────────── */
exports.placeOrder = async (req, res) => {
    try {
        const { restaurantSlug, slug, tableNumber, sessionId, items, specialInstructions, total } = req.body;
        const finalSlug = restaurantSlug || slug;

        if (!finalSlug || !tableNumber || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'restaurantSlug (or slug), tableNumber and items are required.' });
        }

        // Resolve admin STRICTLY by slug for isolation
        const admin = await Admin.findOne({ slug: finalSlug.toLowerCase() });

        if (!admin) {
            return res.status(404).json({ success: false, message: `Restaurant "${finalSlug}" not found.` });
        }

        // Build order items with snapshots
        const orderItems = [];
        for (const entry of items) {
            const { menuItemId, quantity, name, price } = entry;

            // If menuItemId is provided, validate with DB
            if (menuItemId) {
                const dbItem = await MenuItem.findOne({ _id: menuItemId, adminId: admin._id, isAvailable: true });
                if (!dbItem) {
                    return res.status(404).json({ success: false, message: `Menu item ${menuItemId} not found or unavailable.` });
                }
                orderItems.push({
                    menuItemId: dbItem._id,
                    name: dbItem.name,
                    price: dbItem.price,
                    quantity: parseInt(quantity, 10),
                    imageUrl: dbItem.imageUrl,
                });
            } else if (name && price) {
                // If it's a simple items list as user requested, use it directly (less secure but flexible)
                // For now, let's stick to using existing items if possible or just create dummy ones
                // To support the user's direct POST format, we'll try to find items by name
                const dbItem = await MenuItem.findOne({ name, adminId: admin._id });
                orderItems.push({
                    menuItemId: dbItem ? dbItem._id : new mongoose.Types.ObjectId(), // fallback to dummy ID if not found
                    name,
                    price: parseFloat(price),
                    quantity: parseInt(quantity || 1, 10),
                    imageUrl: dbItem ? dbItem.imageUrl : '',
                });
            }
        }

        // Subtotal calculation
        const subtotal = total || orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

        // Generate a sessionId if none provided
        const resolvedSessionId = sessionId || `anon_${Date.now()}`;

        const order = await Order.create({
            adminId: admin._id,
            tableNumber: parseInt(tableNumber, 10),
            sessionId: resolvedSessionId,
            items: orderItems,
            subtotal,
            total, // Save the total as requested
            specialInstructions: specialInstructions || '',
        });

        // Increment counts if items have valid IDs
        for (const entry of orderItems) {
            if (entry.menuItemId && mongoose.Types.ObjectId.isValid(entry.menuItemId)) {
                await MenuItem.findByIdAndUpdate(entry.menuItemId, { $inc: { orderCount: entry.quantity } }).catch(() => { });
            }
        }

        return res.status(201).json({
            success: true,
            orderId: order._id,
            data: order,
            message: 'Order placed successfully.'
        });
    } catch (err) {
        console.error('[placeOrder]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: get all orders ───────────────────────────────── */
exports.getAllOrders = async (req, res) => {
    try {
        const filter = { adminId: req.adminId };

        // Optional query filters
        if (req.query.status) filter.status = req.query.status;
        if (req.query.tableNumber) filter.tableNumber = parseInt(req.query.tableNumber, 10);
        if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

        const orders = await Order.find(filter).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: orders });
    } catch (err) {
        console.error('[getAllOrders]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── PUBLIC: get orders by sessionId ───────────────────── */
exports.getSessionOrders = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const orders = await Order.find({ sessionId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: orders });
    } catch (err) {
        console.error('[getSessionOrders]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: update order status ──────────────────────────── */
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, paymentStatus } = req.body;

        const allowedStatuses = ['Pending', 'Preparing', 'Served', 'Paid', 'Cancelled'];
        const allowedPayment = ['Unpaid', 'Paid'];

        const order = await Order.findOne({ _id: id, adminId: req.adminId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        if (status) {
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
            }
            order.status = status;
        }

        if (paymentStatus) {
            if (!allowedPayment.includes(paymentStatus)) {
                return res.status(400).json({ success: false, message: `Invalid paymentStatus. Allowed: ${allowedPayment.join(', ')}` });
            }
            order.paymentStatus = paymentStatus;
        }

        await order.save();
        return res.status(200).json({ success: true, data: order, message: 'Order updated.' });
    } catch (err) {
        console.error('[updateStatus]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: delete specific order ───────────────────────── */
exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findOneAndDelete({ _id: id, adminId: req.adminId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        return res.status(200).json({ success: true, message: 'Order deleted successfully.' });
    } catch (err) {
        console.error('[deleteOrder]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: delete multiple orders ──────────────────────── */
exports.deleteOrders = async (req, res) => {
    try {
        const { orderIds } = req.body;
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No order IDs provided.' });
        }

        const result = await Order.deleteMany({
            _id: { $in: orderIds },
            adminId: req.adminId
        });

        return res.status(200).json({
            success: true,
            message: `${result.deletedCount} order(s) deleted successfully.`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error('[deleteOrders]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── SYSTEM: Cleanup old orders (> 24h) ────────────────── */
exports.cleanupOldOrders = async () => {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await Order.deleteMany({ createdAt: { $lt: oneDayAgo } });
        if (result.deletedCount > 0) {
            console.log(`[Cleanup] Deleted ${result.deletedCount} orders older than 24 hours.`);
        }
    } catch (err) {
        console.error('[Cleanup Error]', err.message);
    }
};
