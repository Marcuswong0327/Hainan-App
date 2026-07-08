import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { CheckCircle, XCircle, FileText, Building2, Download, HeartHandshake, Eye, FileDown, CreditCard, ExternalLink, UserPlus, DollarSign, Trash2, Loader2, Users, GraduationCap, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { StudyLoanApplication, StudyLoanApplicationSource, StudyLoanPaperFormData, LoanRecipient, LoanRecipientCore, GuarantorInsert, GuarantorRow } from '../types/studyLoan';
import { STUDY_LOAN_BUCKET, MANUAL_STUDY_LOAN_USER_ID } from '../types/studyLoan';
import { AddLoanRecipientPage } from './AddLoanRecipientPage';
import { AddStudyLoanApplicationPage } from './AddStudyLoanApplicationPage';
import { RecordLoanPaymentsPage } from './RecordLoanPaymentsPage';
import { LoanRecipientsStatsPage } from './LoanRecipientsStatsPage';
import { formatMalaysiaMobileDash, isValidMalaysiaMobileDash } from '../lib/malaysiaPhone';
import { validateUploadFile } from '../lib/fileValidation';
import { mapLoanRecipientRow } from '../lib/mapLoanRecipient';

/** Display/edit year-only fields; DB may still have legacy full dates — show leading year. */
function yearFieldFromStored(stored: string | null | undefined): string {
  if (!stored) return '';
  const m = stored.match(/^(\d{4})/);
  return m ? m[1] : stored.replace(/\D/g, '').slice(0, 4);
}

function emptyGuarantorRow(studentId: string): GuarantorRow {
  return {
    id: '',
    student_id: studentId,
    guarantor_1_zh: null,
    guarantor_1_en: null,
    guarantor_1_ic: null,
    guarantor_1_address: null,
    guarantor_1_sign_date: null,
    guarantor_2_zh: null,
    guarantor_2_en: null,
    guarantor_2_ic: null,
    guarantor_2_address: null,
    guarantor_2_sign_date: null,
    guarantor_2_age: null,
    guarantor_info_pic: null,
  };
}

/** Normalize DB/local rows so legacy records default to online student submissions. */
function normalizeStudyLoanApplication(row: Partial<StudyLoanApplication> & Pick<StudyLoanApplication, 'id' | 'full_name' | 'status'>): StudyLoanApplication {
  const source: StudyLoanApplicationSource = row.source === 'manual' ? 'manual' : 'online';
  return {
    id: row.id,
    user_id: row.user_id ?? '',
    association: row.association ?? '',
    full_name: row.full_name,
    full_name_zh: row.full_name_zh ?? null,
    age: row.age ?? '',
    email: row.email ?? '',
    university: row.university ?? '',
    courses: row.courses ?? '',
    admission_date: row.admission_date ?? '',
    expected_graduation_date: row.expected_graduation_date ?? '',
    phone_number: row.phone_number ?? '',
    offer_letter_path: row.offer_letter_path ?? null,
    ic_front_path: row.ic_front_path ?? null,
    ic_back_path: row.ic_back_path ?? null,
    guarantor_ic_front_path: row.guarantor_ic_front_path ?? null,
    guarantor_ic_back_path: row.guarantor_ic_back_path ?? null,
    guarantor_relationship: row.guarantor_relationship ?? '',
    guarantor_phone_number: row.guarantor_phone_number ?? '',
    loan_type: row.loan_type ?? '',
    loan_amount: row.loan_amount ?? 0,
    status: row.status,
    source,
    extended_form: (row.extended_form as StudyLoanPaperFormData | null) ?? null,
    applied_at: row.applied_at ?? row.created_at ?? new Date().toISOString(),
    reviewed_at: row.reviewed_at ?? null,
    rejection_reason: row.rejection_reason ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    total_paid: row.total_paid,
    payments_made: row.payments_made,
  };
}

function studyLoanSourceLabel(source: StudyLoanApplicationSource): string {
  return source === 'manual' ? 'Paper form' : 'Student app';
}


interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  price: number;
  description: string;
  status: string;
  createdBy: string;
  createdAt: string;
  maxCapacity?: number;
  currentParticipants?: number;
}

interface WelfareApplication {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  applicantNameChinese: string;
  applicantNameEnglish: string;
  icNumber: string;
  age: string;
  gender: string;
  membershipNumber: string;
  joinDate: string;
  occupation: string;
  monthlyIncome: string;
  address: string;
  postcode: string;
  homePhone: string;
  mobilePhone: string;
  spouseNameChinese: string;
  spouseNameEnglish: string;
  spouseAge: string;
  spouseOccupation: string;
  spouseMonthlyIncome: string;
  children: any[];
  hasMedicalInsurance: 'yes' | 'no';
  insuranceCompany: string;
  hasOtherWelfareAid: 'yes' | 'no';
  otherWelfareOrg: string;
  requestType: 'general_welfare' | 'sub_association_donation';
  applicationReason: string;
  medicalDocument?: string;
  recommendationLetter?: string;
  recommendedBySubAssociation?: string;
  rejectionReason?: string;
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  degree: 'Degree',
  tvet_vocational: 'TVET / Vocational',
  master: 'Master',
  phd: 'PhD',
  degree_3000: 'Degree (学士) - RM 3,000 / year',
  degree_4000: 'Degree (学士) - RM 4,000 / year',
  tvet_vocational_3000: 'TVET / Vocasional (技职教育) - RM 3,000 / year',
  tvet_vocational_4000: 'TVET / Vocasional (技职教育) - RM 4,000 / year',
  master_5000: 'Master (硕士) - RM 5,000 / year',
  master_6000: 'Master (硕士) - RM 6,000 / year',
  phd_5000: 'PhD (博士) - RM 5,000 / year',
  phd_6000: 'PhD (博士) - RM 6,000 / year',
};

const LOAN_TYPE_OPTIONS: Array<{ value: string; label: string; amount: number }> = [
  { value: 'degree_3000', label: 'Degree (学士)', amount: 3000 },
  { value: 'degree_4000', label: 'Degree (学士)', amount: 4000 },
  { value: 'tvet_vocational_3000', label: 'TVET / Vocasional (技职教育)', amount: 3000 },
  { value: 'tvet_vocational_4000', label: 'TVET / Vocasional (技职教育)', amount: 4000 },
  { value: 'master_5000', label: 'Master (硕士)', amount: 5000 },
  { value: 'master_6000', label: 'Master (硕士)', amount: 6000 },
  { value: 'phd_5000', label: 'PhD (博士)', amount: 5000 },
  { value: 'phd_6000', label: 'PhD (博士)', amount: 6000 },
];

const STUDY_LOAN_VARIANT_LABELS: Record<string, string> = {
  degree: 'Degree (学士)',
  tvet_vocational: 'TVET / Vocasional (技职教育)',
  master: 'Master (硕士)',
  phd: 'PhD (博士)',
};

function studyLoanAnnualDisplayLabel(loanType: string, annualAmount: number): string {
  const keyed = `${loanType}_${annualAmount}`;
  if (LOAN_TYPE_LABELS[keyed]) return LOAN_TYPE_LABELS[keyed];
  const variant = STUDY_LOAN_VARIANT_LABELS[loanType];
  if (variant) return `${variant} - RM ${annualAmount.toLocaleString()} / year`;
  return `${LOAN_TYPE_LABELS[loanType] || loanType} - RM ${annualAmount.toLocaleString()} / year`;
}

