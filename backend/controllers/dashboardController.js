const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');

/* ─── AUTH: dashboard stats ──────────────────────────────── */
exports.getDashboard = async (req, res) => {
    try {
        const adminId = req.adminId;

        // ── Date helpers ──────────────────────────────────────────
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // ── Today ─────────────────────────────────────────────────
        const todayOrders = await Order.find({
            adminId,
            createdAt: { $gte: todayStart, $lt: todayEnd },
        });
        const todayCount = todayOrders.length;
        const todayRevenue = todayOrders.reduce((s, o) => s + o.subtotal, 0);

        // ── This month ────────────────────────────────────────────
        const monthOrders = await Order.find({
            adminId,
            createdAt: { $gte: monthStart },
        });
        const monthCount = monthOrders.length;
        const monthRevenue = monthOrders.reduce((s, o) => s + o.subtotal, 0);

        // ── Pending orders ────────────────────────────────────────
        const pendingOrders = await Order.countDocuments({ adminId, status: 'Pending' });

        // ── Total menu items ──────────────────────────────────────
        const totalItems = await MenuItem.countDocuments({ adminId });

        // ── Last 7 days [{date, count}] ───────────────────────────
        const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
        const last7Raw = await Order.aggregate([
            {
                $match: {
                    adminId: require('mongoose').Types.ObjectId.createFromHexString
                        ? require('mongoose').Types.ObjectId.createFromHexString(adminId.toString())
                        : require('mongoose').Types.ObjectId(adminId.toString()),
                    createdAt: { $gte: sevenDaysAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } },
                    count: { $sum: 1 },
                    revenue: { $sum: '$subtotal' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Fill in any missing days with count 0
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().slice(0, 10);
            const found = last7Raw.find((r) => r._id === key);
            last7Days.push({ date: key, count: found ? found.count : 0, revenue: found ? found.revenue : 0 });
        }

        // ── Top 5 items by orderCount ─────────────────────────────
        const topItems = await MenuItem.find({ adminId })
            .sort({ orderCount: -1 })
            .limit(5)
            .select('name category orderCount price imageUrl');

        return res.status(200).json({
            success: true,
            data: {
                today: { count: todayCount, revenue: todayRevenue },
                monthly: { count: monthCount, revenue: monthRevenue },
                pendingOrders,
                totalItems,
                last7Days,
                topItems,
            },
        });
    } catch (err) {
        console.error('[getDashboard]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
