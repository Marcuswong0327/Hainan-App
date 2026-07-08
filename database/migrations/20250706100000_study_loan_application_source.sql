-- Distinguish online student submissions from super-admin paper-form entries.
-- Both use study_loan_applications; extended PDF fields live in extended_form (JSONB).

ALTER TABLE public.study_loan_applications
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'online'
  CHECK (source IN ('online', 'manual'));

ALTER TABLE public.study_loan_applications
  ADD COLUMN IF NOT EXISTS full_name_zh TEXT;

ALTER TABLE public.study_loan_applications
  ADD COLUMN IF NOT EXISTS extended_form JSONB;

CREATE INDEX IF NOT EXISTS idx_study_loan_applications_source
  ON public.study_loan_applications (source);
