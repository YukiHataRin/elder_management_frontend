import { useMemo, useState } from 'react';
import { CircleAlert, Loader2, Search, UserRound, X } from 'lucide-react';
import { CARE_OUTREACH_REASON_LABELS } from '../api/careOutreach';

const reasonOptions = Object.entries(CARE_OUTREACH_REASON_LABELS);

const toLocalDateTime = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const getPatientItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.users || payload?.patients || payload?.data || [];
};

const getPatientId = (patient) => patient?.id ?? patient?.user_id;

const getPatientName = (patient) => (
  patient?.display_name
  || patient?.name
  || patient?.username
  || (getPatientId(patient) ? `個案 #${getPatientId(patient)}` : '未命名個案')
);

const getPatientUsername = (patient) => patient?.username || patient?.account || '';

const emptyForm = () => ({
  subjectId: '',
  reasonCode: 'low_motivation',
  severity: 'normal',
  dueAt: toLocalDateTime(new Date(Date.now() + (3 * 24 * 60 * 60 * 1000))),
  note: '',
});

const fieldClass = 'mt-2 h-11 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-text/45';

const CareOutreachCreateModal = ({
  open,
  patients,
  loadingPatients,
  patientsError,
  onRetryPatients,
  onClose,
  onSubmit,
  submitting,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const patientItems = useMemo(() => getPatientItems(patients), [patients]);
  const filteredPatients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return patientItems;
    return patientItems.filter((patient) => [
      getPatientName(patient),
      getPatientUsername(patient),
    ].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [patientItems, search]);
  const selectedPatient = patientItems.find((patient) => String(getPatientId(patient)) === String(form.subjectId));

  if (!open) return null;

  const updateField = (key, value) => {
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const dueDate = form.dueAt ? new Date(form.dueAt) : null;
    if (!form.subjectId || !form.reasonCode || !form.severity || !form.dueAt || !form.note.trim()) {
      setError('個案、人工原因、嚴重度、期限與處理說明皆為必填。');
      return;
    }
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      setError('請輸入有效的處理期限。');
      return;
    }

    setError('');
    try {
      await onSubmit({
        subject_user_id: Number(form.subjectId),
        reason_code: form.reasonCode,
        severity: form.severity,
        due_at: dueDate.toISOString(),
        private_note: form.note.trim(),
        client_event_id: crypto.randomUUID(),
      });
    } catch (submitError) {
      setError(submitError.message || '新增關懷案件失敗，請稍後再試。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-sky-100 bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="care-outreach-create-title">
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold tracking-wide text-primary/55">MANUAL OUTREACH</p>
            <h2 id="care-outreach-create-title" className="mt-1 text-lg font-bold text-primary">新增關懷案件</h2>
            <p className="mt-1 text-xs leading-5 text-text/50">只會列出目前管理端 API 可見的個案。</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="關閉新增關懷案件視窗" className="rounded-lg p-2 text-text/40 transition hover:bg-sky-50 hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-40">
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit} className="min-h-0 overflow-y-auto">
          <div className="space-y-5 p-5">
            {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-700"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}

            <section>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="care-outreach-patient-search" className="text-xs font-bold text-text/55">選擇個案（必填）</label>
                {selectedPatient && <span className="truncate text-xs font-bold text-primary/75">已選：{getPatientName(selectedPatient)}</span>}
              </div>
              <label className="relative mt-2 block">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
                <input id="care-outreach-patient-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋姓名或帳號" aria-label="搜尋可見個案" className="h-11 w-full rounded-lg border border-sky-100 bg-sky-50/20 pl-10 pr-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10" disabled={loadingPatients || submitting} />
              </label>
              {loadingPatients ? (
                <div className="mt-2 flex h-32 items-center justify-center gap-2 rounded-lg border border-dashed border-sky-100 text-sm text-text/45"><Loader2 size={18} className="animate-spin" />載入可見個案中</div>
              ) : patientsError ? (
                <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-rose-100 bg-rose-50/60 px-4 py-5 text-center"><p className="text-sm font-bold text-rose-700">{patientsError}</p><button type="button" onClick={onRetryPatients} disabled={submitting} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50">重試</button></div>
              ) : filteredPatients.length === 0 ? (
                <div className="mt-2 flex min-h-24 items-center justify-center rounded-lg border border-dashed border-sky-100 px-4 text-center text-sm text-text/45">沒有符合搜尋條件的可見個案。</div>
              ) : (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-sky-100" role="radiogroup" aria-label="選擇個案">
                  {filteredPatients.map((patient) => {
                    const patientId = getPatientId(patient);
                    if (!patientId) return null;
                    const checked = String(form.subjectId) === String(patientId);
                    return (
                      <label key={patientId} className={`flex cursor-pointer items-center gap-3 border-b border-sky-50 px-3 py-3 text-sm last:border-b-0 hover:bg-sky-50/60 ${checked ? 'bg-sky-50' : ''}`}>
                        <input type="radio" name="care-outreach-subject" value={patientId} checked={checked} onChange={(event) => updateField('subjectId', event.target.value)} disabled={submitting} className="h-4 w-4 accent-primary focus:ring-2 focus:ring-primary/20" />
                        <UserRound size={17} className="shrink-0 text-primary/55" />
                        <span className="min-w-0 flex-1"><span className="block truncate font-bold text-text">{getPatientName(patient)}</span>{getPatientUsername(patient) && <span className="mt-0.5 block truncate text-xs text-text/45">@{getPatientUsername(patient)}</span>}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-xs font-bold text-text/55">人工原因（必填）</span><select value={form.reasonCode} onChange={(event) => updateField('reasonCode', event.target.value)} className={fieldClass} disabled={submitting}>{reasonOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="block"><span className="text-xs font-bold text-text/55">嚴重度（僅可建立一般／需留意）</span><select value={form.severity} onChange={(event) => updateField('severity', event.target.value)} className={fieldClass} disabled={submitting}><option value="low">一般</option><option value="normal">需留意</option></select></label>
            </div>

            <label className="block"><span className="text-xs font-bold text-text/55">首次處理期限（必填）</span><input type="datetime-local" value={form.dueAt} onChange={(event) => updateField('dueAt', event.target.value)} className={fieldClass} disabled={submitting} /></label>

            <label className="block"><span className="text-xs font-bold text-text/55">處理說明（必填）</span><textarea value={form.note} onChange={(event) => updateField('note', event.target.value)} rows={5} maxLength={2000} placeholder="請記錄建立案件的人工依據、目前處理情形或後續安排" className="mt-2 w-full resize-y rounded-lg border border-sky-100 p-3 text-sm leading-6 outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-50" disabled={submitting} /><p className="mt-1 text-right text-xs text-text/40">{form.note.length} / 2000</p></label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-sky-100 px-5 py-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="h-11 rounded-lg border border-sky-200 px-4 text-sm font-bold text-text/60 transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-45">取消</button>
            <button type="submit" disabled={submitting || loadingPatients || Boolean(patientsError)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50">{submitting && <Loader2 size={17} className="animate-spin" />}建立人工關懷案件</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CareOutreachCreateModal;
