const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const planRoutes = require('./routes/plan');
const dashboardRoutes = require('./routes/dashboard');
const chatRoutes = require('./routes/chat');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Catch malformed JSON bodies
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Invalid JSON in request body.' });
    }
    next(err);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);

// Serve the frontend — index.html (Get Started) is shown at "/"
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found.' });
});

// Global error handler — catches anything routes forgot to handle
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Quick DB sanity check so failures show up in logs immediately
    try {
        const db = require('./db');
        await db.query('SELECT 1');
        console.log('Database connection OK.');
    } catch (err) {
        console.error('Database connection FAILED:', err.message);
    }
});