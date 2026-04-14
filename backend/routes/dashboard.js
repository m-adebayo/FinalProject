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

/**
 * Calculate BMR using Mifflin-St Jeor equation.
 * weight in kg, height in cm, age in years.
 */
function calcBMR(weight, height, age, gender) {
    const base = (10 * weight) + (6.25 * height) - (5 * age);
    if (gender === 'male')   return base + 5;
    if (gender === 'female') return base - 161;
    // 'other' — average of both
    return base - 78;
}

/**
 * Activity multiplier based on fitness level.
 */
const activityMultiplier = {
    beginner:     1.375,  // lightly active
    intermediate: 1.55,   // moderately active
    advanced:     1.725   // very active
};

/**
 * Calorie adjustment for each goal.
 */
const goalAdjustment = {
    lose_weight:   -500,
    build_muscle:  +300,
    maintain:         0,
    endurance:     +200
};

/**
 * Macro ratios (protein / carbs / fat as % of total calories) per goal.
 * Protein & carbs = 4 cal/g, Fat = 9 cal/g.
 */
const macroRatios = {
    lose_weight:  { protein: 0.40, carbs: 0.30, fat: 0.30 },
    build_muscle: { protein: 0.35, carbs: 0.45, fat: 0.20 },
    maintain:     { protein: 0.30, carbs: 0.40, fat: 0.30 },
    endurance:    { protein: 0.25, carbs: 0.55, fat: 0.20 }
};

// GET /api/dashboard/nutrition
// Returns personalised daily calorie target + protein/carbs/fat breakdown
router.get('/nutrition', async (req, res) => {
    const user = getUser(req, res);
    if (!user) return;

    try {
        const [rows] = await db.query(
            'SELECT weight, height, age, gender, fitness_level, goal FROM users WHERE id = ?',
            [user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const { weight, height, age, gender, fitness_level, goal } = rows[0];

        // Check the user has completed their profile
        if (!weight || !height || !age || !gender || !fitness_level || !goal) {
            return res.status(400).json({
                message: 'Profile incomplete. Please complete your profile setup first.'
            });
        }

        // 1. BMR
        const bmr = calcBMR(weight, height, age, gender);

        // 2. TDEE (Total Daily Energy Expenditure)
        const multiplier = activityMultiplier[fitness_level] || 1.375;
        const tdee = bmr * multiplier;

        // 3. Adjust for goal
        const adjustment = goalAdjustment[goal] ?? 0;
        const dailyCalories = Math.round(tdee + adjustment);

        // 4. Macro breakdown in grams
        const ratios = macroRatios[goal] || macroRatios.maintain;
        const protein = Math.round((dailyCalories * ratios.protein) / 4);
        const carbs   = Math.round((dailyCalories * ratios.carbs)   / 4);
        const fat     = Math.round((dailyCalories * ratios.fat)      / 9);

        // 5. Friendly label for the goal
        const goalLabels = {
            lose_weight:  'Lose Weight',
            build_muscle: 'Build Muscle',
            maintain:     'Maintain Weight',
            endurance:    'Improve Endurance'
        };

        res.json({
            dailyCalories,
            macros: { protein, carbs, fat },
            goal,
            goalLabel: goalLabels[goal] || goal,
            breakdown: {
                bmr:        Math.round(bmr),
                tdee:       Math.round(tdee),
                adjustment
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

module.exports = router;
