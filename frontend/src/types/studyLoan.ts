export type StudyLoanStatus = 'pending' | 'approved' | 'rejected';

/** How the application entered the system */
export type StudyLoanApplicationSource = 'online' | 'manual';

/** Paper form variant — one PDF per loan type */
export type StudyLoanFormVariant = 'degree' | 'tvet_vocational' | 'master' | 'phd';

export type StudyLoanBachelorHonors = '' | '1st' | '2nd_upper' | '2nd_lower' | '3rd' | 'general';

export const STUDY_LOAN_FORM_META: Record<
  StudyLoanFormVariant,
  { formCode: string; titleZh: string; titleEn: string; annualAmount: number }
> = {
  degree: {
    formCode: 'SFSL/F/Rev:0',
    titleZh: '大学奖贷学金申请表格',
    titleEn: 'Application Form for University Scholarship Fund & Study Loan',
    annualAmount: 4000,
  },
  tvet_vocational: {
    formCode: 'TVSL',
    titleZh: '技职学院贷学金申请表格',
    titleEn: 'Application Form for Technical & Vocational School Study Loan',
    annualAmount: 4000,
  },
  master: {
    formCode: 'MDSL/F/Rev:1',
    titleZh: '硕士学位贷学金申请表格',
    titleEn: "Master's Degree Study Loan Application Form",
    annualAmount: 6000,
  },
  phd: {
    formCode: 'Ph.DSLF/Rev:1',
    titleZh: '博士学位贷学金申请表格',
    titleEn: 'Ph. D Degree Study Loan Application Form',
    annualAmount: 6000,
  },
};

/** SFSL/F/Rev:0 paper form — stored as JSON on manual entries */
export interface StudyLoanSiblingRow {
  name: string;
  age: string;
  married: boolean;
  school_or_occupation: string;
  standard_or_income: string;
  remarks: string;
  /** Postgraduate forms — scholarship total (RM) */
  scholarship_total?: string;
  /** Postgraduate forms — study loan total (RM) */
  study_loan_total?: string;
}

export interface StudyLoanSchoolActivityRow {
  year: string;
  form: string;
  organization: string;
  post_achievement: string;
}

export interface StudyLoanOutsideActivityRow {
  activity: string;
  post_achievement: string;
  level: '' | 'N' | 'S' | 'D' | 'Sch' | 'T';
}

export interface StudyLoanParentInfo {
  name_zh: string;
  name_en: string;
  age: string;
  company_address_tel: string;
  occupation: string;
  monthly_income: string;
  yearly_fees: string;
  died_year: string;
  tel: string;
  remark: string;
}

export interface StudyLoanPaperFormData {
  form_variant?: StudyLoanFormVariant;
  form_code?: string;
  application_batch: string;
  application_serial: string;
  application_date: string;
  sex: string;
  ic_number: string;
  birth_place_date: string;
  birth_place?: string;
  postal_address: string;
  tel: string;
  fax: string;
  former_school: string;
  faculty: string;
  study_year: string;
  course_duration_years: string;
  /** TVET: academy / institute name */
  academy_name?: string;
  course_fees?: string;
  /** TVET: applicant employment */
  occupation?: string;
  monthly_income_applicant?: string;
  company_name?: string;
  year_of_service?: string;
  /** Postgraduate: bachelor graduating university */
  graduating_university?: string;
  bachelor_honors?: StudyLoanBachelorHonors;
  current_program?: string;
  program_year?: string;
  master_completion_year?: string;
  phd_completion_year?: string;
  phd_completion_year_first_class?: string;
  master_degree_program?: string;
  phd_program_course?: string;
  spouse_name?: string;
  spouse_occupation?: string;
  spouse_monthly_income?: string;
  spouse_tel?: string;
  exam_results: {
    stpm: boolean;
    gce_a_level: boolean;
    uec: boolean;
    spm: boolean;
    matriculation: boolean;
    diploma: boolean;
    recent_university: boolean;
    pmr?: boolean;
    others?: boolean;
    others_specify?: string;
  };
  documents_attached: {
    admission_letter: boolean;
    school_testimonial: boolean;
    co_curriculum_docs: boolean;
    ic_photocopy: boolean;
    passport_photos?: boolean;
    employer_recommendation?: boolean;
  };
  father: StudyLoanParentInfo;
  mother: StudyLoanParentInfo;
  other_scholarship_org1: string;
  other_scholarship_org2: string;
  other_scholarship_total: string;
  other_scholarship_scholarship_total?: string;
  other_scholarship_loan_total?: string;
  siblings: StudyLoanSiblingRow[];
  school_activities: StudyLoanSchoolActivityRow[];
  outside_activities: StudyLoanOutsideActivityRow[];
  applicant_signature_date: string;
  parent_signature_date: string;
  affiliate: {
    applicant_is_member: boolean;
    applicant_membership_no: string;
    applicant_admission_date: string;
    father_is_member: boolean;
    father_membership_no: string;
    father_admission_date: string;
    mother_is_member: boolean;
    mother_membership_no: string;
    mother_admission_date: string;
    post_affiliate_current: string;
    post_affiliate_previous: string;
    post_affiliate_year: string;
    post_federation_current: string;
    post_federation_previous: string;
    post_federation_year: string;
    post_youth_current: string;
    post_youth_previous: string;
    post_youth_year: string;
    post_women_current: string;
    post_women_previous: string;
    post_women_year: string;
    president_signature_date: string;
    financial_assessment: string;
    participation_assessment: string;
    committee_signature_date: string;
  };
  /** Mirror of top-level applicant columns — full paper-form snapshot in JSONB */
  applicant_snapshot?: {
    association: string;
    full_name_en: string;
    full_name_zh: string;
    age: string;
    email: string;
    university: string;
    courses: string;
    admission_date: string;
    expected_graduation_date: string;
    phone_number: string;
    loan_type: string;
    loan_amount: number;
  };
  /** Storage paths for optional uploads (also on table columns where applicable) */
  uploaded_files?: {
    offer_letter_path: string | null;
    ic_front_path: string | null;
    ic_back_path: string | null;
    school_testimonial_path: string | null;
    co_curriculum_path: string | null;
    affiliate_seal_path: string | null;
    employer_recommendation_path: string | null;
  };
}

