# Smash Karo Web API

An independent Node service in `BadmintonApp/web-api`. The API uses the Java access token for identity and forwards tournament writes and staging court holds to the configured Java service. Its database objects live in the `smashkaro_web` schema.

## Routes

Except for the signed gateway webhook, requests use a Java bearer token. POST/PATCH bodies are JSON.

| Method | Web endpoint | Body or response |
| --- | --- | --- |
| POST | `/api/web/v1/push/subscriptions` | Browser PushSubscription JSON. Returns `subscriptionId`. |
| DELETE | `/api/web/v1/push/subscriptions/{subscriptionId}` | Disables the signed-in user's subscription. |
| POST | `/api/web/v1/court-bookings/checkouts` | Java booking quote selection, `quotedAmount`, `paymentOption`, `idempotencyKey`. Returns the hold and Razorpay test order. |
| POST | `/api/web/v1/court-bookings/checkouts/{checkoutId}/verify` | Razorpay checkout proof. An empty object can reconcile a previously recorded capture. |
| GET | `/api/web/v1/court-bookings/checkouts/{checkoutId}` | Reads the booking and Razorpay capture status. |
| DELETE | `/api/web/v1/court-bookings/checkouts/{checkoutId}/hold` | Releases a pending unpaid hold. |
| POST | `/api/web/v1/webhooks/razorpay` | Raw `payment.captured` event with `X-Razorpay-Signature`. Records the capture idempotently. |
| PATCH | `/api/web/v1/tournaments/{tournamentId}/categories/{categoryId}/minimum-teams` | `{ "minTeams": 4 }`. |
| DELETE | `/api/web/v1/tournaments/{tournamentId}/categories/{categoryId}` | Removes an unused category through the tournament transaction. |
| POST | `/api/web/v1/tournaments/{tournamentId}/categories/{categoryId}/fixtures` | `{ "format": "KNOCKOUT" }` or `LEAGUE`. Uses the upstream transaction's minimum-team rules. |

## Staging setup

1. Use an isolated staging Java deployment and its PostgreSQL database. Apply `schema.sql` to that staging database. Give the service database role read/write access to the new schema's tables and SELECT on `public.notifications` if Web Push is enabled.
2. Install with `npm ci` from this folder. Set the server environment and run `npm start`. For local development, `node --env-file=.env server.mjs` loads an untracked local env file. Use Node 22 or later.
3. Set the matching `VITE_WEB_*` values from the root `.env.example` and rebuild the React app.

| Environment variable | Value |
| --- | --- |
| `WEB_JAVA_API_ORIGIN` | The HTTPS staging Java origin, or localhost for local testing. |
| `WEB_DATABASE_URL` | Staging PostgreSQL URL. |
| `WEB_ALLOWED_ORIGINS` | Comma-separated origins of the React app. Defaults to `http://localhost:5173`. |
| `PORT` | Defaults to `8788`. |
| `WEB_VAPID_SUBJECT`, `WEB_VAPID_PUBLIC_KEY`, `WEB_VAPID_PRIVATE_KEY` | Browser push credentials. Give the React build only the public key. The server runs its delivery worker when all three are set. |
| `WEB_TOURNAMENTS` | `1` after confirming that the staging Java release and schema support minimum teams, transactional removal and enforcement in fixture generation. |
| `WEB_PAYMENT_MODE` | `razorpay-test` after Java staging is configured for mock booking holds. |
| `WEB_RAZORPAY_KEY_ID`, `WEB_RAZORPAY_KEY_SECRET`, `WEB_RAZORPAY_WEBHOOK_SECRET` | Dedicated test credentials. Send test `payment.captured` events to the web endpoint listed above. |

Web Push sends a generic inbox alert because existing in-app notifications can contain personal details. Inbox data continues to come from the authorized Java notification API.

The test webhook stores a capture without a user session. The authenticated web verification endpoint then uses the Java test-payment action to complete the shared booking transaction. If a player returns after the hold expires, the expired booking remains expired. The test receipt uses Java's mock ledger. Live booking payments require an atomic gateway capture-to-booking integration with the shared occupancy and payment ledger plus staging concurrency validation.

Run `npm test` in this directory to exercise all ten routes and the push worker against embedded PostgreSQL with simulated Java and Razorpay contracts.
