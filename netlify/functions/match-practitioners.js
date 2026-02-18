// HomeTeam — Practitioner Matching via Claude API
// Netlify Serverless Function

const https = require('https');

function callClaudeAPI(apiKey, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);

        const options = {
            hostname: 'api.anthropic.com',
            port: 443,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: responseBody });
            });
        });

        req.on('error', (err) => reject(err));
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });
        req.write(data);
        req.end();
    });
}

exports.handler = async function(event, context) {
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured. Set ANTHROPIC_API_KEY in Netlify environment variables.' }) };
    }

    try {
        const { patient, practitioners } = JSON.parse(event.body);

        // Validate input
        if (!patient || !practitioners || !Array.isArray(practitioners)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
        }

        const systemPrompt = `You are a mental health practitioner matching assistant for HomeTeam, a marketplace connecting individuals with mental health practitioners.

Your task: Given a patient's self-described needs, selected specialty categories, session preferences, and budget constraints, rank the available practitioners from most to least suitable. Return the top 5 matches.

You MUST respond with ONLY valid JSON — no explanation, no markdown, no commentary. The JSON must be an array of objects with exactly these fields:
- "id": the practitioner's numeric ID
- "score": a match percentage from 0 to 100
- "explanation": a 2-3 sentence personalized explanation of why this practitioner is a good fit, written directly to the patient using "you" language

Ranking criteria (in order of importance):
1. Specialty alignment: How well the practitioner's specialties match the patient's selected categories
2. Description match: How well the practitioner's bio, approaches, and expertise address what the patient described in their own words
3. Approach compatibility: If the patient selected preferred therapeutic approaches, favor practitioners who use those approaches
4. Session type: If the patient has a session type preference, prioritize practitioners who offer that type
5. Budget: Practitioners whose starting price is within the patient's budget range should rank higher
6. Rating and reviews: Higher-rated practitioners with more reviews should rank slightly higher among otherwise equal matches

Important: Be warm, encouraging, and specific in explanations. Reference the patient's stated needs and connect them to specific practitioner strengths. Avoid generic language.`;

        const userPrompt = `PATIENT PROFILE:
- Name: ${patient.name}
- What brings them here: "${patient.description}"
- Specialty categories they're interested in: ${patient.categories && patient.categories.length > 0 ? patient.categories.join(', ') : 'None specified'}
- Session type preference: ${patient.sessionPreference || 'No preference'}
- Maximum budget: $${patient.budgetMax || 300} per session
- Preferred therapeutic approaches: ${patient.approaches && patient.approaches.length > 0 ? patient.approaches.join(', ') : 'No preference'}

AVAILABLE PRACTITIONERS:
${JSON.stringify(practitioners, null, 2)}

Return the top 5 matching practitioners as a JSON array. Remember: respond with ONLY the JSON array, nothing else.`;

        // Call Claude API using Node.js https module
        const apiResponse = await callClaudeAPI(apiKey, {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt }
            ]
        });

        if (apiResponse.statusCode !== 200) {
            console.error('Claude API error:', apiResponse.statusCode, apiResponse.body);
            let apiError = 'Matching service error: ' + apiResponse.statusCode;
            try {
                const errObj = JSON.parse(apiResponse.body);
                apiError += ' - ' + (errObj.error?.message || JSON.stringify(errObj));
            } catch(e) {
                apiError += ' - ' + apiResponse.body.substring(0, 200);
            }
            return { statusCode: 502, headers, body: JSON.stringify({ error: apiError }) };
        }

        const claudeResponse = JSON.parse(apiResponse.body);
        const content = claudeResponse.content[0].text;

        // Parse JSON from Claude's response (with fallback extraction)
        let matches;
        try {
            matches = JSON.parse(content);
        } catch (e) {
            // Try to extract JSON array from surrounding text
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                matches = JSON.parse(jsonMatch[0]);
            } else {
                console.error('Could not parse Claude response:', content);
                return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not parse matching results' }) };
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ matches })
        };

    } catch (err) {
        console.error('Function error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
    }
};
