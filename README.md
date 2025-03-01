# Test-Management

Below is the complete code and setup procedures for your testing management system, including all the enhancements: UI improvements, error handling, webhook authentication, and scheduling. This will guide you through setting up the entire project from scratch.

Setup Procedures
1. Prerequisites
Ensure you have the following installed:

Node.js (v16 or higher)

PostgreSQL (v12 or higher)

Nginx (for serving the frontend and reverse proxying)

Git (optional, for version control)

2. Database Setup
Create a PostgreSQL Database:

bash
Copy
sudo -u postgres psql
CREATE DATABASE testing_management;
CREATE USER testuser WITH PASSWORD 'testpassword';
GRANT ALL PRIVILEGES ON DATABASE testing_management TO testuser;
Run the SQL Script:
Execute the following SQL script to create the necessary tables:

sql
Copy
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    project_id INT REFERENCES projects(id),
    webhook_url VARCHAR(255) NOT NULL,
    scheduled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_results (
    id SERIAL PRIMARY KEY,
    test_id INT REFERENCES tests(id),
    status VARCHAR(50) NOT NULL,
    result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
3. Backend Setup
3.1 Initialize the Project
bash
Copy
mkdir testing-management
cd testing-management
npm init -y
npm install express pg body-parser cors jsonwebtoken bcryptjs dotenv axios node-cron
3.2 Folder Structure
Copy
testing-management/
│
├── public/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── projectRoutes.js
│   │   └── testRoutes.js
│   ├── utils/
│   │   └── scheduler.js
│   └── app.js
│
├── .env
└── package.json
3.3 Backend Code
src/config/db.js
javascript
Copy
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

module.exports = pool;
src/middleware/authMiddleware.js
javascript
Copy
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
src/routes/authRoutes.js
javascript
Copy
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
src/routes/projectRoutes.js
javascript
Copy
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
src/utils/scheduler.js
javascript
Copy
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
src/app.js
javascript
Copy
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./src/routes/authRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const testRoutes = require('./src/routes/testRoutes');
const { scheduleTests } = require('./src/utils/scheduler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tests', testRoutes);

scheduleTests();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
4. Frontend Setup
4.1 public/index.html
html
Copy
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Testing Management</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <div id="app">
        <h1>Testing Management</h1>
        <div id="login-register">
            <input type="text" id="username" placeholder="Username">
            <input type="password" id="password" placeholder="Password">
            <button id="login">Login</button>
            <button id="register">Register</button>
        </div>
        <div id="dashboard" style="display:none;">
            <h2>Projects</h2>
            <div id="projects"></div>
            <button id="createProject">Create Project</button>
            <button id="testProject">Test Entire Project</button>
            <div id="testResults" style="margin-top: 20px;">
                <h3>Test Results</h3>
                <table id="resultsTable" border="1" cellpadding="10">
                    <thead>
                        <tr>
                            <th>Test Name</th>
                            <th>Status</th>
                            <th>Result</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Results will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
Run HTML
4.2 public/js/app.js
javascript
Copy
$(document).ready(function() {
    let token = null;
    let currentProjectId = null;

    $('#login').click(function() {
        const username = $('#username').val();
        const password = $('#password').val();

        $.post('/api/auth/login', { username, password }, function(data) {
            token = data.token;
            $('#login-register').hide();
            $('#dashboard').show();
            loadProjects();
        });
    });

    $('#register').click(function() {
        const username = $('#username').val();
        const password = $('#password').val();

        $.post('/api/auth/register', { username, password }, function(data) {
            alert('Registration successful! Please login.');
        });
    });

    $('#createProject').click(function() {
        const name = prompt('Enter project name:');
        if (name) {
            $.ajax({
                url: '/api/projects',
                type: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                data: { name, user_id: 1 }, // Replace with actual user ID
                success: function(data) {
                    loadProjects();
                }
            });
        }
    });

    $('#testProject').click(function() {
        if (!currentProjectId) {
            alert('Please select a project first.');
            return;
        }

        $.ajax({
            url: `/api/projects/${currentProjectId}/run-tests`,
            type: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(data) {
                alert('Project tests completed! Check the results.');
                console.log(data); // Log results to the console
                loadTestResults(currentProjectId); // Refresh results view
            },
            error: function(err) {
                alert('Error running project tests: ' + err.responseJSON.error);
                console.error(err);
            }
        });
    });

    function loadProjects() {
        $.ajax({
            url: '/api/projects/1', // Replace with actual user ID
            type: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(data) {
                $('#projects').empty();
                data.forEach(project => {
                    const projectElement = $(`
                        <div>
                            ${project.name}
                            <button class="selectProject" data-id="${project.id}">Select</button>
                            <button class="viewResults" data-id="${project.id}">View Results</button>
                        </div>
                    `);
                    $('#projects').append(projectElement);
                });

                // Add click handler for selecting a project
                $('.selectProject').click(function() {
                    currentProjectId = $(this).data('id');
                    alert(`Selected project ID: ${currentProjectId}`);
                });

                // Add click handler for viewing test results
                $('.viewResults').click(function() {
                    const projectId = $(this).data('id');
                    loadTestResults(projectId);
                });
            }
        });
    }

    function loadTestResults(projectId) {
        $.ajax({
            url: `/api/tests/results?projectId=${projectId}`,
            type: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(data) {
                $('#resultsTable tbody').empty();
                data.forEach(result => {
                    $('#resultsTable tbody').append(`
                        <tr>
                            <td>${result.test_name}</td>
                            <td>${result.status}</td>
                            <td>${JSON.stringify(result.result)}</td>
                            <td>${new Date(result.created_at).toLocaleString()}</td>
                        </tr>
                    `);
                });
            }
        });
    }
});
5. Nginx Configuration
5.1 /etc/nginx/sites-available/testing-management
nginx
Copy
server {
    listen 80;
    server_name testing-management.local;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /public/ {
        alias /path/to/testing-management/public/;
    }
}
5.2 Enable the Configuration
bash
Copy
sudo ln -s /etc/nginx/sites-available/testing-management /etc/nginx/sites-enabled/
sudo systemctl restart nginx
6. Environment Variables
6.1 .env
bash
Copy
JWT_SECRET=your_jwt_secret
DB_HOST=localhost
DB_USER=testuser
DB_PASSWORD=testpassword
DB_NAME=testing_management
DB_PORT=5432
7. Run the Application
Start the Node.js server:

bash
Copy
node src/app.js
Access the application at http://localhost or http://testing-management.local.

This is the complete setup and code for your testing management system. Let me know if you need further assistance!
