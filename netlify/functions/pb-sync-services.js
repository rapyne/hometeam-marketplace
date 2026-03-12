// HomeTeam — Practice Better Services Sync
// Admin utility: fetches PB services and caches them locally

const { getAccessToken, pbApiRequest, corsHeaders, isRateLimited } = require('./pb-auth');
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

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (isRateLimited(ip, 60000, 3)) {
        return { statusCode: 429, headers: corsHeaders(), body: JSON.stringify({ error: 'Rate limited' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { practitioner_id } = body;

        if (!practitioner_id) {
            return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'practitioner_id required' }) };
        }

        // Look up practitioner's PB consultant ID
        const practRes = await supabaseRequest('GET',
            `/rest/v1/practitioners?id=eq.${practitioner_id}&select=pb_consultant_id`
        );

        if (!practRes.data || practRes.data.length === 0) {
            return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: 'Practitioner not found' }) };
        }

        const consultantId = practRes.data[0].pb_consultant_id;
        if (!consultantId) {
            return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'No PB consultant ID configured' }) };
        }

        // Fetch services from PB
        const token = await getAccessToken();
        const servicesRes = await pbApiRequest('GET', `/consultant/services?limit=100`, token);

        if (servicesRes.status !== 200 || !servicesRes.data) {
            return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to fetch PB services' }) };
        }

        const services = servicesRes.data.data || servicesRes.data || [];

        // Clear existing cached services for this practitioner
        await supabaseRequest('DELETE',
            `/rest/v1/pb_services?practitioner_id=eq.${practitioner_id}`
        );

        // Store new services
        if (services.length > 0) {
            const serviceRows = services.map(s => ({
                practitioner_id: parseInt(practitioner_id),
                pb_service_id: s.id,
                name: s.name || s.title || 'Unknown Service',
                duration: s.duration || null,
                service_type: s.serviceType || null,
                synced_at: new Date().toISOString()
            }));

            await supabaseRequest('POST', '/rest/v1/pb_services', serviceRows);
        }

        // Also fetch and store forms (for intake form selection)
        let forms = [];
        try {
            const formsRes = await pbApiRequest('GET', `/consultant/forms?limit=100`, token);
            if (formsRes.status === 200 && formsRes.data) {
                forms = formsRes.data.data || formsRes.data || [];
            }
        } catch (formErr) {
            console.error('Failed to fetch forms (non-blocking):', formErr);
        }

        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({
                success: true,
                services: services.map(s => ({ id: s.id, name: s.name || s.title, duration: s.duration })),
                forms: forms.map(f => ({ id: f.id, name: f.name || f.title })),
                message: `Synced ${services.length} services and ${forms.length} forms`
            })
        };

    } catch (err) {
        console.error('PB sync services error:', err);
        return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to sync services' }) };
    }
};
