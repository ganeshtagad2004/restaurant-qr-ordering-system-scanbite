const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    placeOrder,
    getAllOrders,
    getSessionOrders,
    updateStatus,
    deleteOrder,
    deleteOrders,
} = require('../controllers/orderController');

// PUBLIC
router.post('/', placeOrder);
router.post('/place', placeOrder); // for backward compatibility or direct fetch
router.get('/session/:sessionId', getSessionOrders);

// AUTHENTICATED
router.get('/', protect, getAllOrders);
router.patch('/:id/status', protect, updateStatus);
router.delete('/bulk-delete', protect, deleteOrders);
router.delete('/:id', protect, deleteOrder);

module.exports = router;
