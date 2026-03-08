const QRCode = require('qrcode');
const os = require('os');
const Admin = require('../models/Admin');
const Table = require('../models/Table');

const getLocalIp = () => {
    const nets = os.networkInterfaces();
    let bestIp = 'localhost';

    // We prioritize Wi-Fi or Ethernet interfaces which usually are the primary local ones
    const prioritizedNames = ['wi-fi', 'ethernet', 'en0', 'wlan0', 'eth0'];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                if (bestIp === 'localhost' || prioritizedNames.some(p => name.toLowerCase().includes(p))) {
                    bestIp = net.address;
                    // If it matches a priority name, we keep it but keep looking for an even better match
                    // but if it's Wi-Fi or Ethernet we are likely good.
                }
            }
        }
    }
    return bestIp;
};

/* ─── AUTH: generate tables ──────────────────────────────── */
exports.generateTables = async (req, res) => {
    try {
        const { count } = req.body;
        if (!count || parseInt(count, 10) < 1) {
            return res.status(400).json({ success: false, message: 'count must be a positive integer.' });
        }

        const admin = await Admin.findById(req.adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }

        const total = parseInt(count, 10);
        const created = [];
        const skipped = [];
        const localIp = getLocalIp();
        const port = process.env.PORT || 5000;

        for (let n = 1; n <= total; n++) {
            const qrLink = `http://${localIp}:${port}/user/menu.html?r=${admin.slug}&t=${n}`;
            const qrCodeDataUrl = await QRCode.toDataURL(qrLink);

            let table = await Table.findOne({ adminId: req.adminId, tableNumber: n });

            if (table) {
                // Update existing
                table.qrLink = qrLink;
                table.qrCodeDataUrl = qrCodeDataUrl;
                await table.save();
                skipped.push(n); // Track as updated/exists
            } else {
                // Create new
                table = await Table.create({
                    adminId: req.adminId,
                    tableNumber: n,
                    qrCodeDataUrl,
                    qrLink,
                });
                created.push(table);
            }
        }

        return res.status(201).json({
            success: true,
            data: created,
            message: `${created.length} table(s) created. ${skipped.length} already existed (skipped: ${skipped.join(', ') || 'none'}).`,
        });
    } catch (err) {
        console.error('[generateTables]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: get tables ───────────────────────────────────── */
exports.getTables = async (req, res) => {
    try {
        const tables = await Table.find({ adminId: req.adminId }).sort({ tableNumber: 1 });
        return res.status(200).json({ success: true, data: tables });
    } catch (err) {
        console.error('[getTables]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: delete table ─────────────────────────────────── */
exports.deleteTable = async (req, res) => {
    try {
        const { id } = req.params;
        const table = await Table.findOneAndDelete({ _id: id, adminId: req.adminId });
        if (!table) {
            return res.status(404).json({ success: false, message: 'Table not found.' });
        }
        return res.status(200).json({ success: true, message: `Table ${table.tableNumber} deleted.` });
    } catch (err) {
        console.error('[deleteTable]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
/* ─── AUTH: delete multiple tables ────────────────────────── */
exports.deleteTables = async (req, res) => {
    try {
        const { tableIds } = req.body; // Expecting { tableIds: [...] }
        if (!tableIds || !Array.isArray(tableIds) || tableIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No table IDs provided.' });
        }

        const result = await Table.deleteMany({
            _id: { $in: tableIds },
            adminId: req.adminId
        });

        return res.status(200).json({
            success: true,
            message: 'Tables deleted successfully'
        });
    } catch (err) {
        console.error('[deleteTables]', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
