// HomeTeam — Practice Better OAuth2 Token Management
// Shared helper for PB API functions

const https = require('https');

// In-memory token cache (per function instance)
let cachedToken = null;
let tokenExpiresAt = 0;

function getAccessToken() {
    return new Promise((resolve, reject) => {
        const now = Date.now();

        // Return cached token if still valid (with 60s buffer)
        if (cachedToken && now < tokenExpiresAt - 60000) {
            return resolve(cachedToken);
        }

        const clientId = process.env.PB_CLIENT_ID;
        const clientSecret = process.env.PB_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return reject(new Error('PB_CLIENT_ID and PB_CLIENT_SECRET must be set'));
        }

        const body = `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;

        const options = {
            hostname: 'api.practicebetter.io',
            port: 443,
            path: '/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`PB auth failed: ${res.statusCode} ${data}`));
                    }
                    const parsed = JSON.parse(data);
                    cachedToken = parsed.access_token;
                    tokenExpiresAt = now + (parsed.expires_in * 1000);
                    resolve(cachedToken);
                } catch (e) {
                    reject(new Error('Failed to parse PB token response'));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function pbApiRequest(method, path, token, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.practicebetter.io',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            const bodyStr = JSON.stringify(body);
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 204) {
                    return resolve({ status: 204, data: null });
                }
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// CORS and rate limiting helpers (shared across PB functions)
const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://hometeammarketplace.netlify.app';

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
}

const rateLimitMap = new Map();

function isRateLimited(ip, windowMs = 60000, maxRequests = 10) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return false;
    }
    entry.count++;
    return entry.count > maxRequests;
}

module.exports = { getAccessToken, pbApiRequest, corsHeaders, isRateLimited, ALLOWED_ORIGIN };
