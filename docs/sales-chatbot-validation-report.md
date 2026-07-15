# WebNexus Sales Chatbot Validation Report

Date: 2026-07-15

## Outcome

Application-level sales logic and the PostgreSQL persistence/outbox vertical slice pass the automated critical-path gate. Production release remains blocked on deployed database operations, worker supervision/alerting, distributed rate limiting, retention/administration controls, and deployed load/recovery tests.

The two supplied testing-matrix attachments were byte-for-byte identical. One copy was used as the test contract.

## Automated verification

| Gate | Result |
| --- | --- |
| Full Node test suite | 62 passing, 0 failing |
| ESLint | Passing |
| TypeScript (`tsc --noEmit`) | Passing |
| Next.js production build | Passing |
| API routes built | `/api/chat`, `/api/leads` |
| Local security dependency audit | 5 moderate, 0 high/critical |

Critical automated coverage includes:

- ERP, MERN/web app, AI/PDF assistant, dashboard, and app-rescue discovery.
- Explicit project replacement, AI removal, feature removal, and topic isolation.
- Active-field mapping for roles, features, current system, integrations, imports, timeline, budget, contact details, quote review, and consent.
- Shorthand and input variation including `5k USD`, `3 mnths`, Roman Urdu, spelling mistakes, `none`, and `I don't know`.
- Pricing bypasses knowledge retrieval.
- Factual questions preserve lead state and use the knowledge boundary.
- Quote-summary permission is separate from final submission consent.
- No submission without explicit consent; success/failure wording follows notifier results.
- Duplicate submission is idempotent.
- Separate sessions remain isolated; same-session concurrent turns are serialized.
- Server-owned sessions, safe malformed JSON handling, and query-size limits.
- Submitted conversations remain terminal and preserve their reference.
- PostgreSQL reconstruction preserves the session, active question, corrections, and ordered transcript.
- Database advisory locking and serializable retry prevent lost same-session updates across managers.
- Submission rollback leaves no consent, transcript, attempt, outbox, or success-message residue.
- Unique submission and outbox keys make duplicate quote requests idempotent.
- Retryable provider failures, expired claims, restart recovery, and post-acceptance worker crashes recover through the same provider idempotency key.
- Successful delivery persists the provider message ID; permanent or exhausted delivery failures become terminal outbox rows.

## Local performance sample

These measurements use the in-memory repository and local PDF index. They are not deployed production latency measurements.

| Operation | Samples | p50 | p95 | p99 | Matrix target p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Social/template turn | 500 | 0.08 ms | 0.21 ms | 1.67 ms | 250 ms |
| Lead update | 500 | 0.08 ms | 0.23 ms | 2.57 ms | 350 ms |
| Warm local retrieval | 100 | 1.29 ms | 2.97 ms | 8.16 ms | 400 ms |

The concurrent API smoke test completed 100 fresh-session requests in 87.65 ms with 0 errors.

## Security audit note

`npm audit --omit=dev --audit-level=high` reports five moderate advisories: PostCSS through the installed Next.js tree and `@hono/node-server` through Prisma CLI tooling. The suggested forced remediations downgrade Next.js or Prisma across major versions, so they were not applied. No high or critical advisories were reported; re-evaluate when compatible patched releases are available.

## Production gates not yet verifiable

- Production PostgreSQL provisioning, TLS policy, backups, point-in-time recovery, migration rollout, monitoring, and restore drills remain deployment responsibilities.
- The outbox worker must be deployed as a supervised process with alerting and dead-letter reconciliation; CRM integration is intentionally not included yet.
- Soft deletion, retention enforcement, consented export/deletion workflows, and an authenticated administration surface are not implemented.
- Rate limiting is not implemented across instances.
- Five-to-thirty-minute load scenarios, traffic bursts, provider slowdown, database slowdown, and a 24-hour soak test require deployed infrastructure.
- RAG Recall@5, Precision@3, MRR, and grounded-answer rate require a labeled evaluation dataset.
- LLM token/cost/streaming metrics do not apply to deterministic turns and require the configured external generator for generated turns.

## Commands executed

```text
npm test
npm run lint
npx tsc --noEmit
npm audit --omit=dev --audit-level=high
npm run build
```
