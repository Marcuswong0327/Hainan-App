import type { StudyLoanApplication, StudyLoanFormVariant, StudyLoanPaperFormData } from '../types/studyLoan';
import { EMPTY_PAPER_FORM, STUDY_LOAN_FORM_META } from '../types/studyLoan';

export interface PaperFormApplicantFields {
  association: string;
  fullNameEn: string;
  fullNameZh: string;
  age: string;
  email: string;
  university: string;
  courses: string;
  admissionYear: string;
  graduationYear: string;
  phoneNumber: string;
  loanType: StudyLoanFormVariant;
  loanAmount: number;
}

export interface PaperFormUploadPaths {
  offer_letter_path: string | null;
  ic_front_path: string | null;
  ic_back_path: string | null;
  school_testimonial_path: string | null;
  co_curriculum_path: string | null;
  affiliate_seal_path: string | null;
  employer_recommendation_path: string | null;
}

function deepPaperForm(ext: StudyLoanPaperFormData | null | undefined): StudyLoanPaperFormData {
  if (!ext) {
    return {
      ...EMPTY_PAPER_FORM,
      father: { ...EMPTY_PAPER_FORM.father },
      mother: { ...EMPTY_PAPER_FORM.mother },
      affiliate: { ...EMPTY_PAPER_FORM.affiliate },
      exam_results: { ...EMPTY_PAPER_FORM.exam_results },
      documents_attached: { ...EMPTY_PAPER_FORM.documents_attached },
    };
  }
  return {
    ...EMPTY_PAPER_FORM,
    ...ext,
    father: { ...EMPTY_PAPER_FORM.father, ...ext.father },
    mother: { ...EMPTY_PAPER_FORM.mother, ...ext.mother },
    affiliate: { ...EMPTY_PAPER_FORM.affiliate, ...ext.affiliate },
    exam_results: { ...EMPTY_PAPER_FORM.exam_results, ...ext.exam_results },
    documents_attached: { ...EMPTY_PAPER_FORM.documents_attached, ...ext.documents_attached },
    siblings: ext.siblings ?? [],
    school_activities: ext.school_activities ?? [],
    outside_activities: ext.outside_activities ?? [],
  };
}

/** Load an existing admin-filled application into the paper form editor. */
export function hydrateFromStudyLoanApplication(app: StudyLoanApplication) {
  const loanType = (app.extended_form?.form_variant || app.loan_type) as StudyLoanFormVariant;
  const uploads = app.extended_form?.uploaded_files;
  return {
    loanType,
    paper: deepPaperForm(app.extended_form),
    association: app.association,
    fullNameEn: app.full_name,
    fullNameZh: app.full_name_zh || '',
    age: app.age,
    email: app.email === '—' ? '' : app.email,
    university: app.university,
    courses: app.courses,
    admissionYear: app.admission_date || '',
    graduationYear: app.expected_graduation_date || '',
    phoneNumber: app.phone_number,
    existingPaths: {
      offer_letter_path: app.offer_letter_path ?? uploads?.offer_letter_path ?? null,
      ic_front_path: app.ic_front_path ?? uploads?.ic_front_path ?? null,
      ic_back_path: app.ic_back_path ?? uploads?.ic_back_path ?? null,
      school_testimonial_path: app.guarantor_ic_front_path ?? uploads?.school_testimonial_path ?? null,
      co_curriculum_path: uploads?.co_curriculum_path ?? null,
      affiliate_seal_path: uploads?.affiliate_seal_path ?? null,
      employer_recommendation_path: uploads?.employer_recommendation_path ?? null,
    } satisfies PaperFormUploadPaths,
  };
}

/** Normalize paper state so variant-specific fields are populated before save. */
export function normalizePaperBeforeSave(
  paper: StudyLoanPaperFormData,
  applicant: PaperFormApplicantFields,
): StudyLoanPaperFormData {
  const next = { ...paper };

  if (applicant.loanType === 'tvet_vocational') {
    if (!next.academy_name?.trim() && applicant.university.trim()) {
      next.academy_name = applicant.university.trim();
    }
  }
  if (applicant.loanType === 'phd') {
    if (!next.phd_program_course?.trim() && applicant.courses.trim()) {
      next.phd_program_course = applicant.courses.trim();
    }
  }
  if (applicant.loanType === 'master' || applicant.loanType === 'phd') {
    if (!next.program_year?.trim() && next.study_year?.trim()) {
      next.program_year = next.study_year;
    }
  }

  return next;
}

/** Build the full extended_form JSONB payload — every typed field + upload paths. */
export function buildExtendedFormPayload(
  paper: StudyLoanPaperFormData,
  applicant: PaperFormApplicantFields,
  paths: PaperFormUploadPaths,
): StudyLoanPaperFormData {
  const meta = STUDY_LOAN_FORM_META[applicant.loanType];
  const normalized = normalizePaperBeforeSave(paper, applicant);
  const expectedGraduation =
    applicant.graduationYear ||
    normalized.master_completion_year ||
    normalized.phd_completion_year ||
    '';

  return {
    ...normalized,
    form_variant: applicant.loanType,
    form_code: meta.formCode,
    applicant_snapshot: {
      association: applicant.association.trim(),
      full_name_en: applicant.fullNameEn.trim(),
      full_name_zh: applicant.fullNameZh.trim(),
      age: applicant.age.trim(),
      email: applicant.email.trim() || '—',
      university: applicant.university.trim(),
      courses: applicant.courses.trim(),
      admission_date: applicant.admissionYear || normalized.application_date?.slice(0, 4) || '',
      expected_graduation_date: expectedGraduation,
      phone_number: applicant.phoneNumber.trim(),
      loan_type: applicant.loanType,
      loan_amount: applicant.loanAmount,
    },
    uploaded_files: {
      offer_letter_path: paths.offer_letter_path,
      ic_front_path: paths.ic_front_path,
      ic_back_path: paths.ic_back_path,
      school_testimonial_path: paths.school_testimonial_path,
      co_curriculum_path: paths.co_curriculum_path,
      affiliate_seal_path: paths.affiliate_seal_path,
      employer_recommendation_path: paths.employer_recommendation_path,
    },
    documents_attached: {
      ...normalized.documents_attached,
      admission_letter: normalized.documents_attached.admission_letter || !!paths.offer_letter_path,
      school_testimonial: normalized.documents_attached.school_testimonial || !!paths.school_testimonial_path,
      co_curriculum_docs: normalized.documents_attached.co_curriculum_docs || !!paths.co_curriculum_path,
      ic_photocopy: normalized.documents_attached.ic_photocopy || !!(paths.ic_front_path && paths.ic_back_path),
      employer_recommendation:
        normalized.documents_attached.employer_recommendation || !!paths.employer_recommendation_path,
    },
  };
}
