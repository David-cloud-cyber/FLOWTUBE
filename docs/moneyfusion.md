# MoneyFusion setup

App name: HuggyFlow

Site URL: https://www.huggyflow.fun

Callback URL: https://www.huggyflow.fun/callback

Logo file: `public/favicon.svg`

Description: to be completed by the client in the MoneyFusion dashboard.

Runtime defaults:

- Checkout URL: `https://pay.moneyfusion.net/HuggyFlow/72cdb377014bd232/pay/`
- Payment currency: `XOF` / Franc CFA by default.
- USD display rate: `1 USD = 600 XOF` by default, override with `MONEYFUSION_USD_XOF_RATE`.

Optional environment variables:

- `MONEYFUSION_CHECKOUT_URL`: payment creation URL from the MoneyFusion/FusionPay dashboard.
- `MONEYFUSION_API_KEY`: optional API key if the dashboard requires Bearer auth.
- `MONEYFUSION_PRIVATE_KEY`: optional MoneyFusion private key if the dashboard uses `moneyfusion-private-key`.
- `MONEYFUSION_CALLBACK_SECRET`: optional shared secret checked on callback requests.
- `MONEYFUSION_CURRENCY`: payment currency, default `XOF`.
- `MONEYFUSION_USD_XOF_RATE` or `MONEYFUSION_USD_RATE`: USD to XOF conversion rate, default `600`.
- `MONEYFUSION_CALLBACK_URL`: optional override, default `https://www.huggyflow.fun/callback`.
- `MONEYFUSION_RETURN_URL`: optional override, default `https://www.huggyflow.fun/?checkout=success`.
- `BILLING_PROVIDER=moneyfusion`: switch checkout from Stripe to MoneyFusion when ready.

Current backend endpoints:

- `POST /api/billing/checkout` with `{ "provider": "moneyfusion" }`
- `GET|POST /callback`
- `GET|POST /api/billing/moneyfusion-callback`
