const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all customers
router.get('/', async (req, res) => {
    try {
        const [customers] = await db.promise().query('SELECT * FROM customers');
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
    try {
        const [customer] = await db.promise().query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (customer.length === 0) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new customer
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;
        const [result] = await db.promise().query(
            'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
            [name, email, phone, address]
        );
        res.status(201).json({ id: result.insertId, message: 'Customer created successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update customer
router.put('/:id', async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;
        await db.promise().query(
            'UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
            [name, email, phone, address, req.params.id]
        );
        res.json({ message: 'Customer updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete customer
router.delete('/:id', async (req, res) => {
    try {
        await db.promise().query('DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 