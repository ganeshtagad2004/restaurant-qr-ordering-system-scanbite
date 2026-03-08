const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { generateTables, getTables, deleteTable, deleteTables } = require('../controllers/tableController');

router.post('/', protect, generateTables);
router.get('/', protect, getTables);
router.delete('/', protect, deleteTables);
router.delete('/:id', protect, deleteTable);

module.exports = router;
