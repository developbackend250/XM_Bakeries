const express = require('express');
const router = express.Router();
const db = require('../config/database');

const app= express();

app.use(express.json());


// Error collection and validation function
const validateOrderInput = (data) => {
    const errors = [];  
    
    if (!data.customer_id) {
        errors.push('Customer ID is required'); 
    }
    
    if (!data.shipping_address) {
        errors.push('Shipping address is required');
    }
    
    if (!data.items) {
        errors.push('Order items are required');
    } else if (!Array.isArray(data.items)) {
        errors.push('Items must be an array');
    } else if (data.items.length === 0) {
        errors.push('Order must contain at least one item');
    } else {
        data.items.forEach((item, index) => {
            if (!item.product_id) {
                errors.push(`Product ID is required for item at index ${index}`);
            }
            if (!item.quantity || item.quantity <= 0) {
                errors.push(`Valid quantity is required for item at index ${index}`);
            }
        });
    }
    
    return errors;
};

// Create new order
router.post('/', async (req, res) => {
    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        const orderData = req.body;
        
        // Validate input and collect errors
        const validationErrors = validateOrderInput(orderData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        const { customer_id, items, shipping_address } = orderData;

        // Check if customer exists
        const [customer] = await connection.query('SELECT id FROM customers WHERE id = ?', [customer_id]);
        if (customer.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Customer not found',
                customer_id: customer_id
            });
        }

        // Calculate total amount and validate products
        let total_amount = 0;
        const productErrors = [];
        
        for (const item of items) {
            try {
                // Check if product exists
                const [product] = await connection.query(
                    'SELECT price, quantity, name FROM products WHERE id = ?', 
                    [item.product_id]
                );
                
                if (product.length === 0) {
                    productErrors.push(`Product with ID ${item.product_id} not found`);
                    continue;
                }

                // Check if enough inventory
                if (product[0].quantity < item.quantity) {
                    productErrors.push(
                        `Insufficient inventory for ${product[0].name}. Available: ${product[0].quantity}, Requested: ${item.quantity}`
                    );
                    continue;
                }

                total_amount += product[0].price * item.quantity;
            } catch (error) {
                productErrors.push(`Error processing product ${item.product_id}: ${error.message}`);
            }
        }

        if (productErrors.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Product validation failed',
                errors: productErrors
            });
        }

        // Create order
        const [order] = await connection.query(
            'INSERT INTO orders (customer_id, total_amount, shipping_address) VALUES (?, ?, ?)',
            [customer_id, total_amount, shipping_address]
        );

        // Add order items and update inventory
        const orderItemErrors = [];
        for (const item of items) {
            try {
                await connection.query(
                    'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                    [order.insertId, item.product_id, item.quantity, item.price]
                );

                // Update inventory
                await connection.query(
                    'UPDATE inventory SET quantity = quantity - ? WHERE product_id = ?',
                    [item.quantity, item.product_id]
                );
            } catch (error) {
                orderItemErrors.push(`Error processing order item for product ${item.product_id}: ${error.message}`);
            }
        }

        if (orderItemErrors.length > 0) {
            throw new Error(`Errors occurred while processing order items: ${orderItemErrors.join(', ')}`);
        }

        await connection.commit();
        res.status(201).json({
            status: 'success',
            message: 'Order created successfully',
            order_id: order.insertId,
            total_amount: total_amount
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({
            status: 'error',
            message: 'Failed to create order',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// Get order details
router.get('/:id', async (req, res) => {
    try {
        // Validate order ID
        if (!req.params.id || isNaN(req.params.id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid order ID',
                details: 'Order ID must be a valid number'
            });
        }

        const [order] = await db.promise().query(
            `SELECT o.*, c.name as customer_name, c.email as customer_email
             FROM orders o
             JOIN customers c ON o.customer_id = c.id
             WHERE o.id = ?`,
            [req.params.id]
        );

        if (order.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found',
                order_id: req.params.id
            });
        }

        const [items] = await db.promise().query(
            `SELECT oi.*, p.name as product_name
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [req.params.id]
        );

        res.json({
            status: 'success',
            data: { ...order[0], items }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch order details',
            error: error.message
        });
    }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, tracking_number } = req.body;

        // Validate status
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        // Check if order exists
        const [order] = await db.promise().query('SELECT id FROM orders WHERE id = ?', [req.params.id]);
        if (order.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found',
                order_id: req.params.id
            });
        }

        await db.promise().query(
            'UPDATE orders SET status = ?, tracking_number = ? WHERE id = ?',
            [status, tracking_number, req.params.id]
        );
        
        res.json({
            status: 'success',
            message: 'Order status updated successfully',
            order_id: req.params.id,
            new_status: status
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to update order status',
            error: error.message
        });
    }
});

// Get customer's orders
router.get('/customer/:customer_id', async (req, res) => {
    try {
        // Validate customer ID
        if (!req.params.customer_id || isNaN(req.params.customer_id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid customer ID',
                details: 'Customer ID must be a valid number'
            });
        }

        // Check if customer exists
        const [customer] = await db.promise().query('SELECT id FROM customers WHERE id = ?', [req.params.customer_id]);
        if (customer.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Customer not found',
                customer_id: req.params.customer_id
            });
        }

        const [orders] = await db.promise().query(
            'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC',
            [req.params.customer_id]
        );
        
        res.json({
            status: 'success',
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch customer orders',
            error: error.message
        });
    }
});

module.exports = router; 