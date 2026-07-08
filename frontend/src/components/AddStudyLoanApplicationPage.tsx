import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import type {
  StudyLoanApplication,
  StudyLoanBachelorHonors,
  StudyLoanFormVariant,
  StudyLoanOutsideActivityRow,
  StudyLoanPaperFormData,
  StudyLoanSchoolActivityRow,
  StudyLoanSiblingRow,
} from '../types/studyLoan';
import {
  EMPTY_PAPER_FORM,
  MANUAL_STUDY_LOAN_USER_ID,
  STUDY_LOAN_BUCKET,
  STUDY_LOAN_FORM_META,
} from '../types/studyLoan';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatMalaysiaMobileDash, isValidMalaysiaMobileDash } from '../lib/malaysiaPhone';
import { validateUploadFile } from '../lib/fileValidation';
import { buildExtendedFormPayload, hydrateFromStudyLoanApplication, type PaperFormUploadPaths } from '../lib/buildPaperFormPayload';
import { AssociationSelect } from './AssociationSelect';

const LOAN_TYPES: Array<{ value: StudyLoanFormVariant; label: string; amount: number }> = [
  { value: 'degree', label: 'Degree (学士)', amount: 4000 },
  { value: 'tvet_vocational', label: 'TVET / Vocational (技职教育)', amount: 4000 },
  { value: 'master', label: 'Master (硕士)', amount: 6000 },
  { value: 'phd', label: 'PhD (博士)', amount: 6000 },
];

type FormSection = 'loan_type' | 'applicant' | 'exams' | 'family' | 'siblings' | 'affiliate' | 'review';

const SECTIONS_BY_TYPE: Record<StudyLoanFormVariant, FormSection[]> = {
  degree: ['loan_type', 'applicant', 'exams', 'family', 'siblings', 'affiliate', 'review'],
  tvet_vocational: ['loan_type', 'applicant', 'exams', 'family', 'affiliate', 'review'],
  master: ['loan_type', 'applicant', 'family', 'affiliate', 'review'],
  phd: ['loan_type', 'applicant', 'family', 'affiliate', 'review'],
};

const SECTION_TITLES: Record<FormSection, string> = {
  loan_type: 'Loan type 贷款类别',
  applicant: '(A) Applicant details 申请人概况',
  exams: 'Exam results & documents 成绩单与文件',
  family: 'Family background 家庭概况',
  siblings: 'Siblings & activities 兄弟姐妹与活动',
  affiliate: '(B) Affiliate report 属会填报',
  review: 'Review & submit 确认提交',
};

const BACHELOR_HONORS_OPTIONS: Array<{ value: StudyLoanBachelorHonors; label: string }> = [
  { value: '1st', label: '一等荣誉 1st Class Honors' },
  { value: '2nd_upper', label: '二等(高级)荣誉 2nd Class (Upper) Honors' },
  { value: '2nd_lower', label: '二等(低级)荣誉 2nd Class (Lower) Honors' },
  { value: '3rd', label: '三等荣誉 3rd Class Honors' },
  { value: 'general', label: '普通文凭 General Degree' },
];

interface AddStudyLoanApplicationPageProps {
  onBack: () => void;
  onSaved: (app: StudyLoanApplication) => void;
  initialApplication?: StudyLoanApplication;
}

const EMPTY_UPLOAD_PATHS: PaperFormUploadPaths = {
  offer_letter_path: null,
  ic_front_path: null,
  ic_back_path: null,
  school_testimonial_path: null,
  co_curriculum_path: null,
  affiliate_seal_path: null,
  employer_recommendation_path: null,
};

function getEditorBootstrap(initialApplication?: StudyLoanApplication) {
  if (!initialApplication) {
    return {
      isEditMode: false as const,
      applicationId: null as string | null,
      preserved: null as {
        applied_at: string;
        reviewed_at: string | null;
        rejection_reason: string | null;
        created_at: string;
        status: StudyLoanApplication['status'];
      } | null,
      step: 1,
      loanType: '' as StudyLoanFormVariant | '',
      paper: freshPaperForm(),
      association: '',
      fullNameEn: '',
      fullNameZh: '',
      age: '',
      email: '',
      university: '',
      courses: '',
      admissionYear: '',
      graduationYear: '',
      phoneNumber: '',
      existingPaths: EMPTY_UPLOAD_PATHS,
    };
  }

  const hydrated = hydrateFromStudyLoanApplication(initialApplication);
  return {
    isEditMode: true as const,
    applicationId: initialApplication.id,
    preserved: {
      applied_at: initialApplication.applied_at,
      reviewed_at: initialApplication.reviewed_at,
      rejection_reason: initialApplication.rejection_reason,
      created_at: initialApplication.created_at,
      status: initialApplication.status,
    },
    step: 2,
    loanType: hydrated.loanType,
    paper: hydrated.paper,
    association: hydrated.association,
    fullNameEn: hydrated.fullNameEn,
    fullNameZh: hydrated.fullNameZh,
    age: hydrated.age,
    email: hydrated.email,
    university: hydrated.university,
    courses: hydrated.courses,
    admissionYear: hydrated.admissionYear,
    graduationYear: hydrated.graduationYear,
    phoneNumber: hydrated.phoneNumber,
    existingPaths: hydrated.existingPaths,
  };
}

function emptySibling(): StudyLoanSiblingRow {
  return { name: '', age: '', married: false, school_or_occupation: '', standard_or_income: '', remarks: '' };
}

function emptySchoolActivity(): StudyLoanSchoolActivityRow {
  return { year: '', form: '', organization: '', post_achievement: '' };
}

function emptyOutsideActivity(): StudyLoanOutsideActivityRow {
  return { activity: '', post_achievement: '', level: '' };
}

function freshPaperForm(): StudyLoanPaperFormData {
  return {
    ...EMPTY_PAPER_FORM,
    father: { ...EMPTY_PAPER_FORM.father },
    mother: { ...EMPTY_PAPER_FORM.mother },
    affiliate: { ...EMPTY_PAPER_FORM.affiliate },
    exam_results: { ...EMPTY_PAPER_FORM.exam_results },
    documents_attached: { ...EMPTY_PAPER_FORM.documents_attached },
  };
}

