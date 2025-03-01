sudo -u postgres psql
CREATE DATABASE testing_management;
CREATE USER testuser WITH PASSWORD 'testpassword';
GRANT ALL PRIVILEGES ON DATABASE testing_management TO testuser;