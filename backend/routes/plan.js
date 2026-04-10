const express = require('express');
const router  = express.Router();
const https   = require('https');
const db      = require('../db');
const jwt     = require('jsonwebtoken');

// ── Auth helper ───────────────────────────────────────────────────────────────
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

// ── ExerciseDB helper ─────────────────────────────────────────────────────────
function fetchExercisesByBodyPart(bodyPart, limit = 20) {
    return new Promise((resolve, reject) => {
        const encoded = encodeURIComponent(bodyPart);
        const options = {
            hostname: process.env.RAPIDAPI_HOST,
            path: `/exercises/bodyPart/${encoded}?limit=${limit}&offset=0`,
            method:   'GET',
            headers: {
                'X-RapidAPI-Key':  process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

//Plan configuration per goal + fitness level
//Each entry is a day with a label and list of body parts to pull from
const SPLITS = {
    lose_weight: {
        beginner:     [
            { label: 'Full Body',          parts: ['chest', 'back', 'upper legs'] },
            { label: 'Cardio & Core',      parts: ['cardio', 'waist'] },
            { label: 'Shoulders & Arms',   parts: ['shoulders', 'upper arms', 'lower arms'] }
        ],
        intermediate: [
            { label: 'Upper Body',         parts: ['chest', 'back', 'shoulders'] },
            { label: 'Cardio & Core',      parts: ['cardio', 'waist'] },
            { label: 'Lower Body',         parts: ['upper legs', 'lower legs'] },
            { label: 'Arms & Cardio',      parts: ['upper arms', 'lower arms', 'cardio'] }
        ],
        advanced:     [
            { label: 'Upper Body Push',    parts: ['chest', 'shoulders', 'upper arms'] },
            { label: 'Cardio & Core',      parts: ['cardio', 'waist'] },
            { label: 'Back & Biceps',      parts: ['back', 'lower arms'] },
            { label: 'Lower Body',         parts: ['upper legs', 'lower legs'] },
            { label: 'Full Body Cardio',   parts: ['cardio', 'waist', 'upper legs'] }
        ]
    },
    build_muscle: {
        beginner:     [
            { label: 'Push – Chest & Shoulders', parts: ['chest', 'shoulders'] },
            { label: 'Pull – Back & Biceps',     parts: ['back', 'upper arms'] },
            { label: 'Legs',                     parts: ['upper legs', 'lower legs'] }
        ],
        intermediate: [
            { label: 'Push – Chest & Shoulders', parts: ['chest', 'shoulders', 'upper arms'] },
            { label: 'Pull – Back & Biceps',     parts: ['back', 'lower arms'] },
            { label: 'Legs',                     parts: ['upper legs', 'lower legs'] },
            { label: 'Arms & Core',              parts: ['upper arms', 'lower arms', 'waist'] }
        ],
        advanced:     [
            { label: 'Chest & Triceps',          parts: ['chest', 'upper arms'] },
            { label: 'Back & Biceps',            parts: ['back', 'lower arms'] },
            { label: 'Legs',                     parts: ['upper legs', 'lower legs'] },
            { label: 'Shoulders & Core',         parts: ['shoulders', 'waist'] },
            { label: 'Arms',                     parts: ['upper arms', 'lower arms', 'neck'] }
        ]
    },
    maintain: {
        beginner:     [
            { label: 'Upper Body',         parts: ['chest', 'back', 'shoulders'] },
            { label: 'Lower Body',         parts: ['upper legs', 'lower legs'] },
            { label: 'Core & Arms',        parts: ['waist', 'upper arms', 'lower arms'] }
        ],
        intermediate: [
            { label: 'Chest & Back',       parts: ['chest', 'back'] },
            { label: 'Legs & Core',        parts: ['upper legs', 'lower legs', 'waist'] },
            { label: 'Shoulders & Arms',   parts: ['shoulders', 'upper arms', 'lower arms'] },
            { label: 'Full Body',          parts: ['chest', 'back', 'upper legs'] }
        ],
        advanced:     [
            { label: 'Chest & Shoulders',  parts: ['chest', 'shoulders'] },
            { label: 'Back & Core',        parts: ['back', 'waist'] },
            { label: 'Legs',               parts: ['upper legs', 'lower legs'] },
            { label: 'Arms',               parts: ['upper arms', 'lower arms'] },
            { label: 'Full Body',          parts: ['chest', 'back', 'upper legs', 'shoulders'] }
        ]
    },
    endurance: {
        beginner:     [
            { label: 'Cardio',             parts: ['cardio', 'upper legs'] },
            { label: 'Upper Body Circuit', parts: ['chest', 'back', 'shoulders'] },
            { label: 'Core & Legs',        parts: ['waist', 'lower legs'] }
        ],
        intermediate: [
            { label: 'Cardio Blast',       parts: ['cardio', 'upper legs'] },
            { label: 'Upper Circuit',      parts: ['chest', 'upper arms', 'shoulders'] },
            { label: 'Cardio & Core',      parts: ['cardio', 'waist'] },
            { label: 'Lower Circuit',      parts: ['upper legs', 'lower legs', 'back'] }
        ],
        advanced:     [
            { label: 'Cardio Intervals',   parts: ['cardio', 'upper legs'] },
            { label: 'Upper Circuit',      parts: ['chest', 'shoulders', 'upper arms'] },
            { label: 'Cardio & Core',      parts: ['cardio', 'waist'] },
            { label: 'Lower Circuit',      parts: ['upper legs', 'lower legs'] },
            { label: 'Full Body Endurance',parts: ['back', 'chest', 'waist', 'cardio'] }
        ]
    }
};

// Sets & reps per goal
const PRESCRIPTION = {
    lose_weight:  { sets: 3, reps: '15' },
    build_muscle: { sets: 4, reps: '8–10' },
    maintain:     { sets: 3, reps: '12' },
    endurance:    { sets: 3, reps: '20' }
};

// Exercises per session per fitness level
const EX_PER_DAY = { beginner: 4, intermediate: 5, advanced: 6 };

// Body parts to exclude for joint pain
const JOINT_PAIN_AVOID = ['lower legs'];

// Shuffle helper
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ── GET /api/plan/generate ────────────────────────────────────────────────────
router.get('/generate', async (req, res) => {
    const authUser = getUser(req, res);
    if (!authUser) return;

    try {
        // Fetch full profile
        const [rows] = await db.query(
            'SELECT fitness_level, goal FROM users WHERE id = ?',
            [authUser.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });

        const { fitness_level, goal } = rows[0];
        if (!fitness_level || !goal) {
            return res.status(400).json({ message: 'Please complete your profile first.' });
        }

        // Get medical flags
        const [medRows] = await db.query(
            'SELECT flag FROM user_medical_flags WHERE user_id = ?',
            [authUser.id]
        );
        const medFlags = medRows.map(r => r.flag);
        const hasJointPain    = medFlags.includes('joint pain');
        const hasHeartIssue   = medFlags.includes('heart condition');
        const hasAsthma       = medFlags.includes('asthma');

        // Build the day plan for this goal + level
        let days = SPLITS[goal][fitness_level].map(d => ({ ...d }));

        // Apply medical filter: remove high-impact body parts for joint pain
        if (hasJointPain) {
            days = days.map(d => ({
                ...d,
                parts: d.parts.filter(p => !JOINT_PAIN_AVOID.includes(p))
            })).filter(d => d.parts.length > 0);
        }

        // Reduce cardio sessions for heart/asthma
        if (hasHeartIssue || hasAsthma) {
            days = days.map(d => ({
                ...d,
                parts: d.parts.filter(p => p !== 'cardio')
            })).filter(d => d.parts.length > 0);
        }

        const { sets, reps } = PRESCRIPTION[goal];
        const exercisesPerDay = EX_PER_DAY[fitness_level];

        // Fetch exercises for each unique body part (deduplicated)
        const uniqueParts = [...new Set(days.flatMap(d => d.parts))];
        const exerciseMap = {};

        await Promise.all(uniqueParts.map(async (part) => {
            try {
                const data = await fetchExercisesByBodyPart(part, 30);
                exerciseMap[part] = Array.isArray(data) ? data : [];
            } catch {
                exerciseMap[part] = [];
            }
        }));

        // Build each day
        const planDays = days.map(day => {
            // Gather all exercises from this day's body parts, then shuffle
            const pool = shuffle(
                day.parts.flatMap(p => (exerciseMap[p] || []).map(ex => ({ ...ex, bodyPart: p })))
            );

            // Pick unique-named exercises up to the limit
            const seen = new Set();
            const picked = [];
            for (const ex of pool) {
                if (picked.length >= exercisesPerDay) break;
                if (!seen.has(ex.name)) {
                    seen.add(ex.name);
                    picked.push({
                        name:         ex.name,
                        target:       ex.target,
                        bodyPart:     ex.bodyPart,
                        equipment:    ex.equipment,
                        instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
                        sets,
                        reps
                    });
                }
            }

            return { dayLabel: day.label, exercises: picked };
        });

        const goalLabels = {
            lose_weight:  'Weight Loss',
            build_muscle: 'Muscle Building',
            maintain:     'Maintenance',
            endurance:    'Endurance'
        };
        const levelLabels = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

        const plan = {
            plan_name: `${levelLabels[fitness_level]} ${goalLabels[goal]} Plan`,
            fitness_level,
            goal,
            days: planDays
        };

        res.json(plan);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not generate plan. Please try again.' });
    }
});

// ── POST /api/plan/save ───────────────────────────────────────────────────────
router.post('/save', async (req, res) => {
    const authUser = getUser(req, res);
    if (!authUser) return;

    const { plan_name, plan_data } = req.body;
    if (!plan_name || !plan_data) {
        return res.status(400).json({ message: 'plan_name and plan_data are required.' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO workout_plans (user_id, plan_name, plan_data) VALUES (?, ?, ?)',
            [authUser.id, plan_name, JSON.stringify(plan_data)]
        );
        res.status(201).json({ message: 'Plan saved!', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not save plan.' });
    }
});

// ── GET /api/plan/history ─────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
    const authUser = getUser(req, res);
    if (!authUser) return;

    try {
        const [rows] = await db.query(
            'SELECT id, plan_name, created_at FROM workout_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
            [authUser.id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not fetch history.' });
    }
});

// ── GET /api/plan/:id ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    const authUser = getUser(req, res);
    if (!authUser) return;

    try {
        const [rows] = await db.query(
            'SELECT * FROM workout_plans WHERE id = ? AND user_id = ?',
            [req.params.id, authUser.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Plan not found.' });
        const plan = rows[0];
        plan.plan_data = typeof plan.plan_data === 'string'
            ? JSON.parse(plan.plan_data) : plan.plan_data;
        res.json(plan);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not fetch plan.' });
    }
});

module.exports = router;