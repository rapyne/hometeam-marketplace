// HomeTeam — Email Notification via Resend API
// Netlify Serverless Function

const https = require('https');

const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://hometeammarketplace.netlify.app';

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return false;
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) return true;
    return false;
}

function sanitize(str, maxLength = 500) {
    if (typeof str !== 'string') return '';
    return str.slice(0, maxLength).replace(/[<>]/g, '');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function callResendAPI(apiKey, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'api.resend.com',
            port: 443,
            path: '/emails',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
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
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });
        req.write(data);
        req.end();
    });
}

exports.handler = async function(event, context) {
    const origin = event.headers.origin || event.headers.Origin || '';
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Rate limiting
    const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (isRateLimited(clientIp)) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests.' }) };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        // Silently succeed if no email service configured - email is optional
        return { statusCode: 200, headers, body: JSON.stringify({ message: 'Email service not configured, notification skipped.' }) };
    }

    try {
        const { recipientEmail, recipientName, senderName, messagePreview, conversationUrl } = JSON.parse(event.body);

        if (!recipientEmail || !isValidEmail(recipientEmail)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid recipient email.' }) };
        }

        const safeName = sanitize(recipientName, 100);
        const safeSender = sanitize(senderName, 100);
        const safePreview = sanitize(messagePreview, 200);
        const safeUrl = sanitize(conversationUrl, 200);

        const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #1a1a2e; margin: 0;">HomeTeam</h2>
                </div>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 24px;">
                    <p style="color: #1a1a2e; font-size: 16px; margin: 0 0 12px;">
                        Hi ${safeName},
                    </p>
                    <p style="color: #4a4a5a; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
                        <strong>${safeSender}</strong> sent you a new message on HomeTeam:
                    </p>
                    <div style="background: white; border-left: 3px solid #2f5dff; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                        <p style="color: #4a4a5a; font-size: 14px; margin: 0; font-style: italic;">
                            "${safePreview}${safePreview.length >= 200 ? '...' : ''}"
                        </p>
                    </div>
                    <a href="${safeUrl}" style="display: inline-block; background: #2f5dff; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                        Reply on HomeTeam
                    </a>
                </div>
                <p style="color: #9a9ab0; font-size: 12px; text-align: center; margin-top: 24px;">
                    You received this email because you have an account on HomeTeam.
                </p>
            </div>
        `;

        const response = await callResendAPI(apiKey, {
            from: 'HomeTeam <notifications@hometeammarketplace.netlify.app>',
            to: [recipientEmail],
            subject: `New message from ${safeSender} on HomeTeam`,
            html: emailHtml
        });

        if (response.statusCode >= 200 && response.statusCode < 300) {
            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Notification sent.' }) };
        } else {
            console.error('Resend API error:', response.statusCode, response.body);
            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Notification delivery attempted.' }) };
        }

    } catch (err) {
        console.error('Notification error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ message: 'Notification processing completed.' }) };
    }
};
