const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get inventory status
router.get('/', async (req, res) => {
    try {
        const [inventory] = await db.promise().query(
            `SELECT i.*, p.name as product_name, p.category
             FROM inventory i
             JOIN products p ON i.product_id = p.id
             ORDER BY i.quantity ASC`
        );
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get low stock items (quantity less than threshold)
router.get('/low-stock', async (req, res) => {
    try {
        const threshold = req.query.threshold || 10;
        const [items] = await db.promise().query(
            `SELECT i.*, p.name as product_name, p.category
             FROM inventory i
             JOIN products p ON i.product_id = p.id
             WHERE i.quantity < ?
             ORDER BY i.quantity ASC`,
            [threshold]
        );
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update inventory quantity
router.patch('/:product_id', async (req, res) => {
    try {
        const { quantity } = req.body;
        await db.promise().query(
            'UPDATE inventory SET quantity = ? WHERE product_id = ?',
            [quantity, req.params.product_id]
        );
        res.json({ message: 'Inventory updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get inventory report
router.get('/report', async (req, res) => {
    try {
        const [report] = await db.promise().query(
            `SELECT 
                p.category,
                COUNT(*) as total_products,
                SUM(i.quantity) as total_quantity,
                AVG(i.quantity) as average_quantity
             FROM inventory i
             JOIN products p ON i.product_id = p.id
             GROUP BY p.category`
        );
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 