// =============================================================================
// EmpowerFit - Submissions API (Netlify Function)
// -----------------------------------------------------------------------------
// Securely reads form submissions from the Netlify Forms API so the in-site
// Admin and Client dashboards can display them. The Netlify API token never
// leaves the server, so it is safe to use from the public site.
//
// Required environment variables (set in Netlify > Site settings > Environment):
//   ADMIN_PASSWORD      - password the coach types on the Admin login screen
//   NETLIFY_API_TOKEN   - a personal access token (User settings > Applications)
//   NETLIFY_SITE_ID     - this site's API ID (Site settings > General)
// =============================================================================

const NETLIFY_API = 'https://api.netlify.com/api/v1';

const json = (statusCode, payload) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
});

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const TOKEN = process.env.NETLIFY_API_TOKEN;
    const SITE_ID = process.env.NETLIFY_SITE_ID;

    if (!ADMIN_PASSWORD || !TOKEN || !SITE_ID) {
        return json(500, {
            error: 'Dashboard is not configured yet. Set ADMIN_PASSWORD, NETLIFY_API_TOKEN and NETLIFY_SITE_ID in your Netlify environment variables.'
        });
    }

    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return json(400, { error: 'Invalid request.' });
    }

    const password = (body.password || '').toString();
    const email = (body.email || '').toString().trim().toLowerCase();
    const isAdmin = password.length > 0 && password === ADMIN_PASSWORD;

    // Must be either a valid admin, or a client looking up their own email.
    if (!isAdmin) {
        if (password.length > 0) {
            return json(401, { error: 'Incorrect password.' });
        }
        if (!email) {
            return json(401, { error: 'Unauthorized.' });
        }
    }

    // Fetch submissions for the whole site (covers every form).
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

    // Normalise to a small, predictable shape for the front end.
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

    if (isAdmin) {
        return json(200, { role: 'admin', submissions });
    }

    // Client: only ever return rows matching the email they entered.
    const mine = submissions.filter((s) => (s.email || '').toLowerCase() === email);
    return json(200, { role: 'client', submissions: mine });
};
