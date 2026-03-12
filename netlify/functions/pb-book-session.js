// HomeTeam — Practice Better Session Booking
// Creates PB client record (if needed) + books session + triggers intake form

const { getAccessToken, pbApiRequest, corsHeaders, isRateLimited } = require('./pb-auth');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfxjnnpxldurjhkbqelc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeGpubnB4bGR1cmpoa2JxZWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTQxNTQsImV4cCI6MjA4NjkzMDE1NH0.xE2ZKPFmq6Ue9hMFqRJnRDXDvJ8dTlpBrXIUSlOSr2M';

function supabaseRequest(method, path, body, headers) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SUPABASE_URL);
        const reqHeaders = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'return=representation' : undefined,
            ...headers
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
        const { practitioner_id, athlete_id, session_date, offering_name, notes, athlete_email, athlete_first_name, athlete_last_name } = body;

        if (!practitioner_id || !athlete_id || !session_date) {
            return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'practitioner_id, athlete_id, and session_date are required' }) };
        }

        if (!athlete_email || !athlete_first_name || !athlete_last_name) {
            return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'athlete_email, athlete_first_name, and athlete_last_name are required' }) };
        }

        // 1. Look up practitioner's PB config
        const practRes = await supabaseRequest('GET',
            `/rest/v1/practitioners?id=eq.${practitioner_id}&select=pb_consultant_id,pb_default_service_id,pb_intake_form_id,offerings`
        );

        if (!practRes.data || practRes.data.length === 0) {
            return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: 'Practitioner not found' }) };
        }

        const practitioner = practRes.data[0];
        if (!practitioner.pb_consultant_id || !practitioner.pb_default_service_id) {
            return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Practitioner not connected to Practice Better' }) };
        }

        const consultantId = practitioner.pb_consultant_id;
        const serviceId = practitioner.pb_default_service_id;

        // Determine duration from offering
        let duration = 50; // default
        if (offering_name && practitioner.offerings) {
            const offerings = typeof practitioner.offerings === 'string' ? JSON.parse(practitioner.offerings) : practitioner.offerings;
            const match = offerings.find(o => o.name === offering_name);
            if (match && match.duration) {
                duration = match.duration;
            }
        }

        const token = await getAccessToken();

        // 2. Check if athlete already has a PB client record for this practitioner
        const clientMapRes = await supabaseRequest('GET',
            `/rest/v1/pb_client_map?athlete_id=eq.${athlete_id}&pb_consultant_id=eq.${consultantId}&select=pb_record_id`
        );

        let pbRecordId;
        let isNewClient = false;

        if (clientMapRes.data && clientMapRes.data.length > 0) {
            pbRecordId = clientMapRes.data[0].pb_record_id;
        } else {
            // 3. Create PB client record
            const createRes = await pbApiRequest('POST', '/consultant/records', token, {
                profile: {
                    firstName: athlete_first_name,
                    lastName: athlete_last_name,
                    emailAddress: athlete_email
                },
                sendInvitation: true
            });

            if (createRes.status !== 200 || !createRes.data) {
                console.error('PB create client failed:', createRes);
                return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to create Practice Better client record' }) };
            }

            pbRecordId = createRes.data.id;
            isNewClient = true;

            // 4. Store mapping
            await supabaseRequest('POST', '/rest/v1/pb_client_map', {
                athlete_id: athlete_id,
                pb_record_id: pbRecordId,
                pb_consultant_id: consultantId
            });

            // 5. Send intake form if configured
            if (practitioner.pb_intake_form_id) {
                try {
                    await pbApiRequest('POST', '/consultant/formrequests', token, {
                        formId: practitioner.pb_intake_form_id,
                        records: { ids: [pbRecordId] }
                    });
                } catch (formErr) {
                    console.error('Failed to send intake form (non-blocking):', formErr);
                }
            }
        }

        // 6. Book session in Practice Better
        const sessionRes = await pbApiRequest('POST', '/consultant/sessions', token, {
            clientRecordId: pbRecordId,
            sessionDate: session_date,
            serviceId: serviceId,
            serviceType: 'virtual', // default to virtual/telehealth
            duration: duration,
            asConsultantId: consultantId,
            markConfirmed: true,
            notify: true,
            notes: notes || ''
        });

        if (sessionRes.status !== 200 && sessionRes.status !== 202) {
            console.error('PB book session failed:', sessionRes);
            return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to book session in Practice Better', details: sessionRes.data }) };
        }

        const pbSessionId = sessionRes.data ? sessionRes.data.id : null;

        // 7. Save booking in HomeTeam DB
        const bookingRes = await supabaseRequest('POST', '/rest/v1/bookings', {
            athlete_id: athlete_id,
            practitioner_id: parseInt(practitioner_id),
            offering_name: offering_name || 'Session',
            session_date: session_date.split('T')[0],
            session_time: session_date.includes('T') ? session_date.split('T')[1].substring(0, 5) : '00:00',
            status: 'confirmed',
            notes: notes || '',
            pb_session_id: pbSessionId,
            pb_record_id: pbRecordId
        });

        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({
                success: true,
                booking: bookingRes.data ? bookingRes.data[0] : null,
                pb_session_id: pbSessionId,
                is_new_client: isNewClient,
                message: isNewClient
                    ? 'Booking confirmed! Check your email for an invitation from Practice Better to set up your client portal.'
                    : 'Booking confirmed!'
            })
        };

    } catch (err) {
        console.error('PB book session error:', err);
        return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Failed to process booking' }) };
    }
};
