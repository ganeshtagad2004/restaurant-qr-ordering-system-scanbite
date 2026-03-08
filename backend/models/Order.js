const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
    {
        menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },   // snapshot at time of order
        quantity: { type: Number, required: true, min: 1 },
        imageUrl: { type: String, default: '' },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
        tableNumber: { type: Number, required: true },
        sessionId: { type: String, required: true },
        items: { type: [orderItemSchema], required: true },
        subtotal: { type: Number, required: true },
        total: { type: Number }, // Added as per user example
        status: {
            type: String,
            enum: ['Pending', 'Preparing', 'Served', 'Paid', 'Cancelled'],
            default: 'Pending',
        },
        paymentStatus: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' },
        specialInstructions: { type: String, default: '' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
