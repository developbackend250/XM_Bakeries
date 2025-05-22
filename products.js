const express = require('express');
const router = express.Router();
const db = require('../config/database');


// Add new product
router.post('/', async (req, res) => {
    try {
        const { name, description, price, category, quantity } = req.body;
        const query = 'INSERT INTO products (name, description, price, category, quantity) VALUES (?, ?, ?, ?, ?)';
        const [result] = await db.promise().query(query, [name, description, price, category, quantity]);
        
        // Update inventory
        await db.promise().query('INSERT INTO inventory (product_id, quantity) VALUES (?, ?)', 
            [result.insertId, quantity]);
        
        res.status(201).json({ id: result.insertId, message: 'Product added successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all products with filtering and sorting
router.get('/', async (req, res) => {
    try {
        const { category, minPrice, maxPrice, sortBy, sortOrder } = req.query;
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        if (minPrice) {
            query += ' AND price >= ?';
            params.push(minPrice);
        }

        if (maxPrice) {
            query += ' AND price <= ?';
            params.push(maxPrice);
        }

        if (sortBy) {
            query += ` ORDER BY ${sortBy} ${sortOrder || 'ASC'}`;
        }

        const [products] = await db.promise().query(query, params);
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Update product
router.put('/:id', async (req, res) => {
    try {
        const { name, description, price, category, quantity } = req.body;
        const query = 'UPDATE products SET name = ?, description = ?, price = ?, category = ?, quantity = ? WHERE id = ?';
        await db.promise().query(query, [name, description, price, category, quantity, req.params.id]);
        
        // Update inventory
        await db.promise().query('UPDATE inventory SET quantity = ? WHERE product_id = ?', 
            [quantity, req.params.id]);
        
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete product and its associated inventory records
router.delete('/:id', async (req, res) => {
    try {
        // Delete the inventory record(s) first
        await db.promise().query('DELETE FROM inventory WHERE product_id = ?', [req.params.id]);
        
        // Then delete the product
        await db.promise().query('DELETE FROM products WHERE id = ?', [req.params.id]);

        res.json({ message: 'Product and associated inventory deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router; 