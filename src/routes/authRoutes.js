const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const router = express.Router();

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const apiKey = jwt.sign({ username }, process.env.JWT_SECRET);

    try {
        const result = await db.query(
            'INSERT INTO users (username, password_hash, api_key) VALUES ($1, $2, $3) RETURNING *',
            [username, hashedPassword, apiKey]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET);
        res.json({ token, apiKey: user.rows[0].api_key });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;