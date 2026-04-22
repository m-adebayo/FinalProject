const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

function getUser(req, res) {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) {
        res.status(401).json({ message: 'No token provided. Please log in.' });
        return null;
    }
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        res.status(403).json({ message: 'Invalid or expired token. Please log in again.' });
        return null;
    }
}

// GET /api/profile - fetch the current user's profile
router.get('/', async (req, res) => {
    const user = getUser(req, res);
    if (!user) return;
    req.user = user;
    const userId = req.user.id;

    try {
        // Get core profile fields from users table
        const [rows] = await db.query(
            'SELECT id, first_name, last_name, email, gender, height, weight, age, fitness_level, goal FROM users WHERE id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = rows[0];

        // Get dietary preferences
        const [dietRows] = await db.query(
            'SELECT preference FROM user_dietary_preferences WHERE user_id = ?',
            [userId]
        );

        // Get medical flags
        const [medRows] = await db.query(
            'SELECT flag FROM user_medical_flags WHERE user_id = ?',
            [userId]
        );

        res.json({
            ...user,
            dietary_preferences: dietRows.map(r => r.preference),
            medical_flags: medRows.map(r => r.flag)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

// POST /api/profile/setup - save or update the user's profile
router.post('/setup', async (req, res) => {
    const user = getUser(req, res);
    if (!user) return;
    req.user = user;
    const userId = req.user.id;
    const {
        gender,
        height,
        weight,
        age,
        fitness_level,
        goal,
        dietary_preferences, // array of strings
        medical_flags         // array of strings
    } = req.body;

    // Basic validation
    if (!gender || !height || !weight || !age || !fitness_level || !goal) {
        return res.status(400).json({ message: 'gender, height, weight, age, fitness_level and goal are all required.' });
    }

    const validGenders = ['male', 'female', 'other'];
    const validFitnessLevels = ['beginner', 'intermediate', 'advanced'];
    const validGoals = ['lose_weight', 'build_muscle', 'maintain', 'endurance'];

    if (!validGenders.includes(gender)) {
        return res.status(400).json({ message: 'Invalid gender value.' });
    }
    if (!validFitnessLevels.includes(fitness_level)) {
        return res.status(400).json({ message: 'Invalid fitness_level value.' });
    }
    if (!validGoals.includes(goal)) {
        return res.status(400).json({ message: 'Invalid goal value.' });
    }

    // Numeric range validation
    const heightNum = Number(height);
    const weightNum = Number(weight);
    const ageNum = Number(age);

    if (!Number.isFinite(heightNum) || heightNum < 50 || heightNum > 300) {
        return res.status(400).json({ message: 'Height must be a number between 50 and 300 cm.' });
    }
    if (!Number.isFinite(weightNum) || weightNum < 20 || weightNum > 500) {
        return res.status(400).json({ message: 'Weight must be a number between 20 and 500 kg.' });
    }
    if (!Number.isInteger(ageNum) || ageNum < 13 || ageNum > 120) {
        return res.status(400).json({ message: 'Age must be a whole number between 13 and 120.' });
    }

    try {
        // Update core fields on the users table
        await db.query(
            `UPDATE users
             SET gender = ?, height = ?, weight = ?, age = ?, fitness_level = ?, goal = ?
             WHERE id = ?`,
            [gender, heightNum, weightNum, ageNum, fitness_level, goal, userId]
        );

        // Replace dietary preferences (delete old, insert new)
        await db.query('DELETE FROM user_dietary_preferences WHERE user_id = ?', [userId]);
        if (Array.isArray(dietary_preferences) && dietary_preferences.length > 0) {
            const dietValues = dietary_preferences.map(p => [userId, p]);
            await db.query(
                'INSERT INTO user_dietary_preferences (user_id, preference) VALUES ?',
                [dietValues]
            );
        }

        // Replace medical flags (delete old, insert new)
        await db.query('DELETE FROM user_medical_flags WHERE user_id = ?', [userId]);
        if (Array.isArray(medical_flags) && medical_flags.length > 0) {
            const medValues = medical_flags.map(f => [userId, f]);
            await db.query(
                'INSERT INTO user_medical_flags (user_id, flag) VALUES ?',
                [medValues]
            );
        }

        res.json({ message: 'Profile saved successfully.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

module.exports = router;
