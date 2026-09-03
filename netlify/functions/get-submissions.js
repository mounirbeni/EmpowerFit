// =============================================================================
// EmpowerFit - Submissions API (Netlify Function)
// -----------------------------------------------------------------------------
// Securely reads form submissions from the Netlify Forms API so the in-site
// Admin and Client dashboards can display them. The Netlify API token never
// leaves the server, so it is safe to use from the public site.
//
// Two very different callers share this endpoint:
//
//   COACH  - proves identity with ADMIN_PASSWORD and receives everything.
//   CLIENT - proves identity with the email AND surname she submitted, and
//            receives only the STATUS of her request. Her questionnaire
//            answers (injuries, medications, allergies, age, budget, sleep,
//            stress, habits...) are never sent to the browser, so guessing an
//            email cannot expose anyone's health or financial details.
//
// Required environment variables (set in Netlify > Site settings > Environment):
//   ADMIN_PASSWORD      - password the coach types on the Admin login screen
//   NETLIFY_API_TOKEN   - a personal access token (User settings > Applications)
//   NETLIFY_SITE_ID     - this site's API ID (Site settings > General)
// =============================================================================

const crypto = require('crypto');

const NETLIFY_API = 'https://api.netlify.com/api/v1';

const json = (statusCode, payload) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
});

// -----------------------------------------------------------------------------
// Throttling.
//
// Best effort only: a serverless instance is recycled at will, so this slows a
// guessing attack rather than stopping one. It costs nothing and removes the
// easy case of hammering the endpoint from a single address.
// -----------------------------------------------------------------------------
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = { admin: 8, client: 20 };
const attempts = new Map();

function tooManyAttempts(scope, ip) {
    const key = scope + ':' + ip;
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || now - entry.start > WINDOW_MS) {
        attempts.set(key, { start: now, count: 1 });
        return false;
    }
    entry.count += 1;

    // Keep the map from growing without bound on a long-lived instance.
    if (attempts.size > 5000) {
        for (const [k, v] of attempts) {
            if (now - v.start > WINDOW_MS) attempts.delete(k);
        }
    }
    return entry.count > MAX_ATTEMPTS[scope];
}

function clearAttempts(scope, ip) {
    attempts.delete(scope + ':' + ip);
}

// Comparison that does not leak the password's length or prefix through timing.
function safeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
        // Still do the work, so a wrong length is not measurably faster.
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const TOKEN = process.env.NETLIFY_API_TOKEN;
    // Site ID is not a secret (it's useless without the API token), so it has a
    // baked-in default and can still be overridden by an env var if needed.
    const SITE_ID = process.env.NETLIFY_SITE_ID || 'c956d8d3-5f3c-4063-bcb8-a7926ff88779';

    if (!ADMIN_PASSWORD || !TOKEN) {
        return json(500, {
            error: 'Dashboard is not configured yet. Set ADMIN_PASSWORD and NETLIFY_API_TOKEN in your Netlify environment variables.'
        });
    }

    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return json(400, { error: 'Invalid request.' });
    }

    const headers = event.headers || {};
    const ip = headers['x-nf-client-connection-ip']
        || (headers['x-forwarded-for'] || '').split(',')[0].trim()
        || 'unknown';

    const password = (body.password || '').toString();
    const email = norm(body.email);
    const lastName = norm(body.lastName);
    const wantsAdmin = password.length > 0;

    // ---- Identify the caller before spending a Netlify API call -------------
    if (wantsAdmin) {
        if (tooManyAttempts('admin', ip)) {
            return json(429, { error: 'Too many attempts. Please wait a few minutes and try again.' });
        }
        if (!safeEqual(password, ADMIN_PASSWORD)) {
            return json(401, { error: 'Incorrect password.' });
        }
        clearAttempts('admin', ip);
    } else {
        if (!email || !lastName) {
            return json(400, { error: 'Enter the email address and surname you used on your questionnaire.' });
        }
        if (tooManyAttempts('client', ip)) {
            return json(429, { error: 'Too many attempts. Please wait a few minutes and try again.' });
        }
    }

    // ---- Fetch submissions for the whole site (covers every form) -----------
    let raw;
    try {
        const res = await fetch(`${NETLIFY_API}/sites/${SITE_ID}/submissions?per_page=200`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        if (!res.ok) {
            return json(502, { error: `Could not load submissions (Netlify API responded ${res.status}).` });
        }
        raw = await res.json();
    } catch (e) {
        return json(502, { error: 'Could not reach the Netlify API.' });
    }

    // Normalise to a small, predictable shape.
    const submissions = (Array.isArray(raw) ? raw : []).map((s) => {
        const data = s.data || {};
        return {
            id: s.id,
            form_name: s.form_name || data['form-name'] || 'unknown',
            created_at: s.created_at,
            email: (data.email || s.email || '').toString(),
            data
        };
    });

    // ---- Coach: everything ---------------------------------------------------
    if (wantsAdmin) {
        return json(200, { role: 'admin', submissions });
    }

    // ---- Client: must match BOTH the email and the surname on file -----------
    const mine = submissions.filter((s) => norm(s.email) === email);
    const questionnaire = mine.find(
        (s) => s.form_name === 'questionnaire' && norm(s.data.lastName) === lastName
    );

    if (!questionnaire) {
        // Deliberately identical whether the email is unknown or the surname is
        // wrong, so this endpoint cannot be used to discover who is a client.
        return json(401, { error: 'We could not match those details. Please check the email address and surname you used on your questionnaire.' });
    }

    clearAttempts('client', ip);

    // Status only. No questionnaire answers cross the wire — not her goals,
    // budget, injuries, medications or anything else. If she needs to change an
    // answer she contacts her coach, who has the full record.
    return json(200, {
        role: 'client',
        client: {
            firstName: (questionnaire.data.firstName || '').toString(),
            email: (questionnaire.data.email || '').toString()
        },
        request: {
            created_at: questionnaire.created_at,
            contactMethod: (questionnaire.data['contact-method'] || '').toString()
        },
        // Dates only, so the thread is a receipt rather than a readable inbox.
        messages: mine
            .filter((s) => s.form_name === 'contact')
            .map((s) => ({ created_at: s.created_at }))
    });
};
