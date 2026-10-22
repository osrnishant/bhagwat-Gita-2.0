# AI access and grounding release prerequisites

The browser calls same-origin `/api/ask` and `/api/stream` functions. Only these server-side functions attach the backend API key. Access uses one private operator account through HTTP Basic over HTTPS; `/api/session` opens the browser's credential prompt. This is an internal application boundary, not a public multiuser subscription system.

Configure server-only frontend variables: `ARYA_BACKEND_URL`, `ARYA_BACKEND_API_KEY`, `ARYA_OPERATOR_USER`, and a random `ARYA_OPERATOR_PASSWORD` of at least 32 characters. Never put these in `VITE_*` variables. Revoke the former browser-shared key; do not use an exposed value as a rollback key.

The backend requires a key of at least 32 characters by default. Set `API_KEY` to the gateway's new private key and retain `REQUIRE_API_KEY=true`. The explicit development override must not be used in production.

Mount persistent storage and set `USAGE_DB_PATH` to a private file there. `DAILY_REQUEST_LIMIT` defaults to 100 admitted requests per UTC day, including unsuccessful calls. Workers must share that database; deploy one backend replica. This is a request ceiling, not a provider-enforced currency budget; separately set provider spending limits. Requests fail closed if accounting cannot be written.

Grounded answers are buffered and citation-checked before publication. This delays the first answer text. An invalid retry produces an error rather than an unsupported answer. Greetings may stream directly. Citation membership does not prove every claim is correct.

For local development, route through the server functions (for example the hosting provider's local function runtime), rather than Vite's old direct backend proxy. No backend credentials belong in browser builds.

Before production release, establish the actual Railway workspace, plan, existing deployment configuration, volumes, downstream keys, and current incident status. This branch was not deployed to Railway or Vercel. Provider credentials have not been rotated. Use fresh credentials and verify both endpoints, authorization failure, quota exhaustion, provider failure, and SSE error handling with the actual host.

Validation: `python -B -m unittest discover -s bg2-api/tests -v`; `node --test bg2-frontend/tests/*.test.mjs`; `cd bg2-frontend && npm ci --ignore-scripts && npm run build`. Python tests use provider doubles and make no billable calls.
