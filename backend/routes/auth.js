const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Simple email format check
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/signup,creates a new user account
router.post('/signup', async (req, res) => {
    let { first_name, last_name, email, password } = req.body;

    // Make sure nothing was left blank before doing any DB work
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    // Clean the inputs, lowercase the email so "Bob@x.com" and "bob@x.com"
    // count as the same account
    first_name = String(first_name).trim();
    last_name = String(last_name).trim();
    email = String(email).trim().toLowerCase();

    if (first_name.length < 1 || first_name.length > 50) {
        return res.status(400).json({ message: 'First name must be between 1 and 50 characters.' });
    }
    if (last_name.length < 1 || last_name.length > 50) {
        return res.status(400).json({ message: 'Last name must be between 1 and 50 characters.' });
    }
    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (password.length > 100) {
        return res.status(400).json({ message: 'Password is too long.' });
    }

    try {
        //check if that email is already taken
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'An account with that email already exists.' });
        }

        //Hash with bcrypt (10 salt rounds)
        const password_hash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
            [first_name, last_name, email, password_hash]
        );

        // Give back a JWT so they're automatically logged in after signup
        const token = jwt.sign(
            { id: result.insertId, email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Account created successfully.',
            token,
            user: {
                id: result.insertId,
                first_name,
                last_name,
                email
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

// POST /api/auth/login, checks credentials and issues a JWT
router.post('/login', async (req, res) => {
    let { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    email = String(email).trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            // Deliberately vague message — don't reveal whether the email exists
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = rows[0];

        // bcrypt.compare hashes the entered password the same way and checks it matches
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Logged in successfully.',
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

module.exports = router;
