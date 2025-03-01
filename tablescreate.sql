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