function studyYearSpan(admission: string, graduation: string): number {
  const start = parseInt(String(admission || '').slice(0, 4), 10);
  const end = parseInt(String(graduation || '').slice(0, 4), 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
  return end - start;
}

function studyLoanStatusBadgeClass(status: StudyLoanApplication['status']) {
  if (status === 'approved') return 'bg-green-600';
  if (status === 'rejected') return 'bg-red-600';
  return 'bg-amber-600';
}

export function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editMaxCapacity, setEditMaxCapacity] = useState('');
  const [welfareApplications, setWelfareApplications] = useState<WelfareApplication[]>([]);
  const [selectedWelfareApp, setSelectedWelfareApp] = useState<WelfareApplication | null>(null);
  const [welfareFilter, setWelfareFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [showRejectWelfareDialog, setShowRejectWelfareDialog] = useState(false);
  const [welfareRejectionReason, setWelfareRejectionReason] = useState('');

  // Study Loan Applications
  const [studyLoanApplications, setStudyLoanApplications] = useState<StudyLoanApplication[]>([]);
  const [selectedStudyLoan, setSelectedStudyLoan] = useState<StudyLoanApplication | null>(null);
  const [studyLoanFilter, setStudyLoanFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [studyLoanSourceFilter, setStudyLoanSourceFilter] = useState<StudyLoanApplicationSource>('manual');
  const [showAddStudyLoanPage, setShowAddStudyLoanPage] = useState(false);
  const [editingStudyLoan, setEditingStudyLoan] = useState<StudyLoanApplication | null>(null);
  const [showRejectStudyLoanDialog, setShowRejectStudyLoanDialog] = useState(false);
  const [studyLoanRejectionReason, setStudyLoanRejectionReason] = useState('');

  const [activeTab, setActiveTab] = useState<'studyLoans' | 'recipients'>('studyLoans');

  // Manual loan recipients (track students who got the loan)
  const [loanRecipients, setLoanRecipients] = useState<LoanRecipient[]>([]);
  const [showAddRecipientPage, setShowAddRecipientPage] = useState(false);
  const [recordPaymentsRecipient, setRecordPaymentsRecipient] = useState<LoanRecipient | null>(null);
  const [selectedRecipientForDetails, setSelectedRecipientForDetails] = useState<LoanRecipient | null>(null);
  const [editRecipient, setEditRecipient] = useState<LoanRecipient | null>(null);
  const [savingRecipientEdit, setSavingRecipientEdit] = useState(false);
  const [pendingDeleteRecipient, setPendingDeleteRecipient] = useState<LoanRecipient | null>(null);
  const [deleteRecipientConfirmText, setDeleteRecipientConfirmText] = useState('');
  const [deletingRecipient, setDeletingRecipient] = useState(false);
  const [editOfferLetterFile, setEditOfferLetterFile] = useState<File | null>(null);
  const [editStudentIcFile, setEditStudentIcFile] = useState<File | null>(null);
  const [editDocScreenshotFile, setEditDocScreenshotFile] = useState<File | null>(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationTarget, setNotificationTarget] = useState<'all' | 'active' | 'completed'>('active');
  const [notificationMessage, setNotificationMessage] = useState(
    'Your study loan repayment is due soon. Please check your loan status in the app.'
  );
  const [notificationSchedule, setNotificationSchedule] = useState('');
  const [sendingNotificationNow, setSendingNotificationNow] = useState(false);
  const [savingNotificationSchedule, setSavingNotificationSchedule] = useState(false);
  const [lastSendNowAt, setLastSendNowAt] = useState<number>(0);
  const [showLoanStats, setShowLoanStats] = useState(false);

  // New Association Form
  const [newAssociation, setNewAssociation] = useState({
    id: '',
    name: '',
    location: '',
  });


  useEffect(() => {
    fetchPendingEvents();
    fetchAssociations();
    fetchWelfareApplications();
    fetchStudyLoanApplications();
    fetchLoanRecipients();

    const interval = setInterval(() => {
      fetchWelfareApplications();
      fetchStudyLoanApplications();
      fetchLoanRecipients();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchPendingEvents = async () => {
    try {
      // Frontend-only: Load from localStorage
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const pending = events.filter((e: any) => e.status === 'pending');
      setPendingEvents(pending);
    } catch (error) {
      console.error('Error fetching pending events:', error);
    }
  };


  const fetchAssociations = async () => {
    try {
      // Frontend-only: Load from localStorage
      const assocs = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
      setAssociations(assocs);
    } catch (error) {
      console.error('Error fetching associations:', error);
    }
  };

  const fetchWelfareApplications = async () => {
    try {
      const allApplications = JSON.parse(localStorage.getItem('myHainanWelfareApplications') || '[]');
      setWelfareApplications(allApplications);
    } catch (error) {
      console.error('Error fetching welfare applications:', error);
    }
  };

  const fetchStudyLoanApplications = async () => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('study_loan_applications')
          .select('*')
          .order('applied_at', { ascending: false });
        if (!error) setStudyLoanApplications((data as StudyLoanApplication[]).map(normalizeStudyLoanApplication));
      } else {
        const raw = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        const mapped: StudyLoanApplication[] = raw.map((a: any) => normalizeStudyLoanApplication({
          id: a.id,
          user_id: a.userId,
          association: a.association,
          full_name: a.fullName,
          full_name_zh: a.fullNameZh ?? null,
          age: a.age,
          email: a.email ?? '',
          university: a.university,
          courses: a.courses,
          admission_date: a.admissionDate,
          expected_graduation_date: a.expectedGraduationDate,
          phone_number: a.phoneNumber,
          offer_letter_path: null,
          ic_front_path: null,
          ic_back_path: null,
          guarantor_ic_front_path: null,
          guarantor_ic_back_path: null,
          guarantor_relationship: a.guarantorRelationship ?? '',
          guarantor_phone_number: a.guarantorPhoneNumber ?? '',
          loan_type: a.loanType,
          loan_amount: a.loanAmount,
          status: a.status,
          source: a.source,
          extended_form: a.extendedForm ?? null,
          applied_at: a.appliedDate,
          reviewed_at: null,
          rejection_reason: a.rejectionReason || null,
          created_at: a.appliedDate,
          updated_at: a.appliedDate,
        }));
        setStudyLoanApplications(mapped);
      }
    } catch (error) {
      console.error('Error fetching study loan applications:', error);
    }
  };

  const notifyStudyLoanApplicant = (userId: string, approved: boolean, rejectionReason?: string) => {
    if (userId === MANUAL_STUDY_LOAN_USER_ID) return;
    const notifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
    notifications.push({
      id: `study_loan_${Date.now()}_${userId}`,
      userId,
      title: approved ? 'Study Loan Approved' : 'Study Loan Rejected',
      message: approved
        ? 'Your study loan application has been approved. You can view status and start repayment from the Loans section.'
        : `Your study loan application was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'system',
    });
    localStorage.setItem('myHainanNotifications', JSON.stringify(notifications));
  };

  const handleApproveStudyLoan = async (applicationId: string) => {
    const app = studyLoanApplications.find(a => a.id === applicationId);
    const userId = app?.user_id;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('study_loan_applications')
          .update({ status: 'approved', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', applicationId);
        if (!error) {
          // When approved, sync into loan recipients list so repayment can be tracked
          if (app) {
            const now = new Date().toISOString();
            const icMerged = app.ic_front_path || app.ic_back_path || null;
            const core: LoanRecipientCore = {
              id: app.id,
              full_name_en: app.full_name,
              full_name_zh: app.full_name_zh ?? null,
              loan_type: app.loan_type || null,
              email: app.email,
              phone_number: app.phone_number,
              association: app.association,
              university: app.university,
              course: app.courses,
              admission_date: app.admission_date,
              expected_graduation_date: app.expected_graduation_date,
              loan_amount: app.loan_amount,
              total_paid: app.total_paid ?? 0,
              status: 'active',
              offer_letter_path: app.offer_letter_path,
              student_ic_front_back_path: icMerged,
              notes: null,
              created_at: now,
              updated_at: now,
            };
            const guarantor: GuarantorInsert = {
              student_id: app.id,
              guarantor_1_zh: null,
              guarantor_1_en: null,
              guarantor_1_ic: null,
              guarantor_1_address: null,
              guarantor_1_sign_date: null,
              guarantor_2_zh: null,
              guarantor_2_en: null,
              guarantor_2_ic: null,
              guarantor_2_address: null,
              guarantor_2_sign_date: null,
              guarantor_2_age: null,
              guarantor_info_pic: app.guarantor_ic_front_path || app.guarantor_ic_back_path,
            };
            await saveLoanRecipient(core, guarantor);
          }
          if (userId) notifyStudyLoanApplicant(userId, true);
          fetchStudyLoanApplications();
          setSelectedStudyLoan(null);
          alert('Study loan application approved. Applicant will see a notification on their home.');
        } else throw error;
      } else {
        const all = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        const idx = all.findIndex((a: any) => a.id === applicationId);
        if (idx !== -1) {
          all[idx].status = 'approved';
          // Sync into loan recipients (local-only)
          if (app) {
            const now = new Date().toISOString();
            const core: LoanRecipientCore = {
              id: app.id,
              full_name_en: app.full_name,
              full_name_zh: app.full_name_zh ?? null,
              loan_type: app.loan_type || null,
              email: app.email,
              phone_number: app.phone_number,
              association: app.association,
              university: app.university,
              course: app.courses,
              admission_date: app.admission_date,
              expected_graduation_date: app.expected_graduation_date,
              loan_amount: app.loan_amount,
              total_paid: app.total_paid ?? 0,
              status: 'active',
              offer_letter_path: null,
              student_ic_front_back_path: null,
              notes: null,
              created_at: now,
              updated_at: now,
            };
            const guarantor: GuarantorInsert = {
              student_id: app.id,
              guarantor_1_zh: null,
              guarantor_1_en: null,
              guarantor_1_ic: null,
              guarantor_1_address: null,
              guarantor_1_sign_date: null,
              guarantor_2_zh: null,
              guarantor_2_en: null,
              guarantor_2_ic: null,
              guarantor_2_address: null,
              guarantor_2_sign_date: null,
              guarantor_2_age: null,
              guarantor_info_pic: null,
            };
            await saveLoanRecipient(core, guarantor);
          }
          if (userId) notifyStudyLoanApplicant(userId, true);
          localStorage.setItem('myHainanLoanApplications', JSON.stringify(all));
          fetchStudyLoanApplications();
          setSelectedStudyLoan(null);
          alert('Study loan application approved. Applicant will see a notification on their home.');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to approve study loan application.');
    }
  };

  const handleRejectStudyLoan = async (applicationId: string, reason: string) => {
    const app = studyLoanApplications.find(a => a.id === applicationId);
    const userId = app?.user_id;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('study_loan_applications')
          .update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', applicationId);
        if (!error) {
          if (userId) notifyStudyLoanApplicant(userId, false, reason);
          fetchStudyLoanApplications();
          setShowRejectStudyLoanDialog(false);
          setStudyLoanRejectionReason('');
          setSelectedStudyLoan(null);
          alert('Study loan application rejected. Applicant will see the reason on their status page and in notifications.');
        } else throw error;
      } else {
        const all = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        const idx = all.findIndex((a: any) => a.id === applicationId);
        if (idx !== -1) {
          all[idx].status = 'rejected';
          all[idx].rejectionReason = reason;
          if (userId) notifyStudyLoanApplicant(userId, false, reason);
          localStorage.setItem('myHainanLoanApplications', JSON.stringify(all));
          fetchStudyLoanApplications();
          setShowRejectStudyLoanDialog(false);
          setStudyLoanRejectionReason('');
          setSelectedStudyLoan(null);
          alert('Study loan application rejected. Applicant will see the reason on their status page and in notifications.');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to reject study loan application.');
    }
  };

  const openStudyLoanRejectDialog = (app: StudyLoanApplication) => {
    setSelectedStudyLoan(app);
    setStudyLoanRejectionReason('');
    setShowRejectStudyLoanDialog(true);
  };

  const viewStudyLoanDetails = (app: StudyLoanApplication) => {
    setSelectedStudyLoan(app);
  };

  const filteredStudyLoanApplications = studyLoanApplications.filter(app => {
    if (studyLoanSourceFilter === 'manual') {
      return app.source === 'manual';
    }
    // For student filled (online)
    if (studyLoanFilter !== 'all' && app.status !== studyLoanFilter) return false;
    return app.source === 'online';
  });

  const onlineApplicationCount = studyLoanApplications.filter((a) => a.source === 'online').length;
  const manualApplicationCount = studyLoanApplications.filter((a) => a.source === 'manual').length;

  const openStudyLoanDocument = async (path: string | null, label: string) => {
    if (!path) return;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.storage.from(STUDY_LOAN_BUCKET).createSignedUrl(path, 3600);
        if (error) {
          alert(`Could not open ${label}: ${error.message}`);
          return;
        }
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
      } catch (e: any) {
        alert(`Could not open ${label}: ${e?.message || 'Unknown error'}`);
      }
    } else {
      alert('Documents are stored in Supabase. Configure Supabase to open files.');
    }
  };

  const fetchLoanRecipients = async () => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('study_loan_recipients')
          .select('*, guarantors(*)')
          .order('created_at', { ascending: false });
        if (!error && data) {
          setLoanRecipients(data.map((row) => mapLoanRecipientRow(row as Record<string, unknown>)));
        }
      } else {
        const raw = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
        setLoanRecipients(raw);
      }
    } catch (e) {
      console.error('Fetch loan recipients:', e);
    }
  };

  const saveLoanRecipient = async (core: LoanRecipientCore, guarantor: GuarantorInsert) => {
    const merged: LoanRecipient = { ...core, guarantor: null };
    if (isSupabaseConfigured() && supabase) {
      // Guard against duplicates (e.g. approving the same application twice).
      const { data: existing, error: existErr } = await supabase
        .from('study_loan_recipients')
        .select('id')
        .eq('id', core.id)
        .maybeSingle();
      if (!existErr && existing) {
        return;
      }
      const { error: e1 } = await supabase.from('study_loan_recipients').insert({
        id: core.id,
        full_name_en: core.full_name_en,
        full_name_zh: core.full_name_zh ?? null,
        // Older schemas still have NOT NULL `full_name` / `courses` — mirror v2 fields so inserts succeed.
        full_name: core.full_name_en,
        courses: core.course,
        loan_type: core.loan_type,
        email: core.email,
        phone_number: core.phone_number,
        association: core.association,
        university: core.university,
        course: core.course,
        admission_date: core.admission_date || null,
        expected_graduation_date: core.expected_graduation_date || null,
        loan_amount: core.loan_amount,
        total_paid: core.total_paid ?? 0,
        status: core.status,
        offer_letter_path: core.offer_letter_path || null,
        student_ic_front_back_path: core.student_ic_front_back_path || null,
        notes: core.notes || null,
        created_at: core.created_at,
        updated_at: core.updated_at,
      });
      if (e1) throw e1;
      // Avoid relying on `.select().single()` response shape (can fail on some RLS setups).
      const { error: e2 } = await supabase.from('guarantors').insert(guarantor);
      if (e2) {
        await supabase.from('study_loan_recipients').delete().eq('id', core.id);
        throw e2;
      }
      merged.guarantor = {
        id: crypto.randomUUID(),
        ...guarantor,
        created_at: core.created_at,
        updated_at: core.updated_at,
      };
      // Record any opening paid amount as a payment row so later payment
      // recalculations (which sum study_loan_payments) don't wipe it out.
      if ((core.total_paid ?? 0) > 0) {
        const { error: e3 } = await supabase.from('study_loan_payments').insert({
          recipient_id: core.id,
          amount: core.total_paid,
          payment_date: core.created_at.slice(0, 10),
          paid_at: core.created_at,
          payment_month: null,
          receipt_path: null,
          notes: 'Opening balance (entered when student was added)',
        });
        if (e3) console.error('Failed to record opening-balance payment row:', e3);
      }
    } else {
      const gLocal: GuarantorRow = {
        id: crypto.randomUUID(),
        ...guarantor,
        created_at: core.created_at,
        updated_at: core.updated_at,
      };
      merged.guarantor = gLocal;
      const list = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
      if (list.some((r: LoanRecipient) => r.id === core.id)) {
        return;
      }
      list.unshift(merged);
      localStorage.setItem('myHainanLoanRecipients', JSON.stringify(list));
      if ((core.total_paid ?? 0) > 0) {
        const paymentsLocal = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
        paymentsLocal.push({
          id: crypto.randomUUID(),
          recipientId: core.id,
          amount: core.total_paid,
          paymentDate: core.created_at.slice(0, 10),
          paidAt: core.created_at,
          receiptName: '',
        });
        localStorage.setItem('myHainanLoanPayments', JSON.stringify(paymentsLocal));
      }
    }
    setLoanRecipients((prev) => (prev.some((r) => r.id === merged.id) ? prev : [merged, ...prev]));
  };

  const deleteLoanRecipient = async (recipient: LoanRecipient) => {
    const id = recipient.id;
    try {
      setDeletingRecipient(true);
      if (isSupabaseConfigured() && supabase) {
        // Collect storage paths before the rows are cascade-deleted.
        const storagePaths: string[] = [];
        if (recipient.offer_letter_path) storagePaths.push(recipient.offer_letter_path);
        if (recipient.student_ic_front_back_path) storagePaths.push(recipient.student_ic_front_back_path);
        if (recipient.guarantor?.guarantor_info_pic) storagePaths.push(recipient.guarantor.guarantor_info_pic);
        const { data: payRows } = await supabase
          .from('study_loan_payments')
          .select('receipt_path')
          .eq('recipient_id', id);
        for (const row of payRows || []) {
          if (row.receipt_path) storagePaths.push(row.receipt_path);
        }

        const { error } = await supabase.from('study_loan_recipients').delete().eq('id', id);
        if (error) throw error;

        // Best-effort cleanup; DB rows (payments, guarantors) cascade via FK.
        if (storagePaths.length > 0) {
          await supabase.storage.from(STUDY_LOAN_BUCKET).remove(storagePaths);
        }
      } else {
        const list = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
        const filtered = list.filter((r: LoanRecipient) => r.id !== id);
        localStorage.setItem('myHainanLoanRecipients', JSON.stringify(filtered));
        const paymentsLocal = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
        localStorage.setItem(
          'myHainanLoanPayments',
          JSON.stringify(paymentsLocal.filter((p: any) => p.recipientId !== id)),
        );
      }
      setLoanRecipients(prev => prev.filter(r => r.id !== id));
      if (selectedRecipientForDetails && selectedRecipientForDetails.id === id) {
        setSelectedRecipientForDetails(null);
        setEditRecipient(null);
      }
      setPendingDeleteRecipient(null);
      setDeleteRecipientConfirmText('');
    } catch (err: any) {
      alert(err?.message || 'Failed to delete recipient.');
    } finally {
      setDeletingRecipient(false);
    }
  };

  const validateRecipientEdit = (r: LoanRecipient): string | null => {
    if (!r.full_name_en.trim()) return 'Full name (English) is required.';
    if (!r.association.trim()) return 'Association is required.';
    if (!r.university.trim()) return 'University is required.';
    if (!r.course.trim()) return 'Course is required.';
    if (!isValidMalaysiaMobileDash(r.phone_number)) {
      return 'Phone must be a Malaysian mobile: 01X-XXXXXXX or longer (11–12 digits), e.g. 011-12345678.';
    }
    if (r.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!Number.isInteger(r.loan_amount) || r.loan_amount <= 0) {
      return 'Loan amount must be a positive whole number (RM).';
    }
    if (!Number.isInteger(r.total_paid) || r.total_paid < 0) {
      return 'Total paid must be zero or a positive whole number (RM).';
    }
    const adm = yearFieldFromStored(r.admission_date);
    const grad = yearFieldFromStored(r.expected_graduation_date);
    if (adm.length === 4 && grad.length === 4 && parseInt(adm, 10) >= parseInt(grad, 10)) {
      return 'Admission year must be before the expected graduation year.';
    }
    const g2Age = r.guarantor?.guarantor_2_age;
    if (g2Age != null && (Number.isNaN(g2Age) || g2Age < 1 || g2Age > 65)) {
      return '担保人（二）年龄须为 1–65 岁。';
    }
    return null;
  };

  const updateLoanRecipient = async (edited: LoanRecipient) => {
    if (savingRecipientEdit) return;
    const validationError = validateRecipientEdit(edited);
    if (validationError) {
      alert(validationError);
      return;
    }
    const editFileChecks: Array<[File | null, string]> = [
      [editOfferLetterFile, 'Offer letter'],
      [editStudentIcFile, 'Student IC'],
      [editDocScreenshotFile, '文件截图'],
    ];
    for (const [file, label] of editFileChecks) {
      if (!file) continue;
      const fileError = validateUploadFile(file, label);
      if (fileError) {
        alert(fileError);
        return;
      }
    }
    // Keep status consistent with the numbers (matches Record payment behaviour).
    const updated: LoanRecipient =
      edited.total_paid >= edited.loan_amount && edited.status !== 'completed'
        ? { ...edited, status: 'completed' }
        : edited;
    try {
      setSavingRecipientEdit(true);
      if (isSupabaseConfigured() && supabase) {
        const client = supabase;
        const upload = async (file: File | null, pathKey: string): Promise<string | null> => {
          if (!file) return null;
          const ext = file.name.split('.').pop() || 'bin';
          const path = `recipients/${updated.id}/${pathKey}.${ext}`;
          const { error } = await client.storage.from(STUDY_LOAN_BUCKET).upload(path, file, { upsert: true });
          if (error) throw error;
          return path;
        };
        const newOfferPath = await upload(editOfferLetterFile, 'offer_letter');
        const newStudentIcPath = await upload(editStudentIcFile, 'student_ic');
        const newDocScreenshotPath = await upload(editDocScreenshotFile, 'guarantor_info_pic');

        const { error } = await client.from('study_loan_recipients').update({
          full_name_en: updated.full_name_en,
          full_name_zh: updated.full_name_zh ?? null,
          full_name: updated.full_name_en,
          courses: updated.course,
          loan_type: updated.loan_type,
          email: updated.email,
          phone_number: updated.phone_number,
          association: updated.association,
          university: updated.university,
          course: updated.course,
          admission_date: updated.admission_date || null,
          expected_graduation_date: updated.expected_graduation_date || null,
          loan_amount: updated.loan_amount,
          total_paid: updated.total_paid,
          status: updated.status,
          offer_letter_path: newOfferPath || updated.offer_letter_path || null,
          student_ic_front_back_path: newStudentIcPath || updated.student_ic_front_back_path || null,
          notes: updated.notes || null,
          updated_at: new Date().toISOString(),
        }).eq('id', updated.id);
        if (error) throw error;

        const g = updated.guarantor ?? emptyGuarantorRow(updated.id);
        const gPayload: Record<string, unknown> = {
          student_id: updated.id,
          guarantor_1_zh: g.guarantor_1_zh,
          guarantor_1_en: g.guarantor_1_en,
          guarantor_1_ic: g.guarantor_1_ic,
          guarantor_1_address: g.guarantor_1_address,
          guarantor_1_sign_date: g.guarantor_1_sign_date,
          guarantor_2_zh: g.guarantor_2_zh,
          guarantor_2_en: g.guarantor_2_en,
          guarantor_2_ic: g.guarantor_2_ic,
          guarantor_2_address: g.guarantor_2_address,
          guarantor_2_sign_date: g.guarantor_2_sign_date,
          guarantor_2_age: g.guarantor_2_age,
          guarantor_info_pic: newDocScreenshotPath || g.guarantor_info_pic,
          updated_at: new Date().toISOString(),
        };
        if (g.id) gPayload.id = g.id;
        const { error: gErr } = await client.from('guarantors').upsert(gPayload, { onConflict: 'student_id' });
        if (gErr) throw gErr;
      } else {
        const list = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
        const idx = list.findIndex((r: LoanRecipient) => r.id === updated.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updated, updated_at: new Date().toISOString() };
          localStorage.setItem('myHainanLoanRecipients', JSON.stringify(list));
        }
      }
      setLoanRecipients(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
      setSelectedRecipientForDetails(null);
      setEditRecipient(null);
      setEditOfferLetterFile(null);
      setEditStudentIcFile(null);
      setEditDocScreenshotFile(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update recipient.');
    } finally {
      setSavingRecipientEdit(false);
    }
  };

  // record payments now handled by RecordLoanPaymentsPage


  const handleApproveEvent = async (eventId: string) => {
    try {
      // Frontend-only: Update in localStorage
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const index = events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) {
        events[index].status = 'approved';
        // Ensure maxCapacity and currentParticipants are set
        if (!events[index].maxCapacity) {
          events[index].maxCapacity = 100; // Default if not set
        }
        if (!events[index].currentParticipants) {
          events[index].currentParticipants = 0;
        }
        localStorage.setItem('myHainanEvents', JSON.stringify(events));
        fetchPendingEvents();
        alert('Event approved successfully!');
      }
    } catch (error) {
      console.error('Error approving event:', error);
      alert('Failed to approve event');
    }
  };

  const handleUpdateMaxCapacity = async (eventId: string) => {
    try {
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const index = events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) {
        events[index].maxCapacity = parseInt(editMaxCapacity) || 0;
        localStorage.setItem('myHainanEvents', JSON.stringify(events));
        fetchPendingEvents();
        setEditingEvent(null);
        setEditMaxCapacity('');
        alert('Max capacity updated successfully!');
      }
    } catch (error) {
      console.error('Error updating max capacity:', error);
      alert('Failed to update max capacity');
    }
  };

  const openEditCapacityDialog = (event: Event) => {
    setEditingEvent(event);
    setEditMaxCapacity(event.maxCapacity?.toString() || '');
  };


  const handleRejectEvent = async (eventId: string, comment: string) => {
    try {
      // Frontend-only: Update in localStorage
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const index = events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) {
        events[index].status = 'rejected';
        events[index].rejectionComment = comment;
        localStorage.setItem('myHainanEvents', JSON.stringify(events));
        fetchPendingEvents();
        setShowRejectDialog(false);
        setRejectionReason('');
        setSelectedEventForReject(null);
        alert('Event rejected. The Sub Editor will see the rejection reason in their dashboard.');
      }
    } catch (error) {
      console.error('Error rejecting event:', error);
      alert('Failed to reject event');
    }
  };


  const openRejectDialog = (eventId: string) => {
    setSelectedEventForReject(eventId);
    setRejectionReason('');
    setShowRejectDialog(true);
  };


  const submitRejection = () => {
    if (!selectedEventForReject) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    handleRejectEvent(selectedEventForReject, rejectionReason);
  };


  const handleCreateAssociation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);


    try {
      // Frontend-only: Save to localStorage
      const associations = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
      const newAssoc = {
        ...newAssociation,
        state: newAssociation.location,
        committeeMembers: [],
        createdAt: new Date().toISOString(),
      };
      associations.push(newAssoc);
      localStorage.setItem('myHainanAssociations', JSON.stringify(associations));


      setNewAssociation({ id: '', name: '', location: '' });
      fetchAssociations();
      alert('Association created successfully!');
    } catch (error) {
      console.error('Error creating association:', error);
      alert('Failed to create association');
    } finally {
      setLoading(false);
    }
  };


  const [selectedAssociationForExport, setSelectedAssociationForExport] = useState<string>('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedEventForReject, setSelectedEventForReject] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');


  const generateExcelReport = (associationId?: string) => {
    if (associationId) {
      // Generate report for specific association
      const assoc = associations.find((a) => a.id === associationId);
      if (!assoc) {
        alert('Association not found');
        return;
      }


      // Use association name for both Association Name and Location
      const associationName = assoc.name || assoc.id;

      // Prepare worksheet data with headers
      const worksheetData: any[][] = [
        ['Association Name', 'Location', 'Name', 'Title', 'Category'],
      ];


      // Add committee members data if available
      if (assoc.committeeMembers && assoc.committeeMembers.length > 0) {
        assoc.committeeMembers.forEach((member: any) => {
          worksheetData.push([
            associationName,
            associationName, // Location same as Association Name
            member.name || '',
            member.title || member.role || '', // Use title if available, fallback to role
            member.category || '', // Optional category field
          ]);
        });
      }
      // If no committee members, worksheetData will only have headers (empty file)


      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Committee Members');


      // Clean filename but preserve .xlsx extension (not _xlsx)
      // Remove special characters but keep alphanumeric, spaces, and hyphens
      let cleanName = (assoc.name || assoc.id).replace(/[^a-z0-9\s-]/gi, '').trim();
      // Replace spaces with underscores
      cleanName = cleanName.replace(/\s+/g, '_');
      // Ensure we have a valid name
      if (!cleanName) cleanName = 'Association';
      // Ensure .xlsx extension (not _xlsx)
      const fileName = `${cleanName}_Committee_List.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } else {
      // Generate consolidated report (old behavior)
      const worksheetData = [
        ['Association ID', 'Association Name', 'Location'],
        ...associations.map((assoc) => [assoc.id, assoc.name, assoc.location]),
      ];


      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Associations');


      XLSX.writeFile(workbook, 'AGM_Committee_List.xlsx');
    }
  };


  const handleDownloadSelected = () => {
    if (!selectedAssociationForExport) {
      alert('Please select an association to download');
      return;
    }
    generateExcelReport(selectedAssociationForExport);
  };

  const handleApproveWelfare = async (applicationId: string) => {
    try {
      const allApplications = JSON.parse(localStorage.getItem('myHainanWelfareApplications') || '[]');
      const index = allApplications.findIndex((a: any) => a.id === applicationId);
      
      if (index !== -1) {
        allApplications[index].status = 'approved';
        localStorage.setItem('myHainanWelfareApplications', JSON.stringify(allApplications));
        fetchWelfareApplications();

        // Notify the applicant
        const notifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
        notifications.push({
          id: Date.now().toString() + '_' + allApplications[index].userId,
          userId: allApplications[index].userId,
          title: 'Welfare Application Approved',
          message: `Your welfare application has been approved. You will be contacted soon.`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'system',
        });

        // Notify the recommended sub-association if applicable
        if (allApplications[index].recommendedBySubAssociation) {
          // Create notification for the sub-association
          // In a real system, this would be sent to all sub_admin users of that association
          const subAssocNotification = {
            id: Date.now().toString() + '_sub_admin_' + allApplications[index].recommendedBySubAssociation,
            userId: 'sub_admin_' + allApplications[index].recommendedBySubAssociation, // Special marker for sub-association notifications
            title: 'Welfare Application Approved',
            message: `A welfare application you recommended from ${allApplications[index].applicantNameEnglish || allApplications[index].applicantNameChinese} has been approved by the General Association.`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'system',
            associationName: allApplications[index].recommendedBySubAssociation,
          };
          
          notifications.push(subAssocNotification);
        }

        localStorage.setItem('myHainanNotifications', JSON.stringify(notifications));
        alert('Welfare application approved successfully!');
      }
    } catch (error) {
      console.error('Error approving welfare application:', error);
      alert('Failed to approve welfare application');
    }
  };

  const handleRejectWelfare = async (applicationId: string, reason: string) => {
    try {
      const allApplications = JSON.parse(localStorage.getItem('myHainanWelfareApplications') || '[]');
      const index = allApplications.findIndex((a: any) => a.id === applicationId);
      
      if (index !== -1) {
        allApplications[index].status = 'rejected';
        allApplications[index].rejectionReason = reason;
        localStorage.setItem('myHainanWelfareApplications', JSON.stringify(allApplications));
        fetchWelfareApplications();

        // Notify the applicant
        const notifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
        notifications.push({
          id: Date.now().toString() + '_' + allApplications[index].userId,
          userId: allApplications[index].userId,
          title: 'Welfare Application Rejected',
          message: `Your welfare application has been rejected. Reason: ${reason}`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'system',
        });
        localStorage.setItem('myHainanNotifications', JSON.stringify(notifications));

        setShowRejectWelfareDialog(false);
        setWelfareRejectionReason('');
        setSelectedWelfareApp(null);
        alert('Welfare application rejected.');
      }
    } catch (error) {
      console.error('Error rejecting welfare application:', error);
      alert('Failed to reject welfare application');
    }
  };

  const openWelfareRejectDialog = (application: WelfareApplication) => {
    setSelectedWelfareApp(application);
    setWelfareRejectionReason('');
    setShowRejectWelfareDialog(true);
  };

  const viewWelfareDetails = (application: WelfareApplication) => {
    setSelectedWelfareApp(application);
  };

  const downloadWelfareDocument = (base64Data: string, filename: string) => {
    if (!base64Data) {
      alert('Document not available');
      return;
    }
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = filename;
    link.click();
  };

  const filteredWelfareApplications = welfareApplications.filter(app => {
    if (welfareFilter === 'all') return true;
    return app.status === welfareFilter;
  });


  if (showAddStudyLoanPage || editingStudyLoan) {
    return (
      <AddStudyLoanApplicationPage
        initialApplication={editingStudyLoan ?? undefined}
        onBack={() => {
          setShowAddStudyLoanPage(false);
          setEditingStudyLoan(null);
          setActiveTab('studyLoans');
        }}
        onSaved={(app) => {
          setStudyLoanApplications((prev) => [app, ...prev.filter((a) => a.id !== app.id)]);
          setEditingStudyLoan(null);
          setShowAddStudyLoanPage(false);
          fetchStudyLoanApplications();
        }}
      />
    );
  }

  if (showAddRecipientPage) {
    return (
      <AddLoanRecipientPage
        onBack={() => {
          setShowAddRecipientPage(false);
          setActiveTab('recipients');
        }}
        onSubmit={saveLoanRecipient}
      />
    );
  }

  if (recordPaymentsRecipient) {
    return (
      <RecordLoanPaymentsPage
        recipient={recordPaymentsRecipient}
        onBack={() => {
          setRecordPaymentsRecipient(null);
          setActiveTab('recipients');
          fetchLoanRecipients();
        }}
        onTotalsUpdated={(updated) => {
          setLoanRecipients((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }}
      />
    );
  }

  if (showLoanStats) {
    return (
      <LoanRecipientsStatsPage
        recipients={loanRecipients}
        onBack={() => {
          setShowLoanStats(false);
          setActiveTab('recipients');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-bold text-2xl">Super Admin Dashboard</h1>
            <p className="text-sm text-gray-600">总会管理中心</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={signOut} className="bg-white border border-black text-black hover:bg-gray-50 rounded-md shadow-none">
              Sign Out
            </Button>
          </div>
        </div>
      </div>


      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'studyLoans' | 'recipients')} className="space-y-6">
          <TabsList className="flex w-full max-w-xl h-auto bg-transparent p-0 gap-6 border-b border-black rounded-none">
            <TabsTrigger
              value="studyLoans"
              className="rounded-full border-2 border-transparent bg-transparent px-6 py-2 text-base font-medium text-black shadow-none data-[state=active]:border-black data-[state=active]:bg-white data-[state=active]:shadow-none"
            >
              Study Loan Applications
            </TabsTrigger>
            <TabsTrigger
              value="recipients"
              className="rounded-full border-2 border-transparent bg-transparent px-6 py-2 text-base font-medium text-black shadow-none data-[state=active]:border-black data-[state=active]:bg-white data-[state=active]:shadow-none"
            >
              Loan Recipients
            </TabsTrigger>
          </TabsList>

          {/* Event Approval Tab - commented out */}
          {false && (
            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Events for Approval</CardTitle>
                  <CardDescription>
                    Review and approve/reject events submitted by Sub-Associations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingEvents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No pending events to review
                    </div>
                  ) : (
                    pendingEvents.map((event: any) => (
                      <Card key={event.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-2">{event.title}</h3>
                              {event.associationName && (
                                <div className="mb-2">
                                  <Badge variant="outline" className="bg-blue-50">
                                    <Building2 className="w-3 h-3 mr-1" />
                                    {event.associationName}
                                  </Badge>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                                <div>Date: {event.date}</div>
                                <div>Time: {event.time}</div>
                                <div>Venue: {event.venue}</div>
                                <div>Price: RM {event.price}</div>
                                <div>Max Capacity: {event.maxCapacity || 'Not set'}</div>
                                <div>Current Participants: {event.currentParticipants || 0}</div>
                              </div>
                              {event.maxCapacity && (
                                <div className="mb-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditCapacityDialog(event)}
                                  >
                                    Edit Max Capacity
                                  </Button>
                                </div>
                              )}
                              <p className="text-sm text-gray-700 mb-3">{event.description}</p>
                              <Badge variant="outline">Submitted: {new Date(event.createdAt).toLocaleDateString()}</Badge>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleApproveEvent(event.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => openRejectDialog(event.id)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Study Loan Applications Tab */}
          <TabsContent value="studyLoans">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Study Loan Applications
                  </CardTitle>
                  <CardDescription>
                    Manage both paper applications filled by administrators and online applications submitted by students.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Admin Filled / Student Filled toggle */}
                <div className="flex flex-wrap items-center gap-6 border-b border-gray-200 pb-4">
                  <Button
                    variant="ghost"
                    className={`h-auto rounded-full px-6 py-2.5 text-base font-medium transition-all ${
                      studyLoanSourceFilter === 'manual'
                        ? 'border-2 border-black bg-white text-black shadow-none hover:bg-white'
                        : 'border-0 bg-transparent text-black shadow-none hover:bg-transparent hover:text-gray-500'
                    }`}
                    onClick={() => setStudyLoanSourceFilter('manual')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Admin Filled
                    <span className="ml-2 text-xs font-normal text-gray-500">({manualApplicationCount})</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className={`h-auto rounded-full px-6 py-2.5 text-base font-medium transition-all ${
                      studyLoanSourceFilter === 'online'
                        ? 'border-2 border-black bg-white text-black shadow-none hover:bg-white'
                        : 'border-0 bg-transparent text-black shadow-none hover:bg-transparent hover:text-gray-500'
                    }`}
                    onClick={() => setStudyLoanSourceFilter('online')}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Student Filled
                    <span className="ml-2 text-xs font-normal text-gray-500">({onlineApplicationCount})</span>
                  </Button>
                </div>

                {/* Admin Filled Section */}
                {studyLoanSourceFilter === 'manual' && (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-blue-50 border border-blue-100 p-4 rounded-lg gap-4">
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold">Admin Filled Applications (纸张表格)</p>
                      <p className="text-xs text-blue-800/80">Enter and manage paper application forms submitted by affiliate associations.</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => { setActiveTab('studyLoans'); setShowAddStudyLoanPage(true); }}
                      className="bg-white border border-black text-black hover:bg-gray-50 rounded-md shadow-none"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Add paper application
                    </Button>
                  </div>
                )}

                {/* Student Filled Section */}
                {studyLoanSourceFilter === 'online' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                      <p className="font-semibold text-blue-900 text-sm">Student Filled Applications (线上申请)</p>
                      <p className="text-xs text-blue-800/80">These applications are submitted online by students/members through the public portal and automatically flow here for review.</p>
                    </div>

                    {/* Status Filter Buttons */}
                    <div className="flex gap-4 border-b border-gray-200 pb-4 flex-wrap">
                      {([
                        ['all', 'All', studyLoanApplications.filter(a => a.source === 'online').length],
                        ['pending', 'Pending', studyLoanApplications.filter(a => a.source === 'online' && a.status === 'pending').length],
                        ['approved', 'Approved', studyLoanApplications.filter(a => a.source === 'online' && a.status === 'approved').length],
                        ['rejected', 'Rejected', studyLoanApplications.filter(a => a.source === 'online' && a.status === 'rejected').length],
                      ] as const).map(([key, label, count]) => (
                        <Button
                          key={key}
                          variant="ghost"
                          size="sm"
                          onClick={() => setStudyLoanFilter(key)}
                          className={`h-auto rounded-full px-4 py-1.5 text-sm font-medium ${
                            studyLoanFilter === key
                              ? 'border-2 border-black bg-white text-black shadow-none hover:bg-white'
                              : 'border-0 bg-transparent text-black shadow-none hover:bg-transparent hover:text-gray-500'
                          }`}
                        >
                          {label} ({count})
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {filteredStudyLoanApplications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No study loan applications found
                  </div>
                ) : (
                  <div className={studyLoanSourceFilter === 'manual' ? 'space-y-3' : 'space-y-3'}>
                    {filteredStudyLoanApplications.map((app) => {
                      if (studyLoanSourceFilter === 'manual') {
                        const annualAmount = app.loan_amount || 0;
                        const admissionYear = (app.admission_date || '').toString().slice(0, 4);
                        const graduationYear = (app.expected_graduation_date || '').toString().slice(0, 4);
                        const loanTypeLabel = studyLoanAnnualDisplayLabel(app.loan_type, annualAmount);

                        return (
                          <Card key={app.id}>
                            <CardContent className="p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-lg truncate">{app.full_name}</h3>
                                    <Badge variant="secondary" className={studyLoanStatusBadgeClass(app.status)}>
                                      {app.status}
                                    </Badge>
                                  </div>
                                  {app.full_name_zh?.trim() ? (
                                    <p className="text-sm text-gray-600">{app.full_name_zh.trim()}</p>
                                  ) : null}
                                  <p className="text-xs text-blue-800">Loan type: {loanTypeLabel}</p>

                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                    <span className="truncate max-w-[12rem] sm:max-w-none">{app.university}</span>
                                    <span className="truncate max-w-[12rem] sm:max-w-none">{app.courses || '—'}</span>
                                  </div>

                                  {(admissionYear || graduationYear) && (
                                    <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
                                      <span className="font-medium">Study period:</span>{' '}
                                      {admissionYear || '—'} to {graduationYear || '—'}
                                    </div>
                                  )}

                                  <div className="hidden sm:grid grid-cols-2 gap-2 text-xs text-gray-500">
                                    <span className="truncate">Association: {app.association || '—'}</span>
                                    <span className="truncate">Phone: {app.phone_number || '—'}</span>
                                  </div>
                                  <div className="sm:hidden text-xs text-gray-500 space-y-0.5">
                                    <div className="truncate">Association: {app.association || '—'}</div>
                                    <div className="truncate">Phone: {app.phone_number || '—'}</div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 shrink-0">
                                  <Button size="sm" variant="outline" onClick={() => viewStudyLoanDetails(app)}>
                                    <Eye className="w-4 h-4 mr-1" />
                                    View Details
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingStudyLoan(app);
                                      setSelectedStudyLoan(null);
                                    }}
                                  >
                                    <Pencil className="w-4 h-4 mr-1" />
                                    Edit
                                  </Button>
                                  {app.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() => handleApproveStudyLoan(app.id)}
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                        onClick={() => openStudyLoanRejectDialog(app)}
                                      >
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }

                      return (
                    <Card key={app.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-semibold text-lg truncate">{app.full_name}</h3>
                              {app.full_name_zh?.trim() ? (
                                <span className="text-sm text-gray-600 truncate">{app.full_name_zh.trim()}</span>
                              ) : null}
                              <Badge
                                variant="outline"
                                className={app.source === 'manual' ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-sky-50 text-sky-800 border-sky-200'}
                              >
                                {studyLoanSourceLabel(app.source)}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={
                                  app.status === 'approved'
                                    ? 'bg-green-600'
                                    : app.status === 'rejected'
                                      ? 'bg-red-600'
                                      : 'bg-yellow-600'
                                }
                              >
                                {app.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                              <div>{app.university}</div>
                              <div>RM {app.loan_amount?.toLocaleString()}</div>
                              <div className="col-span-2">
                                <Badge variant="outline" className="bg-blue-50">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  {app.association}
                                </Badge>
                              </div>
                            </div>
                            <Badge variant="outline">
                              Applied: {new Date(app.applied_at).toLocaleDateString()}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-2 ml-4 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewStudyLoanDetails(app)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                            {app.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApproveStudyLoan(app.id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => openStudyLoanRejectDialog(app)}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loan Recipients Tab - manual entry to track repayment (for future notifications) */}
          <TabsContent value="recipients">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      Loan Recipients
                    </CardTitle>
                    <CardDescription>
                      Manually add students who received the study loan to track repayment progress. Data is used for notifications later.
                    </CardDescription>
                  </div>
                  <div className="ml-auto w-full sm:w-auto">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => { setActiveTab('recipients'); setShowNotificationDialog(true); }}
                        className="bg-white border border-black text-black hover:bg-gray-50 rounded-md shadow-none"
                      >
                        Send notifications
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setActiveTab('recipients'); setShowAddRecipientPage(true); }}
                        className="bg-white border border-black text-black hover:bg-gray-50 rounded-md shadow-none"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add student
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setActiveTab('recipients'); setShowLoanStats(true); }}
                        className="bg-white border border-black text-black hover:bg-gray-50 rounded-md shadow-none"
                      >
                        Overall stats
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  Starting July 2025, study-loan amounts were revised: Degree and TVET/Vocational increased from RM 3,000 to RM 4,000, and Master/PhD increased from RM 5,000 to RM 6,000.
                </div>
                {loanRecipients.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No loan recipients yet.</p>
                    <p className="text-sm mt-1">Click &quot;Add student&quot; to enter students who received the study loan.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {loanRecipients.map((r) => {
                      const remaining = Math.max(0, r.loan_amount - r.total_paid);
                      const progressRaw = r.loan_amount > 0 ? (r.total_paid / r.loan_amount) * 100 : 0;
                      const progress = Math.min(100, Math.max(0, progressRaw));
                      const admissionYear = (r.admission_date || '').toString().slice(0, 4);
                      const graduationYear = (r.expected_graduation_date || '').toString().slice(0, 4);
                      const loanTypeLabel = LOAN_TYPE_LABELS[r.loan_type || ''] || r.loan_type || '-';
                      return (
                        <Card key={r.id}>
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-lg truncate">{r.full_name_en}</h3>
                                  <Badge
                                    variant={r.status === 'completed' ? 'default' : 'secondary'}
                                    className={r.status === 'completed' ? 'bg-green-600' : 'bg-amber-600'}
                                  >
                                    {r.status}
                                  </Badge>
                                </div>
                                {r.full_name_zh?.trim() ? (
                                  <p className="text-sm text-gray-600">{r.full_name_zh.trim()}</p>
                                ) : null}
                                <p className="text-xs text-blue-800">Loan type: {loanTypeLabel}</p>

                                {/* Mobile-first essential info */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                  <span className="truncate max-w-[12rem] sm:max-w-none">{r.university}</span>
                                  <span className="truncate max-w-[12rem] sm:max-w-none">{r.course || '-'}</span>
                                </div>
                                {(admissionYear || graduationYear) && (
                                  <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
                                    <span className="font-medium">Study period:</span>{' '}
                                    {admissionYear || '—'} to {graduationYear || '—'}
                                  </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <div className="text-xs text-gray-500">Total loan applied</div>
                                    <div className="font-medium">RM {r.loan_amount.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Paid</div>
                                    <div className="font-medium">RM {r.total_paid.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Remaining</div>
                                    <div className="font-medium">RM {remaining.toLocaleString()}</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-green-600 rounded-full" style={{ width: `${progress}%` }} />
                                    </div>
                                  </div>
                                  <div className="text-sm font-medium whitespace-nowrap">{Math.round(progress)}%</div>
                                </div>

                                {/* Desktop-only: hide noisy info on phone */}
                                <div className="hidden sm:grid grid-cols-2 gap-2 text-xs text-gray-500">
                                  <span className="truncate">Association: {r.association || '-'}</span>
                                  <span className="truncate">Phone: {r.phone_number || '-'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 shrink-0 relative z-10">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedRecipientForDetails(r);
                                    setEditRecipient({
                                      ...r,
                                      guarantor: r.guarantor ?? emptyGuarantorRow(r.id),
                                    });
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View / Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRecordPaymentsRecipient(r);
                                  }}
                                >
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  {r.status === 'active' && remaining > 0 ? 'Record payment' : 'Payments'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-red-700 border-red-200 hover:bg-red-50 col-span-2 sm:col-span-1"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPendingDeleteRecipient(r);
                                    setDeleteRecipientConfirmText('');
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Welfare Applications Tab - commented out */}
          {false && (
            <TabsContent value="welfare">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5" />
                    Welfare Fund Applications
                  </CardTitle>
                  <CardDescription>
                    Review and approve/reject welfare fund applications from members
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 border-b pb-4">
                    <Button variant={welfareFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setWelfareFilter('all')}>All ({welfareApplications.length})</Button>
                    <Button variant={welfareFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setWelfareFilter('pending')}>Pending ({welfareApplications.filter(a => a.status === 'pending').length})</Button>
                    <Button variant={welfareFilter === 'approved' ? 'default' : 'outline'} size="sm" onClick={() => setWelfareFilter('approved')}>Approved ({welfareApplications.filter(a => a.status === 'approved').length})</Button>
                    <Button variant={welfareFilter === 'rejected' ? 'default' : 'outline'} size="sm" onClick={() => setWelfareFilter('rejected')}>Rejected ({welfareApplications.filter(a => a.status === 'rejected').length})</Button>
                  </div>
                  {filteredWelfareApplications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No welfare applications found</div>
                  ) : (
                    filteredWelfareApplications.map((application) => (
                      <Card key={application.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">{application.applicantNameEnglish || application.applicantNameChinese}</h3>
                                <Badge variant={application.status === 'approved' ? 'default' : application.status === 'rejected' ? 'destructive' : 'secondary'} className={application.status === 'approved' ? 'bg-green-600' : application.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-600'}>
                                  {application.status === 'approved' ? 'Approved' : application.status === 'rejected' ? 'Rejected' : 'Pending'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                                <div>IC Number: {application.icNumber}</div>
                                <div>Age: {application.age}</div>
                                <div>Gender: {application.gender}</div>
                                <div>Membership #: {application.membershipNumber || 'N/A'}</div>
                                <div>Occupation: {application.occupation || 'N/A'}</div>
                                <div>Monthly Income: RM {application.monthlyIncome || '0'}</div>
                                <div>Phone: {application.mobilePhone || application.homePhone || 'N/A'}</div>
                                <div>Request Type: {application.requestType === 'general_welfare' ? 'General Welfare Fund' : 'Sub-Association Donation'}</div>
                                {application.recommendedBySubAssociation && (
                                  <div className="col-span-2">
                                    <Badge variant="outline" className="bg-blue-50"><Building2 className="w-3 h-3 mr-1" />Recommended by: {application.recommendedBySubAssociation}</Badge>
                                  </div>
                                )}
                              </div>
                              {application.applicationReason && (
                                <div className="mb-3">
                                  <p className="text-sm font-semibold mb-1">Application Reason:</p>
                                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{application.applicationReason.substring(0, 200)}{application.applicationReason.length > 200 ? '...' : ''}</p>
                                </div>
                              )}
                              <div className="flex gap-2 mb-2">
                                {application.medicalDocument && (
                                  <Button size="sm" variant="outline" onClick={() => downloadWelfareDocument(application.medicalDocument!, 'medical_document.pdf')}><FileDown className="w-3 h-3 mr-1" />Medical Doc</Button>
                                )}
                                {application.recommendationLetter && (
                                  <Button size="sm" variant="outline" onClick={() => downloadWelfareDocument(application.recommendationLetter!, 'recommendation_letter.pdf')}><FileDown className="w-3 h-3 mr-1" />Recommendation Letter</Button>
                                )}
                              </div>
                              <Badge variant="outline">Submitted: {new Date(application.submittedAt).toLocaleDateString()}</Badge>
                              {application.status === 'rejected' && application.rejectionReason && (
                                <div className="mt-3 bg-red-50 border border-red-200 p-3 rounded">
                                  <p className="text-sm font-semibold text-red-900 mb-1">Rejection Reason:</p>
                                  <p className="text-sm text-red-800">{application.rejectionReason}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 ml-4">
                              <Button size="sm" variant="outline" onClick={() => viewWelfareDetails(application)}><Eye className="w-4 h-4 mr-1" />View Details</Button>
                              {application.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveWelfare(application.id)}><CheckCircle className="w-4 h-4 mr-1" />Approve</Button>
                                  <Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => openWelfareRejectDialog(application)}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Associations Tab - commented out */}
          {false && (
            <TabsContent value="associations">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Create New Association</CardTitle>
                    <CardDescription>Add a new Sub-Association (分会)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateAssociation} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="assoc-id">Association ID</Label>
                        <Input id="assoc-id" placeholder="e.g., selangor_01" value={newAssociation.id} onChange={(e) => setNewAssociation({ ...newAssociation, id: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assoc-name">Association Name</Label>
                        <Input id="assoc-name" placeholder="Selangor Hainan Association" value={newAssociation.name} onChange={(e) => setNewAssociation({ ...newAssociation, name: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assoc-location">Location</Label>
                        <Input id="assoc-location" placeholder="Selangor" value={newAssociation.location} onChange={(e) => setNewAssociation({ ...newAssociation, location: e.target.value })} required />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating...' : 'Create Association'}</Button>
                    </form>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Existing Associations</CardTitle>
                    <CardDescription>{associations.length} total associations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                    {associations.map((assoc) => (
                      <Card key={assoc.id}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-gray-400" />
                          <div className="flex-1">
                            <div className="font-medium">{assoc.name}</div>
                            <div className="text-sm text-gray-500">{assoc.location}</div>
                          </div>
                          <Badge variant="outline">{assoc.id}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Export Data Tab - commented out */}
          {false && (
            <TabsContent value="export">
              <Card>
                <CardHeader>
                  <CardTitle>Export Master Data</CardTitle>
                  <CardDescription>Generate Excel reports per association based on sub admin submissions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-lg">Export Association Report</h3>
                        <p className="text-sm text-gray-600">Download Excel file for a specific association</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="association-select">Select Association</Label>
                        <Select value={selectedAssociationForExport} onValueChange={setSelectedAssociationForExport}>
                          <SelectTrigger id="association-select" className="w-full">
                            <SelectValue placeholder="Choose an association to download" />
                          </SelectTrigger>
                          <SelectContent>
                            {associations.length === 0 ? (
                              <SelectItem value="none" disabled>No associations available</SelectItem>
                            ) : (
                              associations.map((assoc) => (
                                <SelectItem key={assoc.id} value={assoc.id}>
                                  {assoc.name || assoc.id} {assoc.location ? `- ${assoc.location}` : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-600">{associations.length} association(s) available for export</p>
                      </div>
                      <Button className="w-full" onClick={handleDownloadSelected} disabled={!selectedAssociationForExport || associations.length === 0}>
                        <Download className="w-4 h-4 mr-2" />
                        Download Selected Association Report
                      </Button>
                      <div className="bg-white rounded p-3 text-xs text-gray-700">
                        <p className="font-semibold mb-1">Excel Format:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Association Name | Location | Name | Title | Category (optional)</li>
                          <li>One row per committee member</li>
                          <li>File name: [Association Name]_Committee_List.xlsx</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <FileText className="w-8 h-8 text-green-600 mb-2" />
                    <h3 className="font-semibold mb-1">Consolidated Report</h3>
                    <p className="text-sm text-gray-600 mb-3">Generate a consolidated list of all associations</p>
                    <Button className="w-full" variant="outline" onClick={() => generateExcelReport()}>Generate Consolidated Report</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>


      {/* Edit Max Capacity Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Max Capacity</DialogTitle>
            <DialogDescription>
              Update the maximum capacity for this event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="max-capacity">Maximum Capacity *</Label>
              <Input
                id="max-capacity"
                type="number"
                min="1"
                value={editMaxCapacity}
                onChange={(e) => setEditMaxCapacity(e.target.value)}
                placeholder="Enter max capacity"
                required
              />
              {editingEvent && (
                <p className="text-xs text-gray-500">
                  Current: {editingEvent.maxCapacity || 'Not set'} |
                  Participants: {editingEvent.currentParticipants || 0}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingEvent(null);
              setEditMaxCapacity('');
            }}>
              Cancel
            </Button>
            <Button onClick={() => editingEvent && handleUpdateMaxCapacity(editingEvent.id)}>
              Update Capacity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Event Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Event</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this event. The Sub Editor will see this reason in their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter the reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="bg-white border-gray-300"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectDialog(false);
              setRejectionReason('');
              setSelectedEventForReject(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitRejection}>
              Reject Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Welfare Application Details Dialog */}
      <Dialog open={!!selectedWelfareApp && !showRejectWelfareDialog} onOpenChange={(open) => !open && setSelectedWelfareApp(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedWelfareApp && (
            <>
              <DialogHeader>
                <DialogTitle>Welfare Application Details</DialogTitle>
                <DialogDescription>
                  Full application information for {selectedWelfareApp.applicantNameEnglish || selectedWelfareApp.applicantNameChinese}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <h3 className="font-semibold mb-2">Applicant Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Chinese Name:</strong> {selectedWelfareApp.applicantNameChinese}</div>
                    <div><strong>English Name:</strong> {selectedWelfareApp.applicantNameEnglish}</div>
                    <div><strong>IC Number:</strong> {selectedWelfareApp.icNumber}</div>
                    <div><strong>Age:</strong> {selectedWelfareApp.age}</div>
                    <div><strong>Gender:</strong> {selectedWelfareApp.gender}</div>
                    <div><strong>Membership #:</strong> {selectedWelfareApp.membershipNumber || 'N/A'}</div>
                    <div><strong>Join Date:</strong> {selectedWelfareApp.joinDate || 'N/A'}</div>
                    <div><strong>Occupation:</strong> {selectedWelfareApp.occupation || 'N/A'}</div>
                    <div><strong>Monthly Income:</strong> RM {selectedWelfareApp.monthlyIncome || '0'}</div>
                    <div><strong>Address:</strong> {selectedWelfareApp.address || 'N/A'}</div>
                    <div><strong>Postcode:</strong> {selectedWelfareApp.postcode || 'N/A'}</div>
                    <div><strong>Home Phone:</strong> {selectedWelfareApp.homePhone || 'N/A'}</div>
                    <div><strong>Mobile Phone:</strong> {selectedWelfareApp.mobilePhone || 'N/A'}</div>
                  </div>
                </div>

                {(selectedWelfareApp.spouseNameChinese || selectedWelfareApp.spouseNameEnglish) && (
                  <div>
                    <h3 className="font-semibold mb-2">Spouse Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><strong>Chinese Name:</strong> {selectedWelfareApp.spouseNameChinese || 'N/A'}</div>
                      <div><strong>English Name:</strong> {selectedWelfareApp.spouseNameEnglish || 'N/A'}</div>
                      <div><strong>Age:</strong> {selectedWelfareApp.spouseAge || 'N/A'}</div>
                      <div><strong>Occupation:</strong> {selectedWelfareApp.spouseOccupation || 'N/A'}</div>
                      <div><strong>Monthly Income:</strong> RM {selectedWelfareApp.spouseMonthlyIncome || '0'}</div>
                    </div>
                  </div>
                )}

                {selectedWelfareApp.children && selectedWelfareApp.children.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Children</h3>
                    <div className="space-y-2">
                      {selectedWelfareApp.children.map((child: any, index: number) => (
                        <div key={index} className="border p-2 rounded text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div><strong>Name:</strong> {child.name}</div>
                            <div><strong>Gender:</strong> {child.gender}</div>
                            <div><strong>Age:</strong> {child.age}</div>
                            <div><strong>Occupation/School:</strong> {child.occupationOrSchool}</div>
                            <div><strong>Monthly Income:</strong> RM {child.monthlyIncome || '0'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Application Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Has Medical Insurance:</strong> {selectedWelfareApp.hasMedicalInsurance === 'yes' ? 'Yes' : 'No'}</div>
                    {selectedWelfareApp.hasMedicalInsurance === 'yes' && selectedWelfareApp.insuranceCompany && (
                      <div><strong>Insurance Company:</strong> {selectedWelfareApp.insuranceCompany}</div>
                    )}
                    <div><strong>Has Other Welfare Aid:</strong> {selectedWelfareApp.hasOtherWelfareAid === 'yes' ? 'Yes' : 'No'}</div>
                    {selectedWelfareApp.hasOtherWelfareAid === 'yes' && selectedWelfareApp.otherWelfareOrg && (
                      <div><strong>Other Welfare Organization:</strong> {selectedWelfareApp.otherWelfareOrg}</div>
                    )}
                    <div><strong>Request Type:</strong> {
                      selectedWelfareApp.requestType === 'general_welfare'
                        ? 'General Welfare Fund Allocation'
                        : 'Sub-Association Donation Request'
                    }</div>
                    {selectedWelfareApp.recommendedBySubAssociation && (
                      <div><strong>Recommended By:</strong> {selectedWelfareApp.recommendedBySubAssociation}</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Application Reason</h3>
                  <p className="text-sm bg-gray-50 p-3 rounded">{selectedWelfareApp.applicationReason}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Attachments</h3>
                  <div className="flex gap-2">
                    {selectedWelfareApp.medicalDocument && (
                      <Button
                        variant="outline"
                        onClick={() => downloadWelfareDocument(selectedWelfareApp.medicalDocument!, 'medical_document.pdf')}
                      >
                        <FileDown className="w-4 h-4 mr-2" />
                        Download Medical Document
                      </Button>
                    )}
                    {selectedWelfareApp.recommendationLetter && (
                      <Button
                        variant="outline"
                        onClick={() => downloadWelfareDocument(selectedWelfareApp.recommendationLetter!, 'recommendation_letter.pdf')}
                      >
                        <FileDown className="w-4 h-4 mr-2" />
                        Download Recommendation Letter
                      </Button>
                    )}
                    {!selectedWelfareApp.medicalDocument && !selectedWelfareApp.recommendationLetter && (
                      <p className="text-sm text-gray-500">No attachments available</p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedWelfareApp(null)}>
                  Close
                </Button>
                {selectedWelfareApp.status === 'pending' && (
                  <>
                    <Button
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        handleApproveWelfare(selectedWelfareApp.id);
                        setSelectedWelfareApp(null);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setShowRejectWelfareDialog(true);
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Welfare Application Dialog */}
      <Dialog open={showRejectWelfareDialog} onOpenChange={setShowRejectWelfareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Welfare Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this welfare application. The applicant will see this reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="welfare-rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="welfare-rejection-reason"
                placeholder="Enter the reason for rejection..."
                value={welfareRejectionReason}
                onChange={(e) => setWelfareRejectionReason(e.target.value)}
                rows={4}
                className="bg-white border-gray-300"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectWelfareDialog(false);
              setWelfareRejectionReason('');
              setSelectedWelfareApp(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => {
              if (!welfareRejectionReason.trim()) {
                alert('Please provide a rejection reason');
                return;
              }
              if (selectedWelfareApp) {
                handleRejectWelfare(selectedWelfareApp.id, welfareRejectionReason);
              }
            }}>
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Study Loan Application Details Dialog */}
      <Dialog open={!!selectedStudyLoan && !showRejectStudyLoanDialog} onOpenChange={(open) => !open && setSelectedStudyLoan(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-gray-900">
          {selectedStudyLoan && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900">Study Loan Application Details</DialogTitle>
                <DialogDescription className="text-gray-600">
                  {studyLoanSourceLabel(selectedStudyLoan.source)} · {selectedStudyLoan.full_name}
                  {selectedStudyLoan.full_name_zh?.trim() ? ` (${selectedStudyLoan.full_name_zh.trim()})` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 bg-white text-gray-900">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={selectedStudyLoan.source === 'manual' ? 'bg-purple-50 text-purple-800' : 'bg-sky-50 text-sky-800'}>
                    {studyLoanSourceLabel(selectedStudyLoan.source)}
                  </Badge>
                  <Badge variant="outline">{selectedStudyLoan.status}</Badge>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Applicant</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                    <div><strong>Name:</strong> {selectedStudyLoan.full_name}</div>
                    {selectedStudyLoan.full_name_zh?.trim() ? (
                      <div><strong>中文:</strong> {selectedStudyLoan.full_name_zh.trim()}</div>
                    ) : null}
                    <div><strong>Age:</strong> {selectedStudyLoan.age}</div>
                    <div><strong>Phone:</strong> {selectedStudyLoan.phone_number}</div>
                    <div><strong>Email:</strong> {selectedStudyLoan.email || '—'}</div>
                    <div><strong>Association:</strong> {selectedStudyLoan.association}</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Education</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                    <div><strong>University:</strong> {selectedStudyLoan.university}</div>
                    <div><strong>Courses:</strong> {selectedStudyLoan.courses}</div>
                    <div><strong>Admission:</strong> {selectedStudyLoan.admission_date}</div>
                    <div><strong>Expected graduation:</strong> {selectedStudyLoan.expected_graduation_date}</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Loan</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                    <div><strong>Type:</strong> {LOAN_TYPE_LABELS[selectedStudyLoan.loan_type || ''] || selectedStudyLoan.loan_type}</div>
                    <div><strong>Amount:</strong> RM {selectedStudyLoan.loan_amount?.toLocaleString()}</div>
                  </div>
                </div>
                {selectedStudyLoan.source !== 'manual' && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold mb-2 text-gray-900">Guarantor</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                      <div><strong>Relationship:</strong> {selectedStudyLoan.guarantor_relationship}</div>
                      <div><strong>Phone:</strong> {selectedStudyLoan.guarantor_phone_number === '—' ? '—' : selectedStudyLoan.guarantor_phone_number}</div>
                    </div>
                  </div>
                )}
                {selectedStudyLoan.extended_form && (
                  <>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                      <h3 className="font-semibold mb-2 text-purple-900">
                        Paper form ({selectedStudyLoan.extended_form.form_code || 'SFSL/F/Rev:0'})
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                        {selectedStudyLoan.extended_form.form_variant ? (
                          <div><strong>Form variant:</strong> {LOAN_TYPE_LABELS[selectedStudyLoan.extended_form.form_variant] || selectedStudyLoan.extended_form.form_variant}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.ic_number ? (
                          <div><strong>IC:</strong> {selectedStudyLoan.extended_form.ic_number}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.sex ? (
                          <div><strong>Sex:</strong> {selectedStudyLoan.extended_form.sex}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.former_school ? (
                          <div className="col-span-2"><strong>Former school:</strong> {selectedStudyLoan.extended_form.former_school}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.faculty ? (
                          <div><strong>Faculty:</strong> {selectedStudyLoan.extended_form.faculty}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.study_year ? (
                          <div><strong>Year:</strong> {selectedStudyLoan.extended_form.study_year}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.graduating_university ? (
                          <div className="col-span-2"><strong>Graduating university:</strong> {selectedStudyLoan.extended_form.graduating_university}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.bachelor_honors ? (
                          <div><strong>Bachelor honors:</strong> {selectedStudyLoan.extended_form.bachelor_honors}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.academy_name ? (
                          <div className="col-span-2"><strong>Academy:</strong> {selectedStudyLoan.extended_form.academy_name}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.phd_program_course ? (
                          <div className="col-span-2"><strong>PhD program:</strong> {selectedStudyLoan.extended_form.phd_program_course}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.spouse_name ? (
                          <div className="col-span-2"><strong>Spouse:</strong> {selectedStudyLoan.extended_form.spouse_name}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.spouse_occupation ? (
                          <div><strong>Spouse occupation:</strong> {selectedStudyLoan.extended_form.spouse_occupation}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.spouse_monthly_income ? (
                          <div><strong>Spouse income:</strong> RM {selectedStudyLoan.extended_form.spouse_monthly_income}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.spouse_tel ? (
                          <div><strong>Spouse tel:</strong> {selectedStudyLoan.extended_form.spouse_tel}</div>
                        ) : null}
                        {selectedStudyLoan.extended_form.postal_address ? (
                          <div className="col-span-2"><strong>Address:</strong> {selectedStudyLoan.extended_form.postal_address}</div>
                        ) : null}
                      </div>
                    </div>
                    {(selectedStudyLoan.extended_form.father?.name_en || selectedStudyLoan.extended_form.mother?.name_en || selectedStudyLoan.extended_form.spouse_name) && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold mb-2 text-gray-900">Family background</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          {selectedStudyLoan.extended_form.father?.name_en ? (
                            <div>
                              <p className="font-medium">Father</p>
                              <p>{selectedStudyLoan.extended_form.father.name_zh} / {selectedStudyLoan.extended_form.father.name_en}</p>
                              {selectedStudyLoan.extended_form.father.occupation ? <p>Occupation: {selectedStudyLoan.extended_form.father.occupation}</p> : null}
                            </div>
                          ) : null}
                          {selectedStudyLoan.extended_form.mother?.name_en ? (
                            <div>
                              <p className="font-medium">Mother</p>
                              <p>{selectedStudyLoan.extended_form.mother.name_zh} / {selectedStudyLoan.extended_form.mother.name_en}</p>
                              {selectedStudyLoan.extended_form.mother.occupation ? <p>Occupation: {selectedStudyLoan.extended_form.mother.occupation}</p> : null}
                            </div>
                          ) : null}
                          {selectedStudyLoan.extended_form.spouse_name ? (
                            <div>
                              <p className="font-medium">Spouse</p>
                              <p>{selectedStudyLoan.extended_form.spouse_name}</p>
                              {selectedStudyLoan.extended_form.spouse_occupation ? <p>Occupation: {selectedStudyLoan.extended_form.spouse_occupation}</p> : null}
                              {selectedStudyLoan.extended_form.spouse_monthly_income ? <p>Monthly income: RM {selectedStudyLoan.extended_form.spouse_monthly_income}</p> : null}
                              {selectedStudyLoan.extended_form.spouse_tel ? <p>Tel: {selectedStudyLoan.extended_form.spouse_tel}</p> : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                    {selectedStudyLoan.extended_form.affiliate?.financial_assessment ? (
                      <div className="bg-gray-50 rounded-lg p-4 text-sm">
                        <h3 className="font-semibold mb-2">Affiliate assessment</h3>
                        <p><strong>Financial:</strong> {selectedStudyLoan.extended_form.affiliate.financial_assessment}</p>
                        {selectedStudyLoan.extended_form.affiliate.participation_assessment ? (
                          <p className="mt-1"><strong>Participation:</strong> {selectedStudyLoan.extended_form.affiliate.participation_assessment}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Uploaded documents</h3>
                  <p className="text-sm text-gray-600 mb-3">Open the files uploaded with this application (from Supabase Storage).</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const uploads = selectedStudyLoan.extended_form?.uploaded_files;
                      const docs: Array<[string | null | undefined, string]> = [
                        [selectedStudyLoan.offer_letter_path || uploads?.offer_letter_path, 'Offer letter'],
                        [selectedStudyLoan.ic_front_path || uploads?.ic_front_path, 'IC front'],
                        [selectedStudyLoan.ic_back_path || uploads?.ic_back_path, 'IC back'],
                      ];
                      if (selectedStudyLoan.source === 'manual') {
                        docs.push(
                          [uploads?.school_testimonial_path || selectedStudyLoan.guarantor_ic_front_path, 'School testimonial'],
                          [uploads?.co_curriculum_path, 'Co-curriculum docs'],
                          [uploads?.affiliate_seal_path, 'Affiliate seal'],
                          [uploads?.employer_recommendation_path, 'Employer recommendation'],
                        );
                      } else {
                        docs.push(
                          [selectedStudyLoan.guarantor_ic_front_path, 'Guarantor IC front'],
                          [selectedStudyLoan.guarantor_ic_back_path, 'Guarantor IC back'],
                        );
                      }
                      const shown = docs.filter(([path]) => !!path);
                      if (shown.length === 0) {
                        return <span className="text-sm text-gray-500">No document paths stored.</span>;
                      }
                      return shown.map(([path, label]) => (
                        <Button
                          key={`${label}-${path}`}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openStudyLoanDocument(path!, label)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> {label}
                        </Button>
                      ));
                    })()}
                  </div>
                </div>
                {selectedStudyLoan.status === 'rejected' && selectedStudyLoan.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm font-semibold text-red-900">Rejection reason</p>
                    <p className="text-sm text-red-800">{selectedStudyLoan.rejection_reason}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedStudyLoan(null)}>
                  Close
                </Button>
                {selectedStudyLoan.source === 'manual' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingStudyLoan(selectedStudyLoan);
                      setSelectedStudyLoan(null);
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                {selectedStudyLoan.status === 'pending' && (
                  <>
                    <Button
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleApproveStudyLoan(selectedStudyLoan.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => openStudyLoanRejectDialog(selectedStudyLoan)}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Study Loan Dialog */}
      <Dialog open={showRejectStudyLoanDialog} onOpenChange={setShowRejectStudyLoanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Study Loan Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. The applicant will see this reason on their status page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="study-loan-rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="study-loan-rejection-reason"
                placeholder="Enter the reason for rejection..."
                value={studyLoanRejectionReason}
                onChange={(e) => setStudyLoanRejectionReason(e.target.value)}
                rows={4}
                className="bg-white border-gray-300"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectStudyLoanDialog(false);
              setStudyLoanRejectionReason('');
              setSelectedStudyLoan(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => {
              if (!studyLoanRejectionReason.trim()) {
                alert('Please provide a rejection reason');
                return;
              }
              if (selectedStudyLoan) {
                handleRejectStudyLoan(selectedStudyLoan.id, studyLoanRejectionReason);
              }
            }}>
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / Edit loan recipient details */}
      <Dialog
        open={!!selectedRecipientForDetails}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecipientForDetails(null);
            setEditRecipient(null);
            setEditOfferLetterFile(null);
            setEditStudentIcFile(null);
            setEditDocScreenshotFile(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-gray-900">
          {selectedRecipientForDetails && editRecipient && (
            <>
              <DialogHeader>
                <DialogTitle>Edit loan recipient</DialogTitle>
                <DialogDescription>
                  Update details for {selectedRecipientForDetails.full_name_en}. Changes sync to Supabase.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full name (English)</Label>
                    <Input
                      value={editRecipient.full_name_en}
                      onChange={(e) => setEditRecipient({ ...editRecipient, full_name_en: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Chinese name (中文)</Label>
                    <Input
                      value={editRecipient.full_name_zh || ''}
                      onChange={(e) => setEditRecipient({ ...editRecipient, full_name_zh: e.target.value })}
                      placeholder="中文姓名"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editRecipient.email}
                      onChange={(e) => setEditRecipient({ ...editRecipient, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editRecipient.phone_number}
                      onChange={(e) =>
                        setEditRecipient({ ...editRecipient, phone_number: formatMalaysiaMobileDash(e.target.value) })
                      }
                      placeholder="011-12345678"
                      inputMode="numeric"
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Association</Label>
                    <Input
                      value={editRecipient.association}
                      onChange={(e) => setEditRecipient({ ...editRecipient, association: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>University</Label>
                    <Input
                      value={editRecipient.university}
                      onChange={(e) => setEditRecipient({ ...editRecipient, university: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Input
                    value={editRecipient.course}
                    onChange={(e) => setEditRecipient({ ...editRecipient, course: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loan type</Label>
                  <Select
                    value={editRecipient.loan_type || ''}
                    onValueChange={(v) => setEditRecipient({ ...editRecipient, loan_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select loan type" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label} - RM {t.amount.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Admission year</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="e.g. 2024"
                      maxLength={4}
                      value={yearFieldFromStored(editRecipient.admission_date)}
                      onChange={(e) =>
                        setEditRecipient({
                          ...editRecipient,
                          admission_date: e.target.value.replace(/\D/g, '').slice(0, 4),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected graduation year</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="e.g. 2028"
                      maxLength={4}
                      value={yearFieldFromStored(editRecipient.expected_graduation_date)}
                      onChange={(e) =>
                        setEditRecipient({
                          ...editRecipient,
                          expected_graduation_date: e.target.value.replace(/\D/g, '').slice(0, 4),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Loan amount (RM)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editRecipient.loan_amount}
                      onChange={(e) => setEditRecipient({ ...editRecipient, loan_amount: parseInt(e.target.value || '0', 10) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total paid (RM)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editRecipient.total_paid}
                      onChange={(e) => setEditRecipient({ ...editRecipient, total_paid: parseInt(e.target.value || '0', 10) })}
                    />
                    <p className="text-xs text-gray-500">
                      Note: this value is recalculated from the payment history whenever a payment is added or deleted.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-gray-900">担保人（relational table）</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（一）姓名（中文）</Label>
                      <Input
                        value={editRecipient.guarantor?.guarantor_1_zh || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_1_zh: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（一）姓名（英文）</Label>
                      <Input
                        value={editRecipient.guarantor?.guarantor_1_en || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_1_en: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（一）身份证</Label>
                      <Input
                        value={editRecipient.guarantor?.guarantor_1_ic || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_1_ic: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（一）日期</Label>
                      <Input
                        type="date"
                        value={editRecipient.guarantor?.guarantor_1_sign_date || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_1_sign_date: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">担保人（一）地址</Label>
                      <Textarea
                        rows={2}
                        value={editRecipient.guarantor?.guarantor_1_address || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_1_address: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm pt-2 border-t border-gray-200">
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（二）姓名（中文）</Label>
                      <Input
                        value={editRecipient.guarantor?.guarantor_2_zh || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_2_zh: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（二）姓名（英文）</Label>
                      <Input
                        value={editRecipient.guarantor?.guarantor_2_en || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_2_en: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（二）年龄</Label>
                      <Input
                        type="number"
                        min={1}
                        max={65}
                        value={editRecipient.guarantor?.guarantor_2_age ?? ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_2_age: e.target.value === '' ? null : parseInt(e.target.value, 10),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（二）身份证</Label>
                      <Input
                        value={editRecipient.guarantor?.guarantor_2_ic || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_2_ic: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">担保人（二）日期</Label>
                      <Input
                        type="date"
                        value={editRecipient.guarantor?.guarantor_2_sign_date || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_2_sign_date: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">担保人（二）地址</Label>
                      <Textarea
                        rows={2}
                        value={editRecipient.guarantor?.guarantor_2_address || ''}
                        onChange={(e) =>
                          setEditRecipient({
                            ...editRecipient,
                            guarantor: {
                              ...(editRecipient.guarantor ?? emptyGuarantorRow(editRecipient.id)),
                              guarantor_2_address: e.target.value || null,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-gray-900">Uploaded documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Replace offer letter</Label>
                      <Input type="file" accept=".pdf,image/*" onChange={(e) => setEditOfferLetterFile(e.target.files?.[0] || null)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Replace student IC</Label>
                      <Input type="file" accept=".pdf,image/*" onChange={(e) => setEditStudentIcFile(e.target.files?.[0] || null)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Replace 文件截图</Label>
                      <Input type="file" accept=".pdf,image/*" onChange={(e) => setEditDocScreenshotFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>
                  {(editOfferLetterFile || editStudentIcFile || editDocScreenshotFile) && (
                    <p className="text-xs text-blue-700">New file selections will be uploaded when you click "Save changes".</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editRecipient.offer_letter_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openStudyLoanDocument(editRecipient.offer_letter_path || null, 'Offer letter')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Offer letter
                      </Button>
                    )}
                    {editRecipient.student_ic_front_back_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openStudyLoanDocument(editRecipient.student_ic_front_back_path || null, 'Student IC (combined)')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Student IC
                      </Button>
                    )}
                    {editRecipient.guarantor?.guarantor_info_pic && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openStudyLoanDocument(editRecipient.guarantor?.guarantor_info_pic ?? null, '文件截图')
                        }
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> 文件截图
                      </Button>
                    )}
                    {!editRecipient.offer_letter_path &&
                      !editRecipient.student_ic_front_back_path &&
                      !editRecipient.guarantor?.guarantor_info_pic && (
                        <p className="text-xs text-gray-500">No document paths stored for this recipient.</p>
                      )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editRecipient.status}
                    onValueChange={(v) => setEditRecipient({ ...editRecipient, status: v as LoanRecipient['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editRecipient.notes || ''}
                    onChange={(e) => setEditRecipient({ ...editRecipient, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRecipientForDetails(null);
                    setEditRecipient(null);
                    setEditOfferLetterFile(null);
                    setEditStudentIcFile(null);
                    setEditDocScreenshotFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={savingRecipientEdit}
                  onClick={() => {
                    if (editRecipient) updateLoanRecipient(editRecipient);
                  }}
                >
                  {savingRecipientEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete loan recipient (typed confirmation, consistent with payment delete) */}
      <Dialog
        open={!!pendingDeleteRecipient}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteRecipient(null);
            setDeleteRecipientConfirmText('');
          }
        }}
      >
        <DialogContent className="bg-white text-black border-gray-300">
          <DialogHeader>
            <DialogTitle className="text-black">Delete loan recipient?</DialogTitle>
            <DialogDescription className="text-black">
              This permanently removes <strong>{pendingDeleteRecipient?.full_name_en}</strong> along with all payment
              records, guarantor details, and uploaded documents. This cannot be undone.
              Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm-recipient" className="text-black">Confirmation text</Label>
            <Input
              id="delete-confirm-recipient"
              className="bg-white text-black border-gray-400 placeholder:text-gray-600"
              value={deleteRecipientConfirmText}
              onChange={(e) => setDeleteRecipientConfirmText(e.target.value)}
              placeholder="Type DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingDeleteRecipient(null);
                setDeleteRecipientConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white disabled:opacity-100 disabled:bg-red-200 disabled:text-red-700 disabled:border-red-300"
              disabled={deleteRecipientConfirmText.trim() !== 'DELETE' || deletingRecipient}
              onClick={() => {
                if (pendingDeleteRecipient) deleteLoanRecipient(pendingDeleteRecipient);
              }}
            >
              {deletingRecipient ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete recipient'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule notifications for loan recipients */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="max-w-lg bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle>Send notifications to recipients</DialogTitle>
            <DialogDescription>
              Choose who to notify, customise the message, and when it should be sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Who to send to</Label>
              <Select
                value={notificationTarget}
                onValueChange={(v) => setNotificationTarget(v as 'all' | 'active' | 'completed')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All loan recipients</SelectItem>
                  <SelectItem value="active">Only active (not fully paid)</SelectItem>
                  <SelectItem value="completed">Only completed loans</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>When to send</Label>
              <Input
                type="datetime-local"
                value={notificationSchedule}
                onChange={(e) => setNotificationSchedule(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Date and time when notifications should be sent.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Message template</Label>
              <Textarea
                rows={4}
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>Cancel</Button>
            <Button
              variant="outline"
              disabled={sendingNotificationNow}
              onClick={async () => {
                if (sendingNotificationNow) return;
                const now = Date.now();
                // Extra guard: prevent accidental double-click spamming
                if (now - lastSendNowAt < 8000) {
                  alert('Please wait a few seconds before sending again.');
                  return;
                }
                setSendingNotificationNow(true);
                setLastSendNowAt(now);
                // Send now: insert a due row and immediately invoke the Edge Function.
                const scheduleAt = new Date().toISOString();
                const id = `loan_${Date.now()}`;
                try {
                  if (!(isSupabaseConfigured() && supabase)) {
                    alert('Supabase is not configured; Send now requires Supabase.');
                    return;
                  }

                  const { error } = await supabase.from('scheduled_notifications').insert({
                    id,
                    target: notificationTarget,
                    message: notificationMessage,
                    schedule_at: scheduleAt,
                    created_at: new Date().toISOString(),
                  });
                  if (error) {
                    alert('Failed to save to Supabase: ' + (error.message || 'Unknown error'));
                    return;
                  }

                  const serviceRoleKey = (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;
                  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
                  if (!serviceRoleKey?.trim() || !supabaseUrl?.trim()) {
                    alert('Missing VITE_SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL in .env (required for Send now).');
                    return;
                  }

                  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/process-scheduled-notifications`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${serviceRoleKey}`,
                    },
                    body: JSON.stringify({}),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    alert(`Edge Function failed (${res.status}): ${json?.error || 'Unknown error'}`);
                    return;
                  }

                  alert(`Sent now. Processed: ${json?.processed ?? 0}`);
                  setShowNotificationDialog(false);
                } catch (e: any) {
                  alert(e?.message || 'Failed to send now');
                } finally {
                  setSendingNotificationNow(false);
                }
              }}
            >
              {sendingNotificationNow ? 'Sending…' : 'Send now'}
            </Button>
            <Button
              disabled={savingNotificationSchedule || sendingNotificationNow}
              onClick={async () => {
                if (savingNotificationSchedule) return;
                setSavingNotificationSchedule(true);
                // datetime-local returns local time without timezone. Convert to UTC ISO for timestamptz.
                const scheduleAt = notificationSchedule
                  ? new Date(notificationSchedule).toISOString()
                  : new Date().toISOString();
                try {
                  if (isSupabaseConfigured() && supabase) {
                    const { error } = await supabase.from('scheduled_notifications').insert({
                      id: `loan_${Date.now()}`,
                      target: notificationTarget,
                      message: notificationMessage,
                      schedule_at: scheduleAt,
                      created_at: new Date().toISOString(),
                    });
                    if (error) {
                      alert('Failed to save to Supabase: ' + (error.message || 'Unknown error'));
                      return;
                    }
                  } else {
                    const list = JSON.parse(localStorage.getItem('myHainanScheduledNotifications') || '[]');
                    list.push({
                      id: `loan_${Date.now()}`,
                      target: notificationTarget,
                      message: notificationMessage,
                      schedule_at: scheduleAt,
                      created_at: new Date().toISOString(),
                    });
                    localStorage.setItem('myHainanScheduledNotifications', JSON.stringify(list));
                  }
                  alert('Notification schedule saved.');
                  setShowNotificationDialog(false);
                } catch (e: any) {
                  alert(e?.message || 'Failed to save notification schedule');
                } finally {
                  setSavingNotificationSchedule(false);
                }
              }}
            >
              {savingNotificationSchedule ? 'Saving…' : 'Save schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}