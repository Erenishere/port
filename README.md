This is a [Next.js](https://nextjs.org) portfolio for WebNexus.

## WebNexus chatbot

The source of truth is `WebNexus_Website_Chatbot_Knowledge_Base.pdf` in the project root. The server-side `/api/chat` route extracts and indexes the PDF, caches the index until the document changes, and returns page/section citations with grounded answers.

An external answer generator is optional. Configure the private server variable `RAG_API_URL` only when a compatible `POST /chat` service is running. The route sends it the plain visitor `query`, sanitized `history`, `system_context`, and retrieved `context`; if it is unavailable, the local grounded answer is used.

Set `NEXT_PUBLIC_CONTACT_EMAIL` to the business inbox that should receive quote requests. The chat widget opens the visitor's email app with a project-quote subject and the chat history prefilled; the visitor reviews and sends the email themselves.

The current sales-chatbot verification status, local latency measurements, and production release blockers are documented in `docs/sales-chatbot-validation-report.md`.

Run `npm test` to check knowledge retrieval, guardrails, pricing, citations, and follow-up behavior.

### Durable sales leads and notification delivery

PostgreSQL is the canonical store for sales sessions, structured lead state, ordered conversation messages, submission attempts, and notification outbox events. Copy `.env.example` to `.env.local`, set a non-production `DATABASE_URL` for local development, and apply the committed migrations:

```bash
npm run db:migrate
```

`/api/chat` persists each state-changing turn transactionally. `/api/leads` and consent granted in chat create one idempotent submission attempt and outbox event before notification delivery. Run the retry worker as a separately supervised process:

```bash
npm run outbox:worker
```

The webhook receives a stable `Idempotency-Key` header. Configure retry and lease limits with the `LEAD_OUTBOX_*` variables documented in `.env.example`. Do not expose database or provider configuration through `NEXT_PUBLIC_*` variables.

`npm test` migrates and clears only `TEST_DATABASE_URL`. The database name must contain `test`; when the variable is omitted, the runner uses the documented local `webnexus_test` credentials.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# port
