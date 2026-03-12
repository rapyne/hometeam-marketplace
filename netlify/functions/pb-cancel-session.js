// HomeTeam — Practice Better Session Cancellation
// Cancels a booking in both HomeTeam and Practice Better

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
            'Prefer': method === 'PATCH' ? 'return=representation' : undefined
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
    if (isRateLimited(ip, 60000, 5)) {
        return { statusCode: 429, headers: corsHeaders(), body: JSON.stringify({ error: 'Rate limited' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { booking_id, reason } = body;

        if (!booking_id) {
            return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'booking_id required' }) };
        }

        // 1. Look up booking
        const bookingRes = await supabaseRequest('GET',
            `/rest/v1/bookings?id=eq.${booking_id}&select=id,pb_session_id,status`
        );

        if (!bookingRes.data || bookingRes.data.length === 0) {
            return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: 'Booking not found' }) };
        }

        const booking = bookingRes.data[0];

        if (booking.status === 'cancelled') {
            return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Booking already cancelled' }) };
        }

        // 2. Cancel in Practice Better if we have a PB session ID
        if (booking.pb_session_id) {
            try {
                const token = await getAccessToken();
                const cancelRes = await pbApiRequest('POST',
                    `/consultant/sessions/${booking.pb_session_id}/cancel`,
                    token,
                    {
                        notify: true,
                        notes: reason || 'Cancelled via HomeTeam Marketplace'
                    }
                );

                if (cancelRes.status !== 200 && cancelRes.status !== 202) {
                    console.error('PB cancel failed:', cancelRes);
                    // Continue to cancel locally even if PB fails
                }
            } catch (pbErr) {
                console.error('PB cancel error (non-blocking):', pbErr);
            }
        }

        // 3. Update booking status in HomeTeam DB
        await supabaseRequest('PATCH',
            `/rest/v1/bookings?id=eq.${booking_id}`,
            { status: 'cancelled' }
        );

        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({
                success: true,
                message: 'Booking cancelled successfully'
            })
        };

    } catch (err) {
        console.error('Cancel session error:', err);
        return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to cancel booking' }) };
    }
};
