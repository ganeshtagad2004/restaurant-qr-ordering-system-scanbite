const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const {
    getPublicMenuBySlug,
    getAllMenu,
    addItem,
    updateItem,
    deleteItem,
    toggleAvailable,
    getAutoImage,
} = require('../controllers/menuController');

// PUBLIC + ADMIN
router.get('/auto-image', getAutoImage);
router.get('/:slug', getPublicMenuBySlug);

// AUTHENTICATED
router.get('/', protect, getAllMenu);
router.post('/', protect, upload.single('image'), addItem);
router.put('/:id', protect, upload.single('image'), updateItem);
router.delete('/:id', protect, deleteItem);
router.patch('/:id/toggle', protect, toggleAvailable);

module.exports = router;
