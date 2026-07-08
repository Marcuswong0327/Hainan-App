-- Align study_loan_applications with app inserts (paper + online forms).
-- Safe to re-run: uses IF NOT EXISTS for every column.

CREATE TABLE IF NOT EXISTS public.study_loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  association TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  age TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '—',
  university TEXT NOT NULL DEFAULT '',
  courses TEXT NOT NULL DEFAULT '',
  admission_date TEXT NOT NULL DEFAULT '',
  expected_graduation_date TEXT NOT NULL DEFAULT '',
  phone_number TEXT NOT NULL DEFAULT '',
  offer_letter_path TEXT,
  ic_front_path TEXT,
  ic_back_path TEXT,
  guarantor_ic_front_path TEXT,
  guarantor_ic_back_path TEXT,
  guarantor_relationship TEXT NOT NULL DEFAULT '',
  guarantor_phone_number TEXT NOT NULL DEFAULT '',
  loan_type TEXT NOT NULL DEFAULT '',
  loan_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_loan_applications ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '—';
ALTER TABLE public.study_loan_applications ADD COLUMN IF NOT EXISTS full_name_zh TEXT;
ALTER TABLE public.study_loan_applications ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'online';
ALTER TABLE public.study_loan_applications ADD COLUMN IF NOT EXISTS extended_form JSONB;
ALTER TABLE public.study_loan_applications ADD COLUMN IF NOT EXISTS total_paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.study_loan_applications ADD COLUMN IF NOT EXISTS payments_made INTEGER NOT NULL DEFAULT 0;

-- Relax/add constraints only when missing (source check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_loan_applications_source_check'
  ) THEN
    ALTER TABLE public.study_loan_applications
      ADD CONSTRAINT study_loan_applications_source_check
      CHECK (source IN ('online', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_loan_applications_status
  ON public.study_loan_applications (status);
CREATE INDEX IF NOT EXISTS idx_study_loan_applications_user_id
  ON public.study_loan_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_study_loan_applications_applied_at
  ON public.study_loan_applications (applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_loan_applications_source
  ON public.study_loan_applications (source);
