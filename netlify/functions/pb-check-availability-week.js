// HomeTeam — Practice Better Weekly Availability Check
// Returns which practitioners have availability in the next 7 days
// Also triggers waitlist notifications when availability opens up

const { getAccessToken, pbApiRequest, corsHeaders, isRateLimited } = require('./pb-auth');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfxjnnpxldurjhkbqelc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeGpubnB4bGR1cmpoa2JxZWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTQxNTQsImV4cCI6MjA4NjkzMDE1NH0.xE2ZKPFmq6Ue9hMFqRJnRDXDvJ8dTlpBrXIUSlOSr2M';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function supabaseRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SUPABASE_URL);
        const reqHeaders = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'return=representation' : (method === 'PATCH' ? 'return=representation' : undefined)
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

function sendResendEmail(to, subject, html) {
    if (!RESEND_API_KEY) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            from: 'HomeTeam <notifications@hometeammarketplace.com>',
            to: to,
            subject: subject,
            html: html
        });
        const options = {
            hostname: 'api.resend.com',
            port: 443,
            path: '/emails',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve(data));
        });
        req.on('error', (err) => { console.error('Email error:', err); resolve(); });
        req.write(body);
        req.end();
    });
}

exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (isRateLimited(ip, 60000, 5)) {
        return { statusCode: 429, headers: corsHeaders(), body: JSON.stringify({ error: 'Rate limited' }) };
    }

    try {
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const todayStr = now.toISOString().split('T')[0];

        // Get all practitioners with PB configured
        const practRes = await supabaseRequest('GET',
            `/rest/v1/practitioners?pb_consultant_id=not.is.null&select=id,pb_consultant_id,pb_default_service_id,name`
        );

        if (!practRes.data || practRes.data.length === 0) {
            return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ available_practitioners: [] }) };
        }

        const availablePractitioners = [];
        const newlyAvailable = []; // For waitlist notifications

        for (const pract of practRes.data) {
            if (!pract.pb_default_service_id) continue;

            // Check cache first
            const cacheRes = await supabaseRequest('GET',
                `/rest/v1/pb_availability_cache?practitioner_id=eq.${pract.id}&slot_start=gte.${todayStr}T00:00:00Z&slot_start=lte.${weekFromNow.toISOString()}&select=slot_start,cached_at&limit=1`
            );

            let hasAvailability = false;

            if (cacheRes.data && cacheRes.data.length > 0) {
                const cachedAt = new Date(cacheRes.data[0].cached_at).getTime();
                if (Date.now() - cachedAt < CACHE_TTL_MS) {
                    hasAvailability = true;
                } else {
                    // Cache is stale, fetch fresh
                    hasAvailability = await fetchAndCacheAvailability(pract, todayStr);
                }
            } else {
                // No cache, fetch fresh
                hasAvailability = await fetchAndCacheAvailability(pract, todayStr);
            }

            if (hasAvailability) {
                availablePractitioners.push(pract.id);
                newlyAvailable.push(pract);
            }
        }

        // Process waitlist notifications for newly available practitioners
        if (newlyAvailable.length > 0) {
            await processWaitlistNotifications(newlyAvailable);
        }

        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({ available_practitioners: availablePractitioners })
        };

    } catch (err) {
        console.error('Check availability week error:', err);
        return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to check availability' }) };
    }
};

async function fetchAndCacheAvailability(pract, dateStr) {
    try {
        const token = await getAccessToken();
        const dayParam = encodeURIComponent(dateStr + 'T00:00:00');
        const pbRes = await pbApiRequest('GET',
            `/consultant/availability/slots?as_consultant=${pract.pb_consultant_id}&day=${dayParam}&serviceId=${pract.pb_default_service_id}`,
            token
        );

        if (pbRes.status === 204 || !pbRes.data) return false;

        const slots = Array.isArray(pbRes.data) ? pbRes.data : [];
        if (slots.length === 0) return false;

        // Clear old cache
        await supabaseRequest('DELETE',
            `/rest/v1/pb_availability_cache?practitioner_id=eq.${pract.id}&pb_service_id=eq.${pract.pb_default_service_id}`
        );

        // Cache new slots
        const cacheRows = slots.map(s => ({
            practitioner_id: pract.id,
            pb_consultant_id: pract.pb_consultant_id,
            pb_service_id: pract.pb_default_service_id,
            slot_start: s.startDate,
            slot_end: s.endDate,
            slot_duration: s.duration || null,
            cached_at: new Date().toISOString()
        }));

        await supabaseRequest('POST', '/rest/v1/pb_availability_cache', cacheRows);
        return true;
    } catch (err) {
        console.error(`Failed to fetch availability for practitioner ${pract.id}:`, err);
        return false;
    }
}

async function processWaitlistNotifications(availablePractitioners) {
    for (const pract of availablePractitioners) {
        try {
            // Find un-notified waitlist entries
            const waitlistRes = await supabaseRequest('GET',
                `/rest/v1/pb_waitlist?practitioner_id=eq.${pract.id}&notified_at=is.null&select=id,email,athlete_id`
            );

            if (!waitlistRes.data || waitlistRes.data.length === 0) continue;

            for (const entry of waitlistRes.data) {
                // Send notification email
                await sendResendEmail(
                    entry.email,
                    `${pract.name} now has availability on HomeTeam!`,
                    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4b916d;">Good News!</h2>
                        <p>${pract.name} now has availability this week.</p>
                        <p>
                            <a href="https://hometeammarketplace.netlify.app/#practitioners"
                               style="display: inline-block; background: #4b916d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                                Book Now
                            </a>
                        </p>
                        <p style="color: #666; font-size: 14px;">You received this because you joined the waitlist for ${pract.name} on HomeTeam.</p>
                    </div>`
                );

                // Mark as notified
                await supabaseRequest('PATCH',
                    `/rest/v1/pb_waitlist?id=eq.${entry.id}`,
                    { notified_at: new Date().toISOString() }
                );
            }
        } catch (err) {
            console.error(`Waitlist notification error for practitioner ${pract.id}:`, err);
        }
    }
}
