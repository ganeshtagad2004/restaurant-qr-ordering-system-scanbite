const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const { updateProfile, changePassword, deleteAccount } = require('../controllers/adminController');

router.put('/profile', protect, upload.single('logo'), updateProfile);
router.put('/password', protect, changePassword);
router.delete('/profile', protect, deleteAccount);

module.exports = router;
