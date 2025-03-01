const express = require('express');
const db = require('../config/db');
const router = express.Router();

router.post('/', async (req, res) => {
    const { name, user_id } = req.body;

    try {
        const result = await db.query(
            'INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING *',
            [name, user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await db.query('SELECT * FROM projects WHERE user_id = $1', [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:projectId/run-tests', async (req, res) => {
    const { projectId } = req.params;

    try {
        const tests = await db.query('SELECT * FROM tests WHERE project_id = $1', [projectId]);
        if (tests.rows.length === 0) {
            return res.status(404).json({ error: 'No tests found for this project' });
        }

        const results = [];
        for (const test of tests.rows) {
            try {
                const response = await axios.post(test.webhook_url, { testId: test.id });
                const result = await db.query(
                    'INSERT INTO test_results (test_id, status, result) VALUES ($1, $2, $3) RETURNING *',
                    [test.id, 'success', response.data]
                );
                results.push(result.rows[0]);
            } catch (err) {
                await db.query(
                    'INSERT INTO test_results (test_id, status, result) VALUES ($1, $2, $3) RETURNING *',
                    [test.id, 'failed', { error: err.message }]
                );
                results.push({ testId: test.id, status: 'failed', error: err.message });
            }
        }

        res.json({ message: 'All tests completed', results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;