const cron = require('node-cron');
const axios = require('axios');
const db = require('../config/db');

const scheduleTests = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const tests = await db.query('SELECT * FROM tests WHERE scheduled = true');
            for (const test of tests.rows) {
                try {
                    const response = await axios.post(test.webhook_url, { testId: test.id });
                    await db.query(
                        'INSERT INTO test_results (test_id, status, result) VALUES ($1, $2, $3) RETURNING *',
                        [test.id, 'success', response.data]
                    );
                } catch (err) {
                    await db.query(
                        'INSERT INTO test_results (test_id, status, result) VALUES ($1, $2, $3) RETURNING *',
                        [test.id, 'failed', { error: err.message }]
                    );
                }
            }
        } catch (err) {
            console.error('Error running scheduled tests:', err);
        }
    });
};

module.exports = { scheduleTests };