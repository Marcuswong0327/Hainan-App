import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ArrowLeft, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import type { LoanRecipient } from '../types/studyLoan';
import { STUDY_LOAN_BUCKET } from '../types/studyLoan';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { validateUploadFile } from '../lib/fileValidation';

const MAX_PAYMENT_AMOUNT = 1_000_000;
const MIN_PAYMENT_DATE = '2000-01-01';

/** Today's date in the user's local timezone, formatted YYYY-MM-DD. */
function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface RecordLoanPaymentsPageProps {
  recipient: LoanRecipient;
  onBack: () => void;
  onTotalsUpdated?: (updated: LoanRecipient) => void;
}

interface PaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  payment_date: string | null;
  receipt_path: string | null;
}

function displayPaymentDate(p: PaymentRow): string {
  if (p.payment_date) return p.payment_date;
  try {
    return new Date(p.paid_at).toLocaleDateString();
  } catch {
    return p.paid_at;
  }
}

export function RecordLoanPaymentsPage({ recipient, onBack, onTotalsUpdated }: RecordLoanPaymentsPageProps) {
  const [currentRecipient, setCurrentRecipient] = useState(recipient);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [pendingDeletePayment, setPendingDeletePayment] = useState<PaymentRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentRecipient(recipient);
  }, [recipient]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('study_loan_payments')
          .select('*')
          .eq('recipient_id', recipient.id)
          .order('paid_at', { ascending: false });
        if (error) {
          setLoadError(error.message || 'Failed to load payment history.');
        } else if (data) {
          const rows = (data as any[]).map((p) => ({
            id: p.id,
            amount: p.amount,
            paid_at: p.paid_at,
            payment_date: p.payment_date ?? null,
            receipt_path: p.receipt_path ?? null,
          }));
          rows.sort((a, b) => {
            const da = a.payment_date || a.paid_at?.slice(0, 10) || '';
            const db = b.payment_date || b.paid_at?.slice(0, 10) || '';
            return db.localeCompare(da);
          });
          setPayments(rows);
        }
      } else {
        const raw = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
        const filtered = raw
          .filter((p: any) => p.recipientId === recipient.id)
          .sort((a: any, b: any) => {
            const da = a.paymentDate || a.paidAt || '';
            const db = b.paymentDate || b.paidAt || '';
            return db.localeCompare(da);
          });
        setPayments(
          filtered.map((p: any) => ({
            id: p.id,
            amount: p.amount,
            paid_at: p.paidAt,
            payment_date: p.paymentDate ?? null,
            receipt_path: null,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [recipient.id]);

  const syncRecipientTotals = async () => {
    if (isSupabaseConfigured() && supabase) {
      const { data: payRows, error: payErr } = await supabase
        .from('study_loan_payments')
        .select('amount')
        .eq('recipient_id', recipient.id);
      if (payErr) throw payErr;
      const totalPaid = (payRows || []).reduce((sum, row: any) => sum + (row.amount || 0), 0);
      const status = totalPaid >= currentRecipient.loan_amount ? 'completed' : 'active';
      const updatedAt = new Date().toISOString();

      const { error: updErr } = await supabase
        .from('study_loan_recipients')
        .update({
          total_paid: totalPaid,
          status,
          updated_at: updatedAt,
        })
        .eq('id', recipient.id);
      if (updErr) throw updErr;

      const updatedRecipient: LoanRecipient = {
        ...currentRecipient,
        total_paid: totalPaid,
        status,
        updated_at: updatedAt,
      };
      setCurrentRecipient(updatedRecipient);
      onTotalsUpdated?.(updatedRecipient);
      return updatedRecipient;
    }

    const paymentsLocal = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
    const totalPaid = paymentsLocal
      .filter((p: any) => p.recipientId === recipient.id)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const recipients = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
    const idx = recipients.findIndex((r: any) => r.id === recipient.id);
    if (idx !== -1) {
      const status = totalPaid >= recipients[idx].loan_amount ? 'completed' : 'active';
      recipients[idx] = {
        ...recipients[idx],
        total_paid: totalPaid,
        status,
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem('myHainanLoanRecipients', JSON.stringify(recipients));
      setCurrentRecipient(recipients[idx]);
      onTotalsUpdated?.(recipients[idx]);
      return recipients[idx] as LoanRecipient;
    }
    return currentRecipient;
  };

  const openReceipt = async (path: string | null) => {
    if (!path) return;
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.storage.from(STUDY_LOAN_BUCKET).createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) {
        alert('Unable to open receipt');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } else {
      alert('Receipt stored in Supabase; configure Supabase to view.');
    }
  };

  const handleSavePayment = async () => {
    if (!paymentDate.trim()) {
      alert('Select the payment date (when the student paid).');
      return;
    }
    if (paymentDate > todayLocalISO()) {
      alert('Payment date cannot be in the future.');
      return;
    }
    if (paymentDate < MIN_PAYMENT_DATE) {
      alert(`Payment date cannot be earlier than ${MIN_PAYMENT_DATE}.`);
      return;
    }
    const amount = Number(amountInput.trim());
    if (!amountInput.trim() || !Number.isInteger(amount) || amount <= 0) {
      alert('Enter a valid payment amount in whole Ringgit (e.g. 200).');
      return;
    }
    if (amount > MAX_PAYMENT_AMOUNT) {
      alert(`Payment amount cannot exceed RM ${MAX_PAYMENT_AMOUNT.toLocaleString()}.`);
      return;
    }
    if (receiptFile) {
      const fileError = validateUploadFile(receiptFile, 'Receipt');
      if (fileError) {
        alert(fileError);
        return;
      }
    }
    const remainingNow = Math.max(0, currentRecipient.loan_amount - currentRecipient.total_paid);
    if (
      amount > remainingNow &&
      !window.confirm(
        `This payment (RM ${amount.toLocaleString()}) is more than the remaining balance (RM ${remainingNow.toLocaleString()}). Record it anyway?`,
      )
    ) {
      return;
    }
    let paymentSaved = false;
    try {
      setSaving(true);
      let receiptPath: string | null = null;
      if (isSupabaseConfigured() && supabase) {
        if (receiptFile) {
          const safeExt = receiptFile.name.split('.').pop() || 'bin';
          const path = `recipients/${recipient.id}/payments/${paymentDate}-${Date.now()}.${safeExt}`;
          const { error: uploadError } = await supabase.storage.from(STUDY_LOAN_BUCKET).upload(path, receiptFile, {
            upsert: true,
          });
          if (uploadError) throw uploadError;
          receiptPath = path;
        }
        const { error: payError } = await supabase.from('study_loan_payments').insert({
          recipient_id: recipient.id,
          amount,
          payment_date: paymentDate,
          paid_at: new Date().toISOString(),
          payment_month: null,
          receipt_path: receiptPath,
        });
        if (payError) {
          // Don't leave an orphaned receipt in storage when the row insert failed.
          if (receiptPath) {
            await supabase.storage.from(STUDY_LOAN_BUCKET).remove([receiptPath]);
          }
          throw payError;
        }
      } else {
        const paymentsLocal = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
        paymentsLocal.push({
          id: crypto.randomUUID(),
          recipientId: recipient.id,
          amount,
          paymentDate,
          paidAt: new Date().toISOString(),
          receiptName: receiptFile?.name || '',
        });
        localStorage.setItem('myHainanLoanPayments', JSON.stringify(paymentsLocal));
      }
      paymentSaved = true;
      setPaymentDate('');
      setAmountInput('');
      setReceiptFile(null);
      await syncRecipientTotals();
      await loadPayments();
    } catch (e: any) {
      if (paymentSaved) {
        alert(
          `Payment was saved, but totals could not be refreshed: ${e?.message || 'Unknown error'}. Reload the page to see updated numbers.`,
        );
      } else {
        alert(e?.message || 'Failed to record payment.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async () => {
    const payment = pendingDeletePayment;
    if (!payment) return;
    if (deleteConfirmText.trim() !== 'DELETE') {
      alert('Please type DELETE to confirm.');
      return;
    }

    let paymentDeleted = false;
    try {
      setDeletingPaymentId(payment.id);
      if (isSupabaseConfigured() && supabase) {
        const { error: delErr } = await supabase.from('study_loan_payments').delete().eq('id', payment.id);
        if (delErr) throw delErr;
        if (payment.receipt_path) {
          await supabase.storage.from(STUDY_LOAN_BUCKET).remove([payment.receipt_path]);
        }
      } else {
        const raw = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
        const filtered = raw.filter((p: any) => p.id !== payment.id);
        localStorage.setItem('myHainanLoanPayments', JSON.stringify(filtered));
      }
      paymentDeleted = true;

      setPendingDeletePayment(null);
      setDeleteConfirmText('');
      await syncRecipientTotals();
      await loadPayments();
    } catch (e: any) {
      if (paymentDeleted) {
        alert(
          `Payment was deleted, but totals could not be refreshed: ${e?.message || 'Unknown error'}. Reload the page to see updated numbers.`,
        );
      } else {
        alert(e?.message || 'Failed to delete payment.');
      }
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const totalLoaned = currentRecipient.loan_amount;
  const totalPaid = currentRecipient.total_paid;
  const remaining = Math.max(0, totalLoaned - totalPaid);
  const progressPct = totalLoaned > 0 ? (totalPaid / totalLoaned) * 100 : 0;

  const yearlyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payments) {
      const raw = p.payment_date || p.paid_at?.slice(0, 10);
      if (!raw) continue;
      const y = raw.slice(0, 4);
      map[y] = (map[y] || 0) + p.amount;
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [payments]);

  const titleName = [recipient.full_name_en, recipient.full_name_zh?.trim()].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="font-semibold text-lg">Loan repayments · {titleName}</h1>
            <p className="text-xs text-gray-500">
              {recipient.university} · {recipient.association}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="border rounded-lg p-3 bg-blue-50">
                <p className="text-xs text-gray-500">Total loan</p>
                <p className="text-lg font-semibold text-blue-700">RM {totalLoaned.toLocaleString()}</p>
              </div>
              <div className="border rounded-lg p-3 bg-green-50">
                <p className="text-xs text-gray-500">Total paid</p>
                <p className="text-lg font-semibold text-green-700">RM {totalPaid.toLocaleString()}</p>
              </div>
              <div className="border rounded-lg p-3 bg-amber-50">
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="text-lg font-semibold text-amber-700">RM {remaining.toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Overall progress</span>
                <span>{Math.round(Math.min(100, progressPct))}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{ width: `${Math.min(100, progressPct)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter when the student paid, the amount, and optionally upload a receipt. There is no fixed calendar slot—use the actual payment date.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Payment date *</Label>
                <Input
                  type="date"
                  min={MIN_PAYMENT_DATE}
                  max={todayLocalISO()}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount (RM) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="e.g. 200"
                />
              </div>
              <div className="space-y-2">
                <Label>Receipt / proof (optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 text-center">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    id="new-payment-receipt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        const fileError = validateUploadFile(file, 'Receipt');
                        if (fileError) {
                          alert(fileError);
                          e.target.value = '';
                          setReceiptFile(null);
                          return;
                        }
                      }
                      setReceiptFile(file);
                    }}
                  />
                  <label htmlFor="new-payment-receipt" className="cursor-pointer text-xs text-gray-600">
                    {receiptFile ? receiptFile.name : 'Upload (optional)'}
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleSavePayment} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save payment'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading payments...
              </div>
            ) : loadError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-2">
                <p>Could not load payment history: {loadError}</p>
                <Button type="button" size="sm" variant="outline" onClick={loadPayments}>
                  Retry
                </Button>
              </div>
            ) : payments.length === 0 ? (
              <p className="text-gray-500 text-sm">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-lg px-3 py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium">RM {p.amount.toLocaleString()}</span>
                      <span className="text-gray-600">
                        {' '}
                        · Paid on {displayPaymentDate(p)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {p.receipt_path && (
                        <Button type="button" size="sm" variant="outline" onClick={() => openReceipt(p.receipt_path)}>
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View receipt
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          setPendingDeletePayment(p);
                          setDeleteConfirmText('');
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {yearlyTotals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Yearly summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {yearlyTotals.map(([year, total]) => (
                <div key={year} className="flex items-center justify-between border-b last:border-b-0 pb-2">
                  <span>{year}</span>
                  <span className="font-semibold">RM {total.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={!!pendingDeletePayment}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeletePayment(null);
            setDeleteConfirmText('');
          }
        }}
      >
        <DialogContent className="bg-white text-black border-gray-300">
          <DialogHeader>
            <DialogTitle className="text-black">Delete payment record?</DialogTitle>
            <DialogDescription className="text-black">
              This will remove the payment and recalculate the student&apos;s paid and remaining balance.
              Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm-payment" className="text-black">Confirmation text</Label>
            <Input
              id="delete-confirm-payment"
              className="bg-white text-black border-gray-400 placeholder:text-gray-600"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingDeletePayment(null);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white disabled:opacity-100 disabled:bg-red-200 disabled:text-red-700 disabled:border-red-300"
              disabled={deleteConfirmText.trim() !== 'DELETE' || !!deletingPaymentId}
              onClick={handleDeletePayment}
            >
              {deletingPaymentId ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
