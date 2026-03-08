const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
    {
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
        tableNumber: { type: Number, required: true },
        qrCodeDataUrl: { type: String, default: '' },  // base64 PNG data URL
        qrLink: { type: String, default: '' },
        isOccupied: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// compound unique: one table number per restaurant admin
tableSchema.index({ adminId: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model('Table', tableSchema);