export const EMPTY_PARENT: StudyLoanParentInfo = {
  name_zh: '',
  name_en: '',
  age: '',
  company_address_tel: '',
  occupation: '',
  monthly_income: '',
  yearly_fees: '',
  died_year: '',
  tel: '',
  remark: '',
};

export const EMPTY_PAPER_FORM: StudyLoanPaperFormData = {
  application_batch: '',
  application_serial: '',
  application_date: '',
  sex: '',
  ic_number: '',
  birth_place_date: '',
  postal_address: '',
  tel: '',
  fax: '',
  former_school: '',
  faculty: '',
  study_year: '',
  course_duration_years: '',
  exam_results: {
    stpm: false,
    gce_a_level: false,
    uec: false,
    spm: false,
    matriculation: false,
    diploma: false,
    recent_university: false,
    pmr: false,
    others: false,
    others_specify: '',
  },
  documents_attached: {
    admission_letter: false,
    school_testimonial: false,
    co_curriculum_docs: false,
    ic_photocopy: false,
    passport_photos: false,
    employer_recommendation: false,
  },
  father: { ...EMPTY_PARENT },
  mother: { ...EMPTY_PARENT },
  other_scholarship_org1: '',
  other_scholarship_org2: '',
  other_scholarship_total: '',
  siblings: [],
  school_activities: [],
  outside_activities: [],
  applicant_signature_date: '',
  parent_signature_date: '',
  affiliate: {
    applicant_is_member: false,
    applicant_membership_no: '',
    applicant_admission_date: '',
    father_is_member: false,
    father_membership_no: '',
    father_admission_date: '',
    mother_is_member: false,
    mother_membership_no: '',
    mother_admission_date: '',
    post_affiliate_current: '',
    post_affiliate_previous: '',
    post_affiliate_year: '',
    post_federation_current: '',
    post_federation_previous: '',
    post_federation_year: '',
    post_youth_current: '',
    post_youth_previous: '',
    post_youth_year: '',
    post_women_current: '',
    post_women_previous: '',
    post_women_year: '',
    president_signature_date: '',
    financial_assessment: '',
    participation_assessment: '',
    committee_signature_date: '',
  },
};

export interface StudyLoanApplication {
  id: string;
  user_id: string;
  association: string;
  full_name: string;
  full_name_zh?: string | null;
  age: string;
  email: string;
  university: string;
  courses: string;
  admission_date: string;
  expected_graduation_date: string;
  phone_number: string;
  offer_letter_path: string | null;
  ic_front_path: string | null;
  ic_back_path: string | null;
  guarantor_ic_front_path: string | null;
  guarantor_ic_back_path: string | null;
  guarantor_relationship: string;
  guarantor_phone_number: string;
  loan_type: string;
  loan_amount: number;
  status: StudyLoanStatus;
  source: StudyLoanApplicationSource;
  extended_form: StudyLoanPaperFormData | null;
  applied_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  total_paid?: number;
  payments_made?: number;
}

/** Sentinel user_id for super-admin paper-form entries (no linked app account). */
export const MANUAL_STUDY_LOAN_USER_ID = 'manual';

export const STUDY_LOAN_BUCKET = 'study-loan-documents';

/** One row per student; linked from `study_loan_recipients.id` */
export interface GuarantorRow {
  id: string;
  student_id: string;
  guarantor_1_zh: string | null;
  guarantor_1_en: string | null;
  guarantor_1_ic: string | null;
  guarantor_1_address: string | null;
  guarantor_1_sign_date: string | null;
  guarantor_2_zh: string | null;
  guarantor_2_en: string | null;
  guarantor_2_ic: string | null;
  guarantor_2_address: string | null;
  guarantor_2_sign_date: string | null;
  guarantor_2_age: number | null;
  guarantor_info_pic: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Manually entered student who received a study loan (Super Admin “Add student”) */
export interface LoanRecipient {
  id: string;
  full_name_en: string;
  full_name_zh: string | null;
  loan_type: string | null;
  email: string;
  phone_number: string;
  association: string;
  university: string;
  course: string;
  admission_date: string;
  expected_graduation_date: string;
  loan_amount: number;
  total_paid: number;
  status: 'active' | 'completed';
  offer_letter_path: string | null;
  student_ic_front_back_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from `guarantors` (one row per student); null if not yet created */
  guarantor: GuarantorRow | null;
}

/** Row payload for insert/upsert into `guarantors` (no id/timestamps) */
export type GuarantorInsert = Omit<GuarantorRow, 'id' | 'created_at' | 'updated_at'>;

/** Recipient row without joined guarantor (used when saving from Add student) */
export type LoanRecipientCore = Omit<LoanRecipient, 'guarantor'>;

export const MONTHLY_PAYMENTS = 20;
