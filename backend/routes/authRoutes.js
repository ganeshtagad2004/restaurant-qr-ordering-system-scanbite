const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const { register, login, logout, me } = require('../controllers/authController');

router.post('/register', upload.single('logo'), register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, me);

module.exports = router;
