// =============================================================================
// EmpowerFit - Instant submission notifications (Netlify Function)
// -----------------------------------------------------------------------------
// Netlify automatically runs a function named "submission-created" every time
// one of the site's forms is submitted. This forwards each new coaching request,
// contact message, or newsletter signup to the coach in real time.
//
// This works ALONGSIDE Netlify's built-in email notifications (Site settings >
// Forms > Form notifications). Configure whichever channel you prefer:
//
//   Telegram:  TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//   Discord/Slack/Make/Zapier:  NOTIFY_WEBHOOK_URL
//
// If none are set, this function does nothing (and never blocks the submission).
// =============================================================================

const FORM_TITLES = {
    questionnaire: '🎯 New Coaching Request',
    contact: '✉️ New Contact Message',
    newsletter: '📩 New Newsletter Signup'
};

exports.handler = async (event) => {
    let payload;
    try {
        payload = JSON.parse(event.body || '{}').payload || {};
    } catch (e) {
        return { statusCode: 400, body: 'Bad payload' };
    }

    const formName = payload.form_name || 'submission';
    const data = payload.data || {};

    const name = data.firstName
        ? `${data.firstName} ${data.lastName || ''}`.trim()
        : (data.name || data.email || 'Someone');

    const details = Object.keys(data)
        .filter((k) => k !== 'form-name' && data[k])
        .map((k) => {
            const v = Array.isArray(data[k]) ? data[k].join(', ') : data[k];
            return `• ${k}: ${v}`;
        })
        .join('\n');

    const title = FORM_TITLES[formName] || '📥 New Submission';
    const message = `${title}\nFrom: ${name}\n` + (data.email ? `Email: ${data.email}\n` : '') + `\n${details}`;

    const tasks = [];

    // --- Telegram ---
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        tasks.push(
            fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: message })
            })
        );
    }

    // --- Generic webhook (Discord uses `content`, Slack uses `text`) ---
    if (process.env.NOTIFY_WEBHOOK_URL) {
        tasks.push(
            fetch(process.env.NOTIFY_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: message, text: message })
            })
        );
    }

    try {
        await Promise.allSettled(tasks);
    } catch (e) {
        console.error('Notification error:', e);
    }

    // Always succeed so the submission itself is never affected.
    return { statusCode: 200, body: 'ok' };
};
