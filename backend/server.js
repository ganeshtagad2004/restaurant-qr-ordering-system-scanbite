require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const tableRoutes = require('./routes/tableRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { cleanupOldOrders } = require('./controllers/orderController');

const app = express();

// ... existing code ...

// Auto-cleanup orders older than 24h (run every hour)
setInterval(cleanupOldOrders, 60 * 60 * 1000);
// Also run once on startup
cleanupOldOrders();

/* ─── Middleware ─────────────────────────────────────────── */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

/* ─── Admin Auth Guard (Server-side redirect) ────────────── */
app.use('/admin', (req, res, next) => {
    // Only intercept HTML requests or directory requests, not assets like .css/.js
    const isHtmlRequest = req.path.endsWith('.html') || !req.path.includes('.');
    if (isHtmlRequest && !req.cookies.token) {
        return res.redirect('/auth/login.html');
    }
    next();
});

/* ─── Static files (with extension support) ──────────────── */
app.use(express.static(path.join(__dirname, '../frontend'), { extensions: ['html'] }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ─── API Routes ─────────────────────────────────────────── */
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

/* ─── Health check ───────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'ScanBite API is running.', timestamp: new Date().toISOString() });
});

/* ─── Frontend fallback (no redirect loop) ───────────────── */
app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        const indexPath = path.join(__dirname, '../frontend/index.html');
        res.sendFile(indexPath, (err) => {
            if (err) {
                // frontend not built yet – just confirm API is alive
                res.status(200).json({ success: true, message: 'ScanBite backend running. Frontend not found.' });
            }
        });
    } else {
        next();
    }
});

/* ─── Global error handler ───────────────────────────────── */
app.use((err, _req, res, _next) => {
    console.error('[Global Error]', err.message);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

/* ─── DB + Server Startup ────────────────────────────────── */
const startServer = async (port) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const dbName = mongoose.connection.name;
        console.log(`✅ MongoDB connected: ${dbName}`);

        const server = app.listen(port, '0.0.0.0', () => {
            const os = require('os');
            const nets = os.networkInterfaces();
            let networkIp = 'localhost';
            const prioritizedNames = ['wi-fi', 'ethernet', 'en0', 'wlan0', 'eth0'];

            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        if (networkIp === 'localhost' || prioritizedNames.some(p => name.toLowerCase().includes(p))) {
                            networkIp = net.address;
                        }
                    }
                }
            }

            console.log(`\n🚀 ScanBite server running:`);
            console.log(`   - Local:    http://localhost:${port}`);
            console.log(`   - Network:  http://${networkIp}:${port}\n`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${port} is already in use. Please free the port and restart.`);
                process.exit(1);
            } else {
                console.error('❌ Server error:', err.message);
                process.exit(1);
            }
        });
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    }
};

const initialPort = parseInt(process.env.PORT) || 5000;
startServer(initialPort);