export function AddStudyLoanApplicationPage({ onBack, onSaved, initialApplication }: AddStudyLoanApplicationPageProps) {
  const bootstrap = useMemo(() => getEditorBootstrap(initialApplication), [initialApplication]);
  const isEditMode = bootstrap.isEditMode;

  const [step, setStep] = useState(bootstrap.step);
  const [submitting, setSubmitting] = useState(false);
  const [loanType, setLoanType] = useState<StudyLoanFormVariant | ''>(bootstrap.loanType);
  const [paper, setPaper] = useState<StudyLoanPaperFormData>(bootstrap.paper);

  const [association, setAssociation] = useState(bootstrap.association);
  const [fullNameEn, setFullNameEn] = useState(bootstrap.fullNameEn);
  const [fullNameZh, setFullNameZh] = useState(bootstrap.fullNameZh);
  const [age, setAge] = useState(bootstrap.age);
  const [email, setEmail] = useState(bootstrap.email);
  const [university, setUniversity] = useState(bootstrap.university);
  const [courses, setCourses] = useState(bootstrap.courses);
  const [admissionYear, setAdmissionYear] = useState(bootstrap.admissionYear);
  const [graduationYear, setGraduationYear] = useState(bootstrap.graduationYear);
  const [phoneNumber, setPhoneNumber] = useState(bootstrap.phoneNumber);
  const [existingPaths] = useState<PaperFormUploadPaths>(bootstrap.existingPaths);

  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
  const [icFrontFile, setIcFrontFile] = useState<File | null>(null);
  const [icBackFile, setIcBackFile] = useState<File | null>(null);
  const [testimonialFile, setTestimonialFile] = useState<File | null>(null);
  const [coCurriculumFile, setCoCurriculumFile] = useState<File | null>(null);
  const [affiliateSealFile, setAffiliateSealFile] = useState<File | null>(null);
  const [employerRecommendationFile, setEmployerRecommendationFile] = useState<File | null>(null);

  const sections = loanType ? SECTIONS_BY_TYPE[loanType] : (['loan_type'] as FormSection[]);
  const currentSection = sections[step - 1] ?? 'loan_type';
  const totalSteps = sections.length;
  const formMeta = loanType ? STUDY_LOAN_FORM_META[loanType] : null;

  const stepTitle = useMemo(() => {
    if (currentSection === 'applicant' && loanType === 'master') {
      return '(A) Applicant & master details 申请人及硕士学业概况';
    }
    if (currentSection === 'applicant' && loanType === 'phd') {
      return '(A) Applicant & PhD details 申请人及博士学业概况';
    }
    if (currentSection === 'applicant' && loanType === 'tvet_vocational') {
      return '(A) Applicant & academy details 申请人及技职学院概况';
    }
    if (currentSection === 'family' && (loanType === 'master' || loanType === 'phd')) {
      return 'Family, spouse & siblings 家庭、配偶及兄弟姐妹';
    }
    return SECTION_TITLES[currentSection];
  }, [currentSection, loanType]);

  const updatePaper = (patch: Partial<StudyLoanPaperFormData>) => setPaper((p) => ({ ...p, ...patch }));

  const sanitizeYear = (raw: string) => raw.replace(/\D/g, '').slice(0, 4);

  const loanAmount = loanType ? (LOAN_TYPES.find((t) => t.value === loanType)?.amount ?? 0) : 0;

  const resetApplicantFields = () => {
    setPaper(freshPaperForm());
    setAssociation('');
    setFullNameEn('');
    setFullNameZh('');
    setAge('');
    setEmail('');
    setUniversity('');
    setCourses('');
    setAdmissionYear('');
    setGraduationYear('');
    setPhoneNumber('');
    setOfferLetterFile(null);
    setIcFrontFile(null);
    setIcBackFile(null);
    setTestimonialFile(null);
    setCoCurriculumFile(null);
    setAffiliateSealFile(null);
    setEmployerRecommendationFile(null);
  };

  const handleLoanTypeChange = (value: StudyLoanFormVariant) => {
    if (isEditMode) return;
    if (loanType && value !== loanType && step > 1) {
      const ok = window.confirm('Changing loan type will clear the form. Continue?');
      if (!ok) return;
      resetApplicantFields();
      setStep(1);
    }
    setLoanType(value);
  };

  const validateApplicant = (): string | null => {
    if (!association) return 'Select the affiliate association.';
    if (!fullNameEn.trim()) return 'English name is required.';
    if (!fullNameZh.trim()) return 'Chinese name (中文姓名) is required.';
    if (!age.trim() || Number.isNaN(parseInt(age, 10))) return 'Enter a valid age.';
    if (!phoneNumber.trim() || !isValidMalaysiaMobileDash(phoneNumber)) {
      return 'Enter a valid Malaysian mobile number (e.g. 011-12345678).';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email or leave it empty.';
    }

    if (loanType === 'degree') {
      if (!university.trim()) return 'University name is required.';
      if (!courses.trim()) return 'Course / faculty is required.';
    }
    if (loanType === 'tvet_vocational') {
      if (!paper.academy_name?.trim() && !university.trim()) return 'Academy name is required.';
      if (!courses.trim()) return 'Course is required.';
    }
    if (loanType === 'master') {
      if (!paper.graduating_university?.trim()) return 'Graduating university (bachelor) is required.';
      if (!university.trim()) return 'Current university (master) is required.';
      if (!courses.trim()) return 'Program / course is required.';
    }
    if (loanType === 'phd') {
      if (!paper.graduating_university?.trim()) return 'Graduating university (bachelor) is required.';
      if (!university.trim()) return 'PhD university is required.';
      if (!paper.phd_program_course?.trim()) return 'PhD program / course is required.';
    }
    return null;
  };

  const validateCurrentStep = (): string | null => {
    if (currentSection === 'loan_type') {
      if (!loanType) return 'Select a loan type to continue.';
      return null;
    }
    if (currentSection === 'applicant') return validateApplicant();
    return null;
  };

  const handleFilePick = (
    file: File | null,
    label: string,
    setter: (f: File | null) => void,
    input?: HTMLInputElement | null,
  ) => {
    if (!file) {
      setter(null);
      return;
    }
    const err = validateUploadFile(file, label);
    if (err) {
      alert(err);
      if (input) input.value = '';
      setter(null);
      return;
    }
    setter(file);
  };

  const handleSubmit = async () => {
    const err = validateApplicant();
    if (err) {
      alert(err);
      const applicantStep = sections.indexOf('applicant') + 1;
      if (applicantStep > 0) setStep(applicantStep);
      return;
    }
    if (!loanType) {
      alert('Select a loan type.');
      setStep(1);
      return;
    }

    const fileChecks: Array<[File | null, string]> = [
      [offerLetterFile, 'Offer letter / admission letter'],
      [icFrontFile, 'IC front'],
      [icBackFile, 'IC back'],
      [testimonialFile, 'School testimonial'],
      [coCurriculumFile, 'Co-curriculum documents'],
      [affiliateSealFile, 'Affiliate seal scan'],
      [employerRecommendationFile, 'Employer recommendation letter'],
    ];
    for (const [file, label] of fileChecks) {
      if (!file) continue;
      const fileError = validateUploadFile(file, label);
      if (fileError) {
        alert(fileError);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (!isSupabaseConfigured() || !supabase) {
        alert(
          'Supabase is not configured. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.',
        );
        return;
      }

      const id = isEditMode ? bootstrap.applicationId! : crypto.randomUUID();
      const now = new Date().toISOString();
      const client = supabase;
      const prefix = `${id}`;
      const uploadWarnings: string[] = [];

      const upload = async (file: File | null, pathKey: string): Promise<string | null> => {
        if (!file) return null;
        const ext = file.name.split('.').pop() || 'bin';
        const path = `${prefix}/${pathKey}.${ext}`;
        const { error } = await client.storage.from(STUDY_LOAN_BUCKET).upload(path, file, { upsert: true });
        if (error) {
          uploadWarnings.push(`${pathKey}: ${error.message}`);
          return null;
        }
        return path;
      };

      const resolvePath = async (
        file: File | null,
        pathKey: string,
        existingKey: keyof PaperFormUploadPaths,
      ): Promise<string | null> => {
        if (file) return upload(file, pathKey);
        return isEditMode ? existingPaths[existingKey] : null;
      };

      const offer_letter_path = await resolvePath(offerLetterFile, 'offer_letter', 'offer_letter_path');
      const ic_front_path = await resolvePath(icFrontFile, 'ic_front', 'ic_front_path');
      const ic_back_path = await resolvePath(icBackFile, 'ic_back', 'ic_back_path');
      const school_testimonial_path = await resolvePath(testimonialFile, 'school_testimonial', 'school_testimonial_path');
      const co_curriculum_path = await resolvePath(coCurriculumFile, 'co_curriculum', 'co_curriculum_path');
      const affiliate_seal_path = await resolvePath(affiliateSealFile, 'affiliate_seal', 'affiliate_seal_path');
      const employer_recommendation_path = await resolvePath(
        employerRecommendationFile,
        'employer_recommendation',
        'employer_recommendation_path',
      );

      const applicantFields = {
        association,
        fullNameEn,
        fullNameZh,
        age,
        email,
        university,
        courses,
        admissionYear,
        graduationYear,
        phoneNumber,
        loanType,
        loanAmount,
      };

      const extended = buildExtendedFormPayload(paper, applicantFields, {
        offer_letter_path,
        ic_front_path,
        ic_back_path,
        school_testimonial_path,
        co_curriculum_path,
        affiliate_seal_path,
        employer_recommendation_path,
      });

      const expectedGraduation =
        graduationYear || paper.master_completion_year || paper.phd_completion_year || '';

      const rowPayload = {
        association: association.trim(),
        full_name: fullNameEn.trim(),
        full_name_zh: fullNameZh.trim() || null,
        age: age.trim(),
        email: email.trim() || '—',
        university: university.trim(),
        courses: courses.trim(),
        admission_date: admissionYear || paper.application_date?.slice(0, 4) || '',
        expected_graduation_date: expectedGraduation,
        phone_number: phoneNumber.trim(),
        offer_letter_path,
        ic_front_path,
        ic_back_path,
        guarantor_ic_front_path: school_testimonial_path,
        guarantor_ic_back_path: null,
        guarantor_relationship: 'paper_form',
        guarantor_phone_number: '—',
        loan_type: loanType,
        loan_amount: loanAmount,
        source: 'manual' as const,
        extended_form: extended,
        updated_at: now,
      };

      const { error } = isEditMode
        ? await client
            .from('study_loan_applications')
            .update({
              ...rowPayload,
              status: bootstrap.preserved!.status,
              applied_at: bootstrap.preserved!.applied_at,
              reviewed_at: bootstrap.preserved!.reviewed_at,
              rejection_reason: bootstrap.preserved!.rejection_reason,
            })
            .eq('id', id)
        : await client.from('study_loan_applications').insert({
            id,
            user_id: MANUAL_STUDY_LOAN_USER_ID,
            ...rowPayload,
            status: 'pending',
            applied_at: now,
            created_at: now,
          });

      if (error) {
        throw new Error(error.message || `Failed to ${isEditMode ? 'update' : 'save'} paper application to Supabase.`);
      }

      const saved: StudyLoanApplication = {
        id,
        user_id: MANUAL_STUDY_LOAN_USER_ID,
        association: association.trim(),
        full_name: fullNameEn.trim(),
        full_name_zh: fullNameZh.trim(),
        age: age.trim(),
        email: email.trim() || '—',
        university: university.trim(),
        courses: courses.trim(),
        admission_date: admissionYear || '',
        expected_graduation_date: expectedGraduation,
        phone_number: phoneNumber.trim(),
        offer_letter_path,
        ic_front_path,
        ic_back_path,
        guarantor_ic_front_path: school_testimonial_path,
        guarantor_ic_back_path: null,
        guarantor_relationship: 'paper_form',
        guarantor_phone_number: '—',
        loan_type: loanType,
        loan_amount: loanAmount,
        status: isEditMode ? bootstrap.preserved!.status : 'pending',
        source: 'manual',
        extended_form: extended,
        applied_at: isEditMode ? bootstrap.preserved!.applied_at : now,
        reviewed_at: isEditMode ? bootstrap.preserved!.reviewed_at : null,
        rejection_reason: isEditMode ? bootstrap.preserved!.rejection_reason : null,
        created_at: isEditMode ? bootstrap.preserved!.created_at : now,
        updated_at: now,
      };

      if (uploadWarnings.length > 0) {
        alert(
          `Application ${isEditMode ? 'updated' : 'saved'} in Supabase.\n\nSome file uploads could not be stored (text data was saved):\n${uploadWarnings.join('\n')}`,
        );
      }

      onSaved(saved);
      onBack();
      return;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save paper application.';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const ExamCheckbox = ({
    id,
    label,
    checked,
    onChange,
  }: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{label}</span>
    </label>
  );

  const renderBatchSerial = () =>
    loanType === 'degree' ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>第 期 Batch</Label>
          <Input value={paper.application_batch} onChange={(e) => updatePaper({ application_batch: e.target.value })} placeholder="e.g. 1" />
        </div>
        <div className="space-y-2">
          <Label>列号 Serial</Label>
          <Input value={paper.application_serial} onChange={(e) => updatePaper({ application_serial: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>日期 Date</Label>
          <Input type="date" value={paper.application_date} onChange={(e) => updatePaper({ application_date: e.target.value })} />
        </div>
      </div>
    ) : (
      <div className="space-y-2">
        <Label>日期 Date</Label>
        <Input type="date" value={paper.application_date} onChange={(e) => updatePaper({ application_date: e.target.value })} />
      </div>
    );

  const renderApplicantCommon = () => (
    <>
      {renderBatchSerial()}
      <AssociationSelect value={association} onChange={setAssociation} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>姓名（中文） *</Label>
          <Input value={fullNameZh} onChange={(e) => setFullNameZh(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Name (English) *</Label>
          <Input value={fullNameEn} onChange={(e) => setFullNameEn(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>性别 Sex</Label>
          <Select value={paper.sex || undefined} onValueChange={(v) => updatePaper({ sex: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male 男</SelectItem>
              <SelectItem value="female">Female 女</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>年龄 Age *</Label>
          <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>身份证号码 I.C. No.</Label>
          <Input value={paper.ic_number} onChange={(e) => updatePaper({ ic_number: e.target.value })} />
        </div>
      </div>
      {(loanType === 'master' || loanType === 'phd') && (
        <div className="space-y-2">
          <Label>出生地点 Place of Birth</Label>
          <Input value={paper.birth_place || ''} onChange={(e) => updatePaper({ birth_place: e.target.value })} />
        </div>
      )}
      <div className="space-y-2">
        <Label>出生地点／日期 Place/Date of Birth</Label>
        <Input value={paper.birth_place_date} onChange={(e) => updatePaper({ birth_place_date: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>通讯处 Postal address</Label>
        <Textarea rows={2} value={paper.postal_address} onChange={(e) => updatePaper({ postal_address: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>手机 H/P *</Label>
          <Input value={phoneNumber} onChange={(e) => setPhoneNumber(formatMalaysiaMobileDash(e.target.value))} placeholder="011-12345678" />
        </div>
        <div className="space-y-2">
          <Label>电话 Tel.</Label>
          <Input value={paper.tel} onChange={(e) => updatePaper({ tel: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>传真 Fax</Label>
          <Input value={paper.fax} onChange={(e) => updatePaper({ fax: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Email {loanType === 'degree' || loanType === 'tvet_vocational' ? '(optional)' : ''}</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
    </>
  );

  const renderDegreeApplicant = () => (
    <>
      {renderApplicantCommon()}
      <div className="space-y-2">
        <Label>毕业之学校 Former school</Label>
        <Input value={paper.former_school} onChange={(e) => updatePaper({ former_school: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>考进大学 University *</Label>
          <Input value={university} onChange={(e) => setUniversity(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>院名 Faculty</Label>
          <Input value={paper.faculty} onChange={(e) => updatePaper({ faculty: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>系名 Course *</Label>
          <Input value={courses} onChange={(e) => setCourses(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>年级 Year</Label>
          <Input value={paper.study_year} onChange={(e) => updatePaper({ study_year: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>入学年 Admission year</Label>
          <Input inputMode="numeric" maxLength={4} value={admissionYear} onChange={(e) => setAdmissionYear(sanitizeYear(e.target.value))} placeholder="2024" />
        </div>
        <div className="space-y-2">
          <Label>学程年制 Duration (years)</Label>
          <Input inputMode="numeric" value={paper.course_duration_years} onChange={(e) => updatePaper({ course_duration_years: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
        </div>
        <div className="space-y-2">
          <Label>大学毕业年 Graduation year</Label>
          <Input inputMode="numeric" maxLength={4} value={graduationYear} onChange={(e) => setGraduationYear(sanitizeYear(e.target.value))} placeholder="2028" />
        </div>
      </div>
    </>
  );

  const renderTvetApplicant = () => (
    <>
      {renderApplicantCommon()}
      <div className="space-y-2">
        <Label>毕业之学校 Former school</Label>
        <Input value={paper.former_school} onChange={(e) => updatePaper({ former_school: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>学院名称 Academy *</Label>
          <Input
            value={paper.academy_name || university}
            onChange={(e) => {
              updatePaper({ academy_name: e.target.value });
              setUniversity(e.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>科系 Course *</Label>
          <Input value={courses} onChange={(e) => setCourses(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>课程费用 Course fees (RM)</Label>
          <Input value={paper.course_fees || ''} onChange={(e) => updatePaper({ course_fees: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>学程年制 Duration</Label>
          <Input value={paper.course_duration_years} onChange={(e) => updatePaper({ course_duration_years: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>职业 Occupation</Label>
          <Input value={paper.occupation || ''} onChange={(e) => updatePaper({ occupation: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>每月收入 Monthly income (RM)</Label>
          <Input value={paper.monthly_income_applicant || ''} onChange={(e) => updatePaper({ monthly_income_applicant: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>公司名称 Company name</Label>
          <Input value={paper.company_name || ''} onChange={(e) => updatePaper({ company_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>服务年数 Year of service</Label>
          <Input value={paper.year_of_service || ''} onChange={(e) => updatePaper({ year_of_service: e.target.value })} />
        </div>
      </div>
    </>
  );

  const renderPostgradApplicant = () => (
    <>
      {renderApplicantCommon()}
      <div className="space-y-2">
        <Label>毕业之大学 Graduating university (bachelor) *</Label>
        <Input value={paper.graduating_university || ''} onChange={(e) => updatePaper({ graduating_university: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>学士文凭等级 Bachelor degree honors</Label>
        <Select
          value={paper.bachelor_honors || undefined}
          onValueChange={(v) => updatePaper({ bachelor_honors: v as StudyLoanBachelorHonors })}
        >
          <SelectTrigger><SelectValue placeholder="Select honors level" /></SelectTrigger>
          <SelectContent>
            {BACHELOR_HONORS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loanType === 'master' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>修读硕士学位之大学 Current university (master) *</Label>
              <Input value={university} onChange={(e) => setUniversity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>修读课程项目 Program / course *</Label>
              <Input value={courses} onChange={(e) => setCourses(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>学程年制 Program year</Label>
              <Input value={paper.program_year || paper.study_year} onChange={(e) => updatePaper({ program_year: e.target.value, study_year: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>硕士学位修完年份 Master completion year</Label>
              <Input inputMode="numeric" maxLength={4} value={paper.master_completion_year || graduationYear} onChange={(e) => { const y = sanitizeYear(e.target.value); updatePaper({ master_completion_year: y }); setGraduationYear(y); }} />
            </div>
            <div className="space-y-2">
              <Label>博士修完年份 (一等荣誉) PhD completion (1st class only)</Label>
              <Input inputMode="numeric" maxLength={4} value={paper.phd_completion_year_first_class || ''} onChange={(e) => updatePaper({ phd_completion_year_first_class: sanitizeYear(e.target.value) })} />
            </div>
          </div>
        </>
      )}
      {loanType === 'phd' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>修读博士学位之大学 PhD university *</Label>
              <Input value={university} onChange={(e) => setUniversity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>已修读硕士课程 Master degree program</Label>
              <Input value={paper.master_degree_program || ''} onChange={(e) => updatePaper({ master_degree_program: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>博士学位修读学科 PhD program / course *</Label>
              <Input value={paper.phd_program_course || courses} onChange={(e) => { updatePaper({ phd_program_course: e.target.value }); setCourses(e.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label>博士学程年制 Program year</Label>
              <Input value={paper.program_year || paper.study_year} onChange={(e) => updatePaper({ program_year: e.target.value, study_year: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>博士学位修完年份 PhD completion year</Label>
            <Input inputMode="numeric" maxLength={4} value={paper.phd_completion_year || graduationYear} onChange={(e) => { const y = sanitizeYear(e.target.value); updatePaper({ phd_completion_year: y }); setGraduationYear(y); }} />
          </div>
        </>
      )}
    </>
  );

  const renderDegreeExams = () => (
    <>
      <div>
        <h3 className="font-semibold text-sm mb-3">附缴成绩单 Exam results attached (tick)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ExamCheckbox id="ex-stpm" label="STPM 高级教育文凭" checked={paper.exam_results.stpm} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, stpm: v } })} />
          <ExamCheckbox id="ex-gce" label="GCE A Level" checked={paper.exam_results.gce_a_level} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, gce_a_level: v } })} />
          <ExamCheckbox id="ex-uec" label="UEC 独中统考" checked={paper.exam_results.uec} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, uec: v } })} />
          <ExamCheckbox id="ex-spm" label="SPM 大马教育文凭" checked={paper.exam_results.spm} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, spm: v } })} />
          <ExamCheckbox id="ex-mat" label="Matriculation 大学预科班" checked={paper.exam_results.matriculation} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, matriculation: v } })} />
          <ExamCheckbox id="ex-dip" label="Diploma 文凭" checked={paper.exam_results.diploma} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, diploma: v } })} />
          <ExamCheckbox id="ex-uni" label="Recent university results 大学最近学年" checked={paper.exam_results.recent_university} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, recent_university: v } })} />
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-3">附缴相关文件 Documents attached (tick)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ExamCheckbox id="doc-adm" label="University admission letter" checked={paper.documents_attached.admission_letter} onChange={(v) => updatePaper({ documents_attached: { ...paper.documents_attached, admission_letter: v } })} />
          <ExamCheckbox id="doc-test" label="School testimonial 操行鉴定书" checked={paper.documents_attached.school_testimonial} onChange={(v) => updatePaper({ documents_attached: { ...paper.documents_attached, school_testimonial: v } })} />
          <ExamCheckbox id="doc-co" label="Co-curriculum documents" checked={paper.documents_attached.co_curriculum_docs} onChange={(v) => updatePaper({ documents_attached: { ...paper.documents_attached, co_curriculum_docs: v } })} />
          <ExamCheckbox id="doc-ic" label="IC photocopy 身份证影印本" checked={paper.documents_attached.ic_photocopy} onChange={(v) => updatePaper({ documents_attached: { ...paper.documents_attached, ic_photocopy: v } })} />
        </div>
      </div>
      {renderFileUploads([
        ['offer-letter', 'Offer / admission letter', offerLetterFile, setOfferLetterFile, 'offer_letter_path'],
        ['ic-front', 'IC front', icFrontFile, setIcFrontFile, 'ic_front_path'],
        ['ic-back', 'IC back', icBackFile, setIcBackFile, 'ic_back_path'],
        ['testimonial', 'School testimonial', testimonialFile, setTestimonialFile, 'school_testimonial_path'],
        ['co-curriculum', 'Co-curriculum docs', coCurriculumFile, setCoCurriculumFile, 'co_curriculum_path'],
      ])}
    </>
  );

  const renderTvetExams = () => (
    <>
      <div>
        <h3 className="font-semibold text-sm mb-3">附缴成绩单 Exam results (select one)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ExamCheckbox id="tv-stpm" label="STPM 高级教育文凭" checked={!!paper.exam_results.stpm} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, stpm: v } })} />
          <ExamCheckbox id="tv-gce" label="GCE A Level" checked={!!paper.exam_results.gce_a_level} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, gce_a_level: v } })} />
          <ExamCheckbox id="tv-uec" label="MICSS Unified Exam 独中统考" checked={!!paper.exam_results.uec} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, uec: v } })} />
          <ExamCheckbox id="tv-pmr" label="PMR 初中评估考试" checked={!!paper.exam_results.pmr} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, pmr: v } })} />
          <ExamCheckbox id="tv-oth" label="Others 其他" checked={!!paper.exam_results.others} onChange={(v) => updatePaper({ exam_results: { ...paper.exam_results, others: v } })} />
        </div>
        {paper.exam_results.others && (
          <Input className="mt-2" placeholder="Specify other exam" value={paper.exam_results.others_specify || ''} onChange={(e) => updatePaper({ exam_results: { ...paper.exam_results, others_specify: e.target.value } })} />
        )}
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-3">附缴相关文件 Documents attached</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ExamCheckbox id="tv-doc-adm" label="Admission letter 学院入学证书" checked={!!paper.documents_attached.admission_letter} onChange={(v) => updatePaper({ documents_attached: { ...paper.documents_attached, admission_letter: v } })} />
          <ExamCheckbox id="tv-doc-ic" label="IC photocopy 身份证影印本" checked={!!paper.documents_attached.ic_photocopy} onChange={(v) => updatePaper({ documents_attached: { ...paper.documents_attached, ic_photocopy: v } })} />
          <ExamCheckbox id="tv-doc-photo" label="Passport photos ×2 护照式相片" checked={!!paper.documents_attached.passport_photos} onChange={(v) => updatePaper({ documents_attached: { ...paper.documents_attached, passport_photos: v } })} />
          <ExamCheckbox id="tv-doc-emp" label="Employer recommendation 雇主推荐信" checked={!!paper.documents_attached.employer_recommendation} onChange={(v) => updatePaper({ documents_attached: { ...paper.documents_attached, employer_recommendation: v } })} />
        </div>
      </div>
      {renderFileUploads([
        ['offer-letter', 'Admission letter', offerLetterFile, setOfferLetterFile, 'offer_letter_path'],
        ['ic-front', 'IC front', icFrontFile, setIcFrontFile, 'ic_front_path'],
        ['ic-back', 'IC back', icBackFile, setIcBackFile, 'ic_back_path'],
        ['employer-rec', 'Employer recommendation', employerRecommendationFile, setEmployerRecommendationFile, 'employer_recommendation_path'],
      ])}
    </>
  );

  const fileUploadLabel = (file: File | null, existingPath: string | null | undefined) => {
    if (file?.name) return file.name;
    if (existingPath) return `Saved: ${existingPath.split('/').pop()}`;
    return 'Upload';
  };

  const renderFileUploads = (
    items: Array<[string, string, File | null, (f: File | null) => void, keyof PaperFormUploadPaths]>,
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
      {items.map(([fid, flabel, file, setter, pathKey]) => (
        <div key={fid} className="space-y-2">
          <Label>{flabel} (optional upload)</Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              id={fid}
              onChange={(e) => handleFilePick(e.target.files?.[0] || null, flabel, setter, e.target)}
            />
            <label htmlFor={fid} className="cursor-pointer text-xs text-gray-600 flex flex-col items-center gap-1">
              <FileText className="w-6 h-6 text-gray-400" />
              {fileUploadLabel(file, existingPaths[pathKey])}
            </label>
          </div>
        </div>
      ))}
    </div>
  );

  const renderParents = () => (
    <>
      {(['father', 'mother'] as const).map((role) => {
        const label = role === 'father' ? '父亲 Father' : '母亲 Mother';
        const info = paper[role];
        const setInfo = (patch: Partial<typeof info>) => updatePaper({ [role]: { ...info, ...patch } });
        return (
          <div key={role} className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold">{label}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">姓名（中文）</Label>
                <Input value={info.name_zh} onChange={(e) => setInfo({ name_zh: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name (English)</Label>
                <Input value={info.name_en} onChange={(e) => setInfo({ name_en: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">年龄 Age</Label>
                <Input value={info.age} onChange={(e) => setInfo({ age: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">职业 Occupation</Label>
                <Input value={info.occupation} onChange={(e) => setInfo({ occupation: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">公司、地址及电话 Company / address / tel</Label>
                <Textarea rows={2} value={info.company_address_tel} onChange={(e) => setInfo({ company_address_tel: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">每月收入 Monthly income (RM)</Label>
                <Input value={info.monthly_income} onChange={(e) => setInfo({ monthly_income: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">每年学费 Yearly fees (RM)</Label>
                <Input value={info.yearly_fees} onChange={(e) => setInfo({ yearly_fees: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">若已逝世年份 If deceased</Label>
                <Input value={info.died_year} onChange={(e) => setInfo({ died_year: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">备注 Remark</Label>
                <Input value={info.remark} onChange={(e) => setInfo({ remark: e.target.value })} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );

  const renderScholarshipBlock = (postgrad = false) => (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold text-sm">另有申请／获得其他奖贷学金 Other scholarship / study loan</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">(1) 颁发单位 Organization</Label>
          <Input value={paper.other_scholarship_org1} onChange={(e) => updatePaper({ other_scholarship_org1: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">(2) 颁发单位 Organization</Label>
          <Input value={paper.other_scholarship_org2} onChange={(e) => updatePaper({ other_scholarship_org2: e.target.value })} />
        </div>
        {postgrad ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">奖学金总额 Scholarship total (RM)</Label>
              <Input value={paper.other_scholarship_scholarship_total || ''} onChange={(e) => updatePaper({ other_scholarship_scholarship_total: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">贷学金总额 Study loan total (RM)</Label>
              <Input value={paper.other_scholarship_loan_total || ''} onChange={(e) => updatePaper({ other_scholarship_loan_total: e.target.value })} />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">总额 Total (RM)</Label>
            <Input value={paper.other_scholarship_total} onChange={(e) => updatePaper({ other_scholarship_total: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );

  const renderSiblingsDegree = () => (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">兄弟姐妹 Siblings</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => updatePaper({ siblings: [...paper.siblings, emptySibling()] })}>
            <Plus className="w-3 h-3 mr-1" /> Add row
          </Button>
        </div>
        {paper.siblings.length === 0 ? (
          <p className="text-sm text-gray-500">No siblings added.</p>
        ) : (
          paper.siblings.map((s, i) => (
            <div key={i} className="border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm relative">
              <Button type="button" size="sm" variant="ghost" className="absolute top-1 right-1 text-red-600" onClick={() => updatePaper({ siblings: paper.siblings.filter((_, j) => j !== i) })}>
                <Trash2 className="w-3 h-3" />
              </Button>
              <Input placeholder="Name 中英文" value={s.name} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, name: e.target.value }; updatePaper({ siblings: rows }); }} />
              <Input placeholder="Age" value={s.age} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, age: e.target.value }; updatePaper({ siblings: rows }); }} />
              <label className="flex items-center gap-2 col-span-2">
                <Checkbox checked={s.married} onCheckedChange={(v) => { const rows = [...paper.siblings]; rows[i] = { ...s, married: v === true }; updatePaper({ siblings: rows }); }} />
                Married 已婚
              </label>
              <Input placeholder="School / occupation" className="col-span-2" value={s.school_or_occupation} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, school_or_occupation: e.target.value }; updatePaper({ siblings: rows }); }} />
              <Input placeholder="Standard / monthly income" value={s.standard_or_income} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, standard_or_income: e.target.value }; updatePaper({ siblings: rows }); }} />
              <Input placeholder="Remarks" value={s.remarks} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, remarks: e.target.value }; updatePaper({ siblings: rows }); }} />
            </div>
          ))
        )}
      </div>
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">校内活动 School activities (latest 2 years)</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => updatePaper({ school_activities: [...paper.school_activities, emptySchoolActivity()] })}>
            <Plus className="w-3 h-3 mr-1" /> Add row
          </Button>
        </div>
        {paper.school_activities.map((a, i) => (
          <div key={i} className="border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
            <Input placeholder="Year" value={a.year} onChange={(e) => { const rows = [...paper.school_activities]; rows[i] = { ...a, year: e.target.value }; updatePaper({ school_activities: rows }); }} />
            <Input placeholder="Form 年级" value={a.form} onChange={(e) => { const rows = [...paper.school_activities]; rows[i] = { ...a, form: e.target.value }; updatePaper({ school_activities: rows }); }} />
            <Input placeholder="Organization 学会/俱乐部" className="col-span-2" value={a.organization} onChange={(e) => { const rows = [...paper.school_activities]; rows[i] = { ...a, organization: e.target.value }; updatePaper({ school_activities: rows }); }} />
            <Input placeholder="Post / achievement" className="col-span-2" value={a.post_achievement} onChange={(e) => { const rows = [...paper.school_activities]; rows[i] = { ...a, post_achievement: e.target.value }; updatePaper({ school_activities: rows }); }} />
          </div>
        ))}
      </div>
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">校外活动 Outside school</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => updatePaper({ outside_activities: [...paper.outside_activities, emptyOutsideActivity()] })}>
            <Plus className="w-3 h-3 mr-1" /> Add row
          </Button>
        </div>
        {paper.outside_activities.map((a, i) => (
          <div key={i} className="border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
            <Input placeholder="Activity" className="col-span-2" value={a.activity} onChange={(e) => { const rows = [...paper.outside_activities]; rows[i] = { ...a, activity: e.target.value }; updatePaper({ outside_activities: rows }); }} />
            <Input placeholder="Post / achievement" value={a.post_achievement} onChange={(e) => { const rows = [...paper.outside_activities]; rows[i] = { ...a, post_achievement: e.target.value }; updatePaper({ outside_activities: rows }); }} />
            <Select value={a.level || undefined} onValueChange={(v) => { const rows = [...paper.outside_activities]; rows[i] = { ...a, level: v as StudyLoanOutsideActivityRow['level'] }; updatePaper({ outside_activities: rows }); }}>
              <SelectTrigger><SelectValue placeholder="Level 代表级别" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="N">国 N</SelectItem>
                <SelectItem value="S">州 S</SelectItem>
                <SelectItem value="D">县 D</SelectItem>
                <SelectItem value="Sch">校 Sch</SelectItem>
                <SelectItem value="T">队 T</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div className="space-y-2">
          <Label>申请人签名日期 Applicant signature date</Label>
          <Input type="date" value={paper.applicant_signature_date} onChange={(e) => updatePaper({ applicant_signature_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>家长签名日期 Parent signature date</Label>
          <Input type="date" value={paper.parent_signature_date} onChange={(e) => updatePaper({ parent_signature_date: e.target.value })} />
        </div>
      </div>
    </>
  );

  const renderSiblingsPostgrad = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">兄弟姐妹 Siblings</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => updatePaper({ siblings: [...paper.siblings, emptySibling()] })}>
          <Plus className="w-3 h-3 mr-1" /> Add row
        </Button>
      </div>
      {paper.siblings.length === 0 ? (
        <p className="text-sm text-gray-500">No siblings added.</p>
      ) : (
        paper.siblings.map((s, i) => (
          <div key={i} className="border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm relative">
            <Button type="button" size="sm" variant="ghost" className="absolute top-1 right-1 text-red-600" onClick={() => updatePaper({ siblings: paper.siblings.filter((_, j) => j !== i) })}>
              <Trash2 className="w-3 h-3" />
            </Button>
            <Input placeholder="Name 中英文" className="col-span-2" value={s.name} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, name: e.target.value }; updatePaper({ siblings: rows }); }} />
            <Input placeholder="Age" value={s.age} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, age: e.target.value }; updatePaper({ siblings: rows }); }} />
            <label className="flex items-center gap-2">
              <Checkbox checked={s.married} onCheckedChange={(v) => { const rows = [...paper.siblings]; rows[i] = { ...s, married: v === true }; updatePaper({ siblings: rows }); }} />
              Married 已婚
            </label>
            <Input placeholder="School / occupation" className="col-span-2" value={s.school_or_occupation} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, school_or_occupation: e.target.value }; updatePaper({ siblings: rows }); }} />
            <Input placeholder="Monthly income" value={s.standard_or_income} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, standard_or_income: e.target.value }; updatePaper({ siblings: rows }); }} />
            <Input placeholder="Scholarship total (RM)" value={s.scholarship_total || ''} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, scholarship_total: e.target.value }; updatePaper({ siblings: rows }); }} />
            <Input placeholder="Study loan total (RM)" value={s.study_loan_total || ''} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, study_loan_total: e.target.value }; updatePaper({ siblings: rows }); }} />
            <Input placeholder="Remarks" className="col-span-2" value={s.remarks} onChange={(e) => { const rows = [...paper.siblings]; rows[i] = { ...s, remarks: e.target.value }; updatePaper({ siblings: rows }); }} />
          </div>
        ))
      )}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <Label>申请人签名日期 Applicant signature date</Label>
          <Input type="date" value={paper.applicant_signature_date} onChange={(e) => updatePaper({ applicant_signature_date: e.target.value })} />
        </div>
      </div>
    </div>
  );

  const renderAffiliate = () => (
    <>
      <p className="text-sm text-gray-600">(B) 属会填报 — membership declarations and affiliate assessment.</p>
      {[
        { key: 'applicant' as const, label: '申请者 Applicant' },
        { key: 'father' as const, label: '父亲 Father' },
        { key: 'mother' as const, label: '母亲 Mother' },
      ].map(({ key, label }) => {
        const isMemberKey = `${key}_is_member` as 'applicant_is_member' | 'father_is_member' | 'mother_is_member';
        const noKey = `${key}_membership_no` as 'applicant_membership_no' | 'father_membership_no' | 'mother_membership_no';
        const dateKey = `${key}_admission_date` as 'applicant_admission_date' | 'father_admission_date' | 'mother_admission_date';
        const aff = paper.affiliate;
        return (
          <div key={key} className="border rounded-lg p-3 space-y-2">
            <h4 className="font-medium text-sm">{label}</h4>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={aff[isMemberKey]} onCheckedChange={(v) => updatePaper({ affiliate: { ...aff, [isMemberKey]: v === true } })} />
              Is affiliate member 是本属会会员
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Membership no." value={aff[noKey]} onChange={(e) => updatePaper({ affiliate: { ...aff, [noKey]: e.target.value } })} />
              <Input type="date" placeholder="Admission date" value={aff[dateKey]} onChange={(e) => updatePaper({ affiliate: { ...aff, [dateKey]: e.target.value } })} />
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {[
          ['post_affiliate', '属会职位 Affiliate post'],
          ['post_federation', '海南联会 Federation post'],
          ['post_youth', '联青 Youth post'],
          ['post_women', '妇女团 Women post'],
        ].map(([prefix, title]) => (
          <div key={prefix} className="border rounded p-3 space-y-2">
            <p className="font-medium">{title}</p>
            <Input placeholder="现任 Current" value={(paper.affiliate as any)[`${prefix}_current`]} onChange={(e) => updatePaper({ affiliate: { ...paper.affiliate, [`${prefix}_current`]: e.target.value } })} />
            <Input placeholder="曾任 Previous" value={(paper.affiliate as any)[`${prefix}_previous`]} onChange={(e) => updatePaper({ affiliate: { ...paper.affiliate, [`${prefix}_previous`]: e.target.value } })} />
            <Input placeholder="年份 Year" value={(paper.affiliate as any)[`${prefix}_year`]} onChange={(e) => updatePaper({ affiliate: { ...paper.affiliate, [`${prefix}_year`]: e.target.value } })} />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label>家庭经济状况 Family financial situation</Label>
        <Textarea rows={2} value={paper.affiliate.financial_assessment} onChange={(e) => updatePaper({ affiliate: { ...paper.affiliate, financial_assessment: e.target.value } })} />
      </div>
      <div className="space-y-2">
        <Label>参与属会活动 Participation in affiliate activities</Label>
        <Textarea rows={2} value={paper.affiliate.participation_assessment} onChange={(e) => updatePaper({ affiliate: { ...paper.affiliate, participation_assessment: e.target.value } })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>属会主席签署日期 President signature date</Label>
          <Input type="date" value={paper.affiliate.president_signature_date} onChange={(e) => updatePaper({ affiliate: { ...paper.affiliate, president_signature_date: e.target.value } })} />
        </div>
        <div className="space-y-2">
          <Label>委员签署日期 Committee signature date</Label>
          <Input type="date" value={paper.affiliate.committee_signature_date} onChange={(e) => updatePaper({ affiliate: { ...paper.affiliate, committee_signature_date: e.target.value } })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>属会印章 Affiliate seal (optional scan)</Label>
        <div className="border-2 border-dashed rounded-lg p-3 text-center">
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" id="affiliate-seal" onChange={(e) => handleFilePick(e.target.files?.[0] || null, 'Affiliate seal', setAffiliateSealFile, e.target)} />
          <label htmlFor="affiliate-seal" className="cursor-pointer text-xs text-gray-600">
            {fileUploadLabel(affiliateSealFile, existingPaths.affiliate_seal_path)}
          </label>
        </div>
      </div>
    </>
  );

  const renderSectionContent = () => {
    switch (currentSection) {
      case 'loan_type':
        return (
          <>
            <p className="text-sm text-gray-600">
              {isEditMode
                ? 'Loan type cannot be changed when editing an existing application.'
                : 'Select the loan type first. The application form will match the official paper form for that category.'}
            </p>
            <div className="space-y-2">
              <Label>Loan type *</Label>
              <Select
                value={loanType || undefined}
                onValueChange={(v) => handleLoanTypeChange(v as StudyLoanFormVariant)}
                disabled={isEditMode}
              >
                <SelectTrigger><SelectValue placeholder="Select loan type" /></SelectTrigger>
                <SelectContent>
                  {LOAN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — RM {t.amount.toLocaleString()} / year
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {loanType && formMeta && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm space-y-1">
                <p className="font-medium text-blue-900">{formMeta.titleZh}</p>
                <p className="text-blue-800">{formMeta.titleEn}</p>
                <p className="text-xs text-gray-600">Form: {formMeta.formCode} · RM {formMeta.annualAmount.toLocaleString()} / year</p>
              </div>
            )}
          </>
        );
      case 'applicant':
        if (loanType === 'degree') return renderDegreeApplicant();
        if (loanType === 'tvet_vocational') return renderTvetApplicant();
        return renderPostgradApplicant();
      case 'exams':
        return loanType === 'tvet_vocational' ? renderTvetExams() : renderDegreeExams();
      case 'family':
        return (
          <>
            {renderParents()}
            {(loanType === 'master' || loanType === 'phd') && (
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold">配偶 Spouse</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">配偶姓名 Spouse name (中／英)</Label>
                    <Input value={paper.spouse_name || ''} onChange={(e) => updatePaper({ spouse_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">职业 Occupation</Label>
                    <Input value={paper.spouse_occupation || ''} onChange={(e) => updatePaper({ spouse_occupation: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">每月收入 Monthly income (RM)</Label>
                    <Input value={paper.spouse_monthly_income || ''} onChange={(e) => updatePaper({ spouse_monthly_income: e.target.value })} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">电话 Tel.</Label>
                    <Input value={paper.spouse_tel || ''} onChange={(e) => updatePaper({ spouse_tel: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
            {renderScholarshipBlock(loanType === 'master' || loanType === 'phd')}
            {(loanType === 'master' || loanType === 'phd') && renderSiblingsPostgrad()}
            {loanType === 'tvet_vocational' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>申请人签名日期 Applicant signature date</Label>
                  <Input type="date" value={paper.applicant_signature_date} onChange={(e) => updatePaper({ applicant_signature_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>家长签名日期 Parent signature date</Label>
                  <Input type="date" value={paper.parent_signature_date} onChange={(e) => updatePaper({ parent_signature_date: e.target.value })} />
                </div>
              </div>
            )}
          </>
        );
      case 'siblings':
        return (
          <>
            {renderSiblingsDegree()}
          </>
        );
      case 'affiliate':
        return renderAffiliate();
      case 'review':
        return (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm space-y-2">
            <p><strong>Loan type:</strong> {LOAN_TYPES.find((t) => t.value === loanType)?.label}</p>
            <p><strong>Form:</strong> {formMeta?.formCode} — {formMeta?.titleZh}</p>
            <p><strong>Applicant:</strong> {fullNameEn} {fullNameZh ? `(${fullNameZh})` : ''}</p>
            <p><strong>Association:</strong> {association || '—'}</p>
            <p><strong>Institution:</strong> {university || paper.academy_name || '—'} · {courses || paper.phd_program_course || '—'}</p>
            <p><strong>Loan amount (per year):</strong> RM {loanAmount.toLocaleString()}</p>
            <p className="text-xs text-gray-600 pt-2">Saved as <strong>pending</strong> paper application. Approve from the Study Loan Applications list when ready.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="text-right">
            <p className="font-medium text-gray-800 text-sm">
              {isEditMode ? 'Edit paper application' : 'Paper application'} {formMeta ? `· ${formMeta.formCode}` : ''}
            </p>
            <p className="text-xs text-gray-500">Step {step} of {totalSteps}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 mb-6">
          {isEditMode ? (
            <>Edit an admin-filled paper application. Changes are saved to Supabase when you submit.</>
          ) : (
            <>
              马来西亚海南会馆联合会 · 奖贷学金申请表格 — Super Admin enters paper forms by loan type.
              Student online applications use a separate form and appear with source <strong>Student app</strong>.
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{stepTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {renderSectionContent()}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => (step > 1 ? setStep(step - 1) : onBack())}
                disabled={submitting}
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </Button>
              {currentSection !== 'review' ? (
                <Button
                  onClick={() => {
                    const err = validateCurrentStep();
                    if (err) {
                      alert(err);
                      return;
                    }
                    setStep(step + 1);
                  }}
                  disabled={currentSection === 'loan_type' && !loanType}
                >
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || !loanType}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : isEditMode ? (
                    'Save changes'
                  ) : (
                    'Save paper application'
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
