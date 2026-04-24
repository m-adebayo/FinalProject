const express = require('express');
const https   = require('https');
const router  = express.Router();

// Builds the "system prompt" sent to OpenAI — this tells the bot who it is
// and how to behave. Each bot (Freida / Nardo) has a different personality.
function getSystemPrompt(bot, userContext) {
    const ctx = userContext || {};
    // If we know the user's name, add it so the bot can greet them personally
    const base = ctx.first_name
        ? `The user's name is ${ctx.first_name}.`
        : '';

    if (bot === 'freida') {
        const fitnessCtx = ctx.fitness_level
            ? ` Their fitness level is ${ctx.fitness_level} and their goal is ${ctx.goal || 'general fitness'}.`
            : '';
        return `You are Freida, a friendly and motivating personal fitness coach chatbot for ny page. ${base}${fitnessCtx}
You give practical, safe workout and exercise advice. Keep your answers concise and encouraging. You can suggest exercises, explain proper form, recommend workout splits, and help with recovery. You don't give medical diagnoses. If something sounds like a medical issue, advise the user to see a professional. Keep the vibe upbeat and supportive. If a user asks anything unrelated to Fitness, ensure you kindly decline to answer. You should not answer food related enquiries, if the user asks anything food related, tell them to speak to Nardo the Nutritionist bot`;
    }

    if (bot === 'nardo') {
        const nutritionCtx = ctx.goal
            ? ` Their fitness goal is ${ctx.goal}.`
            : '';
        return `You are Nardo, a knowledgeable and friendly nutritionist chatbot for AllThingsFitness. ${base}${nutritionCtx}
You give helpful, practical nutrition and diet advice. Keep your answers clear and friendly. You can suggest meal ideas, explain macros, discuss calorie targets, and help with healthy eating habits. You don't give medical diagnoses or treat eating disorders — for those, always refer to a professional. Keep things chill and helpful. If a user asks anything unrelated to nutrition, kindly decline to answer. You should not answer excercise/gym/fitness enquiries, yet purely about food. If the user asks anything exercise/fitness/nutrition related, tell them to speak to Freida the Fitness bot.`;
    }

    return 'You are a helpful fitness assistant.';
}

// POST /api/chat forwards user messages to OpenAI and returns the bot's reply
router.post('/', async (req, res) => {
    const { bot, messages, userContext } = req.body;

    if (!bot || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Missing bot or messages field.' });
    }

    // Fail fast if no API key is set — otherwise the request to OpenAI would just 401
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_OPENAI_KEY_HERE') {
        return res.status(500).json({ error: 'OpenAI API key not configured. Add your key to backend/.env as OPENAI_API_KEY.' });
    }

    const systemPrompt = getSystemPrompt(bot, userContext);

    // Put the system prompt first, then the user's chat history
    const payload = JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages
        ],
        max_tokens: 500,   // cap reply length to keep costs low
        temperature: 0.7   // creativity variable, 0.7 is not too random, not too robotic
    });

    const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    // Send the request to OpenAI. The response comes back in chunks,
    // so we collect them all before parsing.
    const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                    return res.status(502).json({ error: parsed.error.message });
                }
                // The actual reply text lives at choices[0].message.content
                const reply = parsed.choices?.[0]?.message?.content || 'No response from AI.';
                res.json({ reply });
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse OpenAI response.' });
            }
        });
    });

    apiReq.on('error', (err) => {
        res.status(500).json({ error: 'Could not reach OpenAI: ' + err.message });
    });

    apiReq.write(payload);
    apiReq.end();
});

module.exports = router;
