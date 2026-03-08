const mongoose = require('mongoose');

const CATEGORIES = [
    'Starters',
    'Soups',
    'Main Course',
    'Breads',
    'Rice & Biryani',
    'South Indian',
    'Chaat',
    'Thali',
    'Desserts',
    'Beverages',
];

const menuItemSchema = new mongoose.Schema(
    {
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        price: { type: Number, required: true, min: 0 },
        category: { type: String, required: true, enum: CATEGORIES },
        imageUrl: { type: String, default: '' },
        isAvailable: { type: Boolean, default: true },
        isVeg: { type: Boolean, default: true },
        orderCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
