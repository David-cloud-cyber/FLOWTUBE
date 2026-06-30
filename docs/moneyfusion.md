# MoneyFusion setup

App name: HuggyFlow

Site URL: https://www.huggyflow.fun

Callback URL: https://www.huggyflow.fun/callback

Logo file: `public/favicon.svg`

Description: to be completed by the client in the MoneyFusion dashboard.

Required environment variables before activation:

- `MONEYFUSION_CHECKOUT_URL`: payment creation URL from the MoneyFusion/FusionPay dashboard.
- `MONEYFUSION_API_KEY`: optional API key if the dashboard requires Bearer auth.
- `MONEYFUSION_CALLBACK_SECRET`: optional shared secret checked on callback requests.
- `MONEYFUSION_CURRENCY`: payment currency, default `USD`.
- `MONEYFUSION_USD_RATE`: required only when `MONEYFUSION_CURRENCY` is not `USD`.
- `MONEYFUSION_CALLBACK_URL`: optional override, default `https://www.huggyflow.fun/callback`.
- `MONEYFUSION_RETURN_URL`: optional override, default `https://www.huggyflow.fun/?checkout=success`.
- `BILLING_PROVIDER=moneyfusion`: switch checkout from Stripe to MoneyFusion when ready.

Current backend endpoints:

- `POST /api/billing/checkout` with `{ "provider": "moneyfusion", "customerPhone": "..." }`
- `GET|POST /callback`
- `GET|POST /api/billing/moneyfusion-callback`
