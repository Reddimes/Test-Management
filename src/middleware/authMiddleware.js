const db = require('../config/db');

const authenticateWebhook = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
    }

    try {
        const user = await db.query('SELECT * FROM users WHERE api_key = $1', [apiKey]);
        if (user.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        req.user = user.rows[0];
        next();
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { authenticateWebhook };