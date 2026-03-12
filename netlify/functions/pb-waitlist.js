// HomeTeam — Practice Better Waitlist
// Add/remove athletes from practitioner waitlists

const { corsHeaders, isRateLimited } = require('./pb-auth');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfxjnnpxldurjhkbqelc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeGpubnB4bGR1cmpoa2JxZWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTQxNTQsImV4cCI6MjA4NjkzMDE1NH0.xE2ZKPFmq6Ue9hMFqRJnRDXDvJ8dTlpBrXIUSlOSr2M';

function supabaseRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SUPABASE_URL);
        const reqHeaders = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'return=representation' : undefined
        };
        Object.keys(reqHeaders).forEach(k => {
            if (reqHeaders[k] === undefined) delete reqHeaders[k];
        });

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: method,
            headers: reqHeaders
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }

    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (isRateLimited(ip, 60000, 10)) {
        return { statusCode: 429, headers: corsHeaders(), body: JSON.stringify({ error: 'Rate limited' }) };
    }

    // POST = join waitlist, DELETE = leave waitlist
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            const { practitioner_id, athlete_id, email } = body;

            if (!practitioner_id || !athlete_id || !email) {
                return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'practitioner_id, athlete_id, and email required' }) };
            }

            // Check if already on waitlist
            const existRes = await supabaseRequest('GET',
                `/rest/v1/pb_waitlist?athlete_id=eq.${athlete_id}&practitioner_id=eq.${practitioner_id}&select=id`
            );

            if (existRes.data && existRes.data.length > 0) {
                return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, message: 'Already on waitlist' }) };
            }

            // Add to waitlist
            const insertRes = await supabaseRequest('POST', '/rest/v1/pb_waitlist', {
                athlete_id: athlete_id,
                practitioner_id: parseInt(practitioner_id),
                email: email
            });

            return {
                statusCode: 200,
                headers: corsHeaders(),
                body: JSON.stringify({ success: true, message: 'Added to waitlist. We\'ll notify you when availability opens up!' })
            };

        } catch (err) {
            console.error('Waitlist join error:', err);
            return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to join waitlist' }) };
        }
    }

    if (event.httpMethod === 'DELETE') {
        try {
            const params = event.queryStringParameters || {};
            const { practitioner_id, athlete_id } = params;

            if (!practitioner_id || !athlete_id) {
                return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'practitioner_id and athlete_id required' }) };
            }

            await supabaseRequest('DELETE',
                `/rest/v1/pb_waitlist?athlete_id=eq.${athlete_id}&practitioner_id=eq.${practitioner_id}`
            );

            return {
                statusCode: 200,
                headers: corsHeaders(),
                body: JSON.stringify({ success: true, message: 'Removed from waitlist' })
            };

        } catch (err) {
            console.error('Waitlist leave error:', err);
            return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to leave waitlist' }) };
        }
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
};
