const express = require('express');
const db = require('../config/db');
const axios = require('axios');
const { authenticateWebhook } = require('../middleware/authMiddleware');
const router = express.Router();

// Create a new test
router.post('/', async (req, res) => {
    const { name, project_id, webhook_url, scheduled } = req.body;

    try {
        const result = await db.query(
            'INSERT INTO tests (name, project_id, webhook_url, scheduled) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, project_id, webhook_url, scheduled || false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Run a specific test
router.post('/:testId/run', async (req, res) => {
    const { testId } = req.params;

    try {
        const test = await db.query('SELECT * FROM tests WHERE id = $1', [testId]);
        if (test.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        // Send a request to the webhook URL
        const response = await axios.post(test.rows[0].webhook_url, { testId });

        // Save the test result
        const result = await db.query(
            'INSERT INTO test_results (test_id, status, result) VALUES ($1, $2, $3) RETURNING *',
            [testId, 'success', response.data]
        );
        res.json(result.rows[0]);
    } catch (err) {
        // If the webhook request fails, save the error as a failed test result
        await db.query(
            'INSERT INTO test_results (test_id, status, result) VALUES ($1, $2, $3) RETURNING *',
            [testId, 'failed', { error: err.message }]
        );
        res.status(500).json({ error: err.message });
    }
});

// Get all test results for a specific test
router.get('/:testId/results', async (req, res) => {
    const { testId } = req.params;

    try {
        const results = await db.query(
            'SELECT * FROM test_results WHERE test_id = $1 ORDER BY created_at DESC',
            [testId]
        );
        res.json(results.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Webhook endpoint for receiving test results (protected by API key)
router.post('/webhook', authenticateWebhook, async (req, res) => {
    const { testId, status, result } = req.body;

    try {
        const test = await db.query('SELECT * FROM tests WHERE id = $1', [testId]);
        if (test.rows.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        // Save the test result
        const dbResult = await db.query(
            'INSERT INTO test_results (test_id, status, result) VALUES ($1, $2, $3) RETURNING *',
            [testId, status, result]
        );
        res.json(dbResult.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;