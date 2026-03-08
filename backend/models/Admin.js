const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
    {
        restaurantName: { type: String, required: true, trim: true },
        adminName: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        phone: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true },
        logoUrl: { type: String, default: '' },
        themeColor: { type: String, default: '#ff6b35' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
