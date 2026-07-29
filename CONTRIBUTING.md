# Contributing

## Local workflow

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Start the application with `npm run dev`.
4. Create a focused branch for the change.
5. Run `npm run typecheck`, `npm test`, and `npm run build`.

## Engineering expectations

- Keep authorization in the API, not only in the interface.
- Validate every externally supplied value.
- Preserve the job state-machine invariants.
- Record security-sensitive mutations in the audit trail.
- Add tests for new states, endpoints, and UI behavior.
- Do not commit `.env`, credentials, real datasets, or model artifacts.

## Commit style

Use short, imperative messages such as:

- `Add worker draining controls`
- `Reject invalid retry transitions`
- `Document PostgreSQL deployment`

## Pull requests

Explain the problem, the chosen design, verification performed, and any remaining
tradeoffs. Screenshots are welcome for interface changes.
