const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const testRoutes = require('./routes/testRoutes');
const { scheduleTests } = require('./utils/scheduler');

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