-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" VARCHAR(128) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "sales_phase" VARCHAR(32) NOT NULL DEFAULT 'discover',
    "active_question_field" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "session_id" VARCHAR(128) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'new',
    "project_type" VARCHAR(32),
    "business_goal" TEXT,
    "users_and_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requested_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_system" TEXT,
    "current_system_problems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "integrations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "data_sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stack_preference" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budget_text" TEXT,
    "budget_min" DECIMAL(14,2),
    "budget_max" DECIMAL(14,2),
    "budget_currency" VARCHAR(8),
    "timeline_text" TEXT,
    "contact_name" VARCHAR(160),
    "contact_email" VARCHAR(320),
    "contact_company" VARCHAR(200),
    "contact_phone" VARCHAR(64),
    "consent_to_submit" BOOLEAN NOT NULL DEFAULT false,
    "consent_at" TIMESTAMP(3),
    "answered_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_confirmed_summary" TEXT,
    "field_changes" JSONB NOT NULL DEFAULT '[]',
    "submission_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "lead_reference" VARCHAR(80),
    "submission_error" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL,
    "session_id" VARCHAR(128) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_attempts" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "lead_reference" VARCHAR(80) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "delivery_attempts" INTEGER NOT NULL DEFAULT 0,
    "provider_message_id" VARCHAR(240),
    "last_error_code" VARCHAR(80),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "submission_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "submission_attempt_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL DEFAULT 'lead.quote_requested',
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" VARCHAR(160),
    "lease_expires_at" TIMESTAMP(3),
    "provider_message_id" VARCHAR(240),
    "last_error_code" VARCHAR(80),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_session_id_key" ON "leads"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_lead_reference_key" ON "leads"("lead_reference");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "conversation_messages_session_id_created_at_idx" ON "conversation_messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_session_id_sequence_key" ON "conversation_messages"("session_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "submission_attempts_idempotency_key_key" ON "submission_attempts"("idempotency_key");

-- CreateIndex
CREATE INDEX "submission_attempts_lead_id_created_at_idx" ON "submission_attempts"("lead_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_submission_attempt_id_key" ON "notification_outbox"("submission_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_idempotency_key_key" ON "notification_outbox"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_outbox_status_next_attempt_at_idx" ON "notification_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_outbox_status_lease_expires_at_idx" ON "notification_outbox"("status", "lease_expires_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_attempts" ADD CONSTRAINT "submission_attempts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_submission_attempt_id_fkey" FOREIGN KEY ("submission_attempt_id") REFERENCES "submission_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
