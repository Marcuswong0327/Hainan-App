-- Allow targeting specific loan recipients (not only all/active/completed).

ALTER TABLE public.scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_target_check;

ALTER TABLE public.scheduled_notifications
  ADD COLUMN IF NOT EXISTS recipient_ids TEXT[] DEFAULT NULL;

ALTER TABLE public.scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_target_check
  CHECK (target IN ('all', 'active', 'completed', 'selected'));

COMMENT ON COLUMN public.scheduled_notifications.target IS
  'all | active | completed | selected — selected uses recipient_ids';
COMMENT ON COLUMN public.scheduled_notifications.recipient_ids IS
  'When target=selected, specific study_loan_recipients.id values to notify';
