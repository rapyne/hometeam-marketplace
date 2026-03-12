// HomeTeam — Practice Better Availability Slots
// Fetches and caches practitioner availability from PB

const { getAccessToken, pbApiRequest, corsHeaders, isRateLimited } = require('./pb-auth');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfxjnnpxldurjhkbqelc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeGpubnB4bGR1cmpoa2JxZWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTQxNTQsImV4cCI6MjA4NjkzMDE1NH0.xE2ZKPFmq6Ue9hMFqRJnRDXDvJ8dTlpBrXIUSlOSr2M';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function supabaseRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SUPABASE_URL);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': method === 'POST' ? 'return=representation' : undefined
            }
        };
        // Remove undefined headers
        Object.keys(options.headers).forEach(k => {
            if (options.headers[k] === undefined) delete options.headers[k];
        });

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
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (isRateLimited(ip, 60000, 30)) {
        return { statusCode: 429, headers: corsHeaders(), body: JSON.stringify({ error: 'Rate limited' }) };
    }

    try {
        const params = event.queryStringParameters || {};
        const practitionerId = params.practitioner_id;
        if (!practitionerId) {
            return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'practitioner_id required' }) };
        }

        // Look up practitioner's PB config
        const practRes = await supabaseRequest('GET',
            `/rest/v1/practitioners?id=eq.${practitionerId}&select=pb_consultant_id,pb_default_service_id`
        );

        if (!practRes.data || practRes.data.length === 0) {
            return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: 'Practitioner not found' }) };
        }

        const practitioner = practRes.data[0];
        if (!practitioner.pb_consultant_id || !practitioner.pb_default_service_id) {
            return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ slots: [], message: 'Practitioner not connected to Practice Better' }) };
        }

        const consultantId = practitioner.pb_consultant_id;
        const serviceId = practitioner.pb_default_service_id;
        const requestDate = params.date || new Date().toISOString().split('T')[0];

        // Check cache first
        const cacheRes = await supabaseRequest('GET',
            `/rest/v1/pb_availability_cache?practitioner_id=eq.${practitionerId}&pb_service_id=eq.${serviceId}&slot_start=gte.${requestDate}T00:00:00Z&order=slot_start.asc&select=slot_start,slot_end,slot_duration,cached_at&limit=100`
        );

        if (cacheRes.data && cacheRes.data.length > 0) {
            const cachedAt = new Date(cacheRes.data[0].cached_at).getTime();
            if (Date.now() - cachedAt < CACHE_TTL_MS) {
                // Return cached data
                const slots = cacheRes.data.map(s => ({
                    startDate: s.slot_start,
                    endDate: s.slot_end,
                    duration: s.slot_duration
                }));
                return {
                    statusCode: 200,
                    headers: corsHeaders(),
                    body: JSON.stringify({ slots, cached: true })
                };
            }
        }

        // Fetch fresh availability from Practice Better
        const token = await getAccessToken();
        const dayParam = encodeURIComponent(requestDate + 'T00:00:00');
        const pbRes = await pbApiRequest('GET',
            `/consultant/availability/slots?as_consultant=${consultantId}&day=${dayParam}&serviceId=${serviceId}`,
            token
        );

        if (pbRes.status === 204 || !pbRes.data) {
            // No availability — clear cache for this practitioner
            await supabaseRequest('DELETE',
                `/rest/v1/pb_availability_cache?practitioner_id=eq.${practitionerId}&pb_service_id=eq.${serviceId}&slot_start=gte.${requestDate}T00:00:00Z`
            );
            return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ slots: [], cached: false }) };
        }

        const slots = Array.isArray(pbRes.data) ? pbRes.data : [];

        // Clear old cache for this practitioner/service
        await supabaseRequest('DELETE',
            `/rest/v1/pb_availability_cache?practitioner_id=eq.${practitionerId}&pb_service_id=eq.${serviceId}`
        );

        // Cache new slots
        if (slots.length > 0) {
            const cacheRows = slots.map(s => ({
                practitioner_id: parseInt(practitionerId),
                pb_consultant_id: consultantId,
                pb_service_id: serviceId,
                slot_start: s.startDate,
                slot_end: s.endDate,
                slot_duration: s.duration || null,
                cached_at: new Date().toISOString()
            }));

            await supabaseRequest('POST', '/rest/v1/pb_availability_cache', cacheRows);
        }

        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({
                slots: slots.map(s => ({
                    startDate: s.startDate,
                    endDate: s.endDate,
                    duration: s.duration
                })),
                cached: false
            })
        };

    } catch (err) {
        console.error('PB availability error:', err);
        return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to fetch availability' }) };
    }
};
