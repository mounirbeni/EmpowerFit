# EmpowerFit — Setup & Go-Live Guide

Everything below is configured in the **Netlify** dashboard. The code is already in place;
you just paste a few values and redeploy. Nothing secret ever lives in the repo.

---

## 0. Confirm the site is on Netlify

The questionnaire, contact, and newsletter forms use **Netlify Forms**, and the dashboards +
notifications use **Netlify Functions**. These only work on a Netlify deploy.

- Netlify → **Site settings → Build & deploy → Branch to deploy = `main`**.
- After each push to `main`, Netlify rebuilds automatically.
- Check **Netlify → Forms** — after the first real submission you'll see `questionnaire`,
  `contact`, and `newsletter` listed. If they appear, forms are working. ✅

---

## 1. 🔔 Get notified of every new coaching request

You have two options — use either or both.

### A. Built-in email (easiest, no keys)
Netlify → **Forms → Form notifications → Add notification → Email notification** →
send to `empowerfitwork@gmail.com`. Done. You'll get an email on every submission.

### B. Instant push to Telegram / Discord / Slack (optional)
The function `netlify/functions/submission-created.js` runs automatically on every
submission. Set whichever you want in **Site settings → Environment variables**:

| Channel | Variables |
| --- | --- |
| Telegram | `TELEGRAM_BOT_TOKEN` (from @BotFather) + `TELEGRAM_CHAT_ID` |
| Discord / Slack | `NOTIFY_WEBHOOK_URL` (a channel webhook URL) |

If none are set, it does nothing and never blocks the submission.

---

## 2. 💳 Payments (PayPal) & booking

Open `index.html`, find the **BOOKING & PAYMENTS (PayPal)** script near the bottom, and set
your PayPal.Me username — that's the only required value:

```js
const PAYPAL_ME = 'empowerfit';   // your paypal.me/USERNAME
const CURRENCY  = 'USD';          // matches the prices on the site
const BOOKING_URL = 'https://calendly.com/empowerfit/intro-call'; // optional
```

- **Payments:** get your link at **paypal.me** (PayPal → "PayPal.Me" → claim your username).
  Each plan's **"Get Started"** button automatically opens
  `paypal.com/paypalme/<you>/<amount>USD` with the discounted price already filled in
  (Starter 98.50 · Fit & Focused 198.50 · VIP 348.50). The client confirms and pays — money
  lands in your PayPal. No keys, nothing secret.
- **Booking:** paste a **Calendly** (or similar) link for the "Book a free intro call"
  buttons. Optional.
- Until you set `PAYPAL_ME`, the buttons **fall back gracefully** — "Get Started" opens the
  questionnaire, and "Book a free intro call" opens the contact page.

> PayPal.Me charges are one-off payments. For true monthly **recurring** billing, create
> PayPal **Subscription** buttons instead and I can swap the links in — just say the word.

---

## 3. 🔐 Dashboards (Coach + Client)

- **Coach Login** (`/#admin`) — password-protected; review every request, search & filter.
- **Client Portal** (`/#client`) — a client enters their questionnaire email to see status.

Both are linked in the footer under **Company**. They read submissions through
`netlify/functions/get-submissions.js` (the API token stays server-side).

Add these two secrets in **Site settings → Environment variables**:

| Variable | Where to get it |
| --- | --- |
| `ADMIN_PASSWORD` | Any password you choose (typed on Coach Login). |
| `NETLIFY_API_TOKEN` | Netlify → User settings → Applications → **New access token**. |

> The Site ID (`c956d8d3-5f3c-4063-bcb8-a7926ff88779`) is baked into the function, so you
> don't need `NETLIFY_SITE_ID`. Until the two vars above are set, the dashboards show a
> friendly "not configured yet" message.

---

## ✅ Go-live checklist

1. [ ] Site deploys from `main` on Netlify.
2. [ ] Submit the questionnaire yourself → it appears in **Netlify → Forms**.
3. [ ] Email notification (and/or Telegram/Discord) arrives.
4. [ ] `ADMIN_PASSWORD` + `NETLIFY_API_TOKEN` set → Coach Login loads your test request.
5. [ ] Client Portal loads when you enter the test email.
6. [ ] Stripe Payment Links + Calendly URL pasted (when ready to take money/bookings).
7. [ ] Revoke any access token that was ever shared in chat; generate a fresh one. 🔒

## Notes

- Client lookup is by email only — a lightweight status portal, not a secure account area.
  For real client accounts (passwords, private plans, progress tracking), the next step is
  Netlify Identity or Firebase Auth.
- `netlify dev` runs the functions locally if you have the Netlify CLI + the same env vars.
