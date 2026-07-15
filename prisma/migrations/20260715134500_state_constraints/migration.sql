ALTER TABLE "chat_sessions"
  ADD CONSTRAINT "chat_sessions_sales_phase_check"
    CHECK ("sales_phase" IN ('discover', 'qualify', 'scope', 'quote_request', 'contact_capture', 'submitted')),
  ADD CONSTRAINT "chat_sessions_active_question_field_check"
    CHECK (
      "active_question_field" IS NULL OR
      "active_question_field" IN (
        'projectType', 'businessGoal', 'usersAndRoles', 'requestedFeatures',
        'currentSystem', 'currentSystemProblems', 'integrations', 'dataSources',
        'stackPreference', 'timelineText', 'budgetText', 'quoteReview',
        'contactName', 'contactEmail', 'consent'
      )
    );

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_status_check"
    CHECK ("status" IN ('new', 'in_progress', 'qualified', 'awaiting_contact', 'ready_to_submit', 'submitted', 'submission_failed')),
  ADD CONSTRAINT "leads_project_type_check"
    CHECK ("project_type" IS NULL OR "project_type" IN ('erp', 'web_app', 'ai_assistant', 'app_rescue', 'api_backend', 'dashboard', 'other')),
  ADD CONSTRAINT "leads_consent_timestamp_check"
    CHECK (NOT "consent_to_submit" OR "consent_at" IS NOT NULL),
  ADD CONSTRAINT "leads_submission_attempt_count_check"
    CHECK ("submission_attempt_count" >= 0);

ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_role_check"
    CHECK ("role" IN ('user', 'assistant')),
  ADD CONSTRAINT "conversation_messages_sequence_check"
    CHECK ("sequence" > 0);

ALTER TABLE "submission_attempts"
  ADD CONSTRAINT "submission_attempts_status_check"
    CHECK ("status" IN ('pending', 'processing', 'retry', 'delivered', 'permanent_failure')),
  ADD CONSTRAINT "submission_attempts_delivery_attempts_check"
    CHECK ("delivery_attempts" >= 0);

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_status_check"
    CHECK ("status" IN ('pending', 'processing', 'retry', 'delivered', 'dead')),
  ADD CONSTRAINT "notification_outbox_attempts_check"
    CHECK ("attempts" >= 0 AND "max_attempts" > 0 AND "attempts" <= "max_attempts");
