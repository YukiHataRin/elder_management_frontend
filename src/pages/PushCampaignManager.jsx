import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Link2,
  Loader2,
  Megaphone,
  RefreshCw,
  Search,
  Send,
  UsersRound,
  X,
} from 'lucide-react';
import { pushCampaignsApi } from '../api/pushCampaigns';
import { managementApi } from '../api/management';
import { useToast } from '../context/useToast';

const PAGE_SIZE = 20;
const TITLE_MAX = 100;
const CONTENT_MAX = 1000;

const campaignStatus = {
  scheduled: { label: '已排程', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  sending: { label: '發送中', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  sent: { label: '已發送', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  cancelled: { label: '已取消', className: 'border-slate-200 bg-slate-50 text-slate-500' },
};

const recipientStatus = {
  pending: { label: '等待發送', className: 'text-text/50' },
  notified: { label: '發送中', className: 'text-amber-700' },
  sent: { label: '已推播', className: 'text-emerald-700' },
  no_token: { label: '未開啟 App 推播（已存入 App 通知）', className: 'text-text/55' },
  failed: { label: '推播失敗（已存入 App 通知）', className: 'text-rose-700' },
};

const triState = [
  ['', '不限'],
  ['true', '是'],
  ['false', '否'],
];

const emptyForm = () => ({
  audienceType: 'all',
  role: '',
  regions: [],
  isPsychiatric: '',
  isDental: '',
  userIds: [],
  title: '',
  content: '',
  linkUrl: '',
  sendMode: 'immediate',
  scheduledAt: '',
});

const formatTime = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
};

const toLocalInputValue = (date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
};

const buildAudience = (form) => {
  if (form.audienceType === 'users') return { type: 'users', user_ids: form.userIds };
  if (form.audienceType === 'group') {
    const group = {};
    if (form.role) group.role = form.role;
    if (form.regions.length > 0) group.regions = form.regions;
    if (form.isPsychiatric) group.is_psychiatric = form.isPsychiatric === 'true';
    if (form.isDental) group.is_dental = form.isDental === 'true';
    return { type: 'group', group };
  }
  return { type: 'all' };
};

const audienceIncomplete = (form) => (
  (form.audienceType === 'users' && form.userIds.length === 0)
  || (form.audienceType === 'group' && !form.role && form.regions.length === 0 && !form.isPsychiatric && !form.isDental)
);

const audienceReady = (audience) => (
  !(audience.type === 'users' && (audience.user_ids || []).length === 0)
  && !(audience.type === 'group' && Object.keys(audience.group || {}).length === 0)
);

const patientName = (patient) => patient?.display_name || patient?.username || '未命名個案';

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation">
    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-sky-100 bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="push-campaign-modal-title">
      <div className="flex items-center justify-between gap-4 border-b border-sky-100 px-5 py-4">
        <h2 id="push-campaign-modal-title" className="truncate text-lg font-bold text-primary">{title}</h2>
        <button type="button" onClick={onClose} aria-label="關閉" className="rounded-lg p-2 text-text/40 hover:bg-sky-50 hover:text-text"><X size={19} /></button>
      </div>
      <div className="min-h-0 overflow-y-auto">{children}</div>
    </div>
  </div>
);

const PushCampaignManager = () => {
  const { showToast, requestConfirm } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState({ regions: [], roles: [] });
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [list, setList] = useState({ items: [], total: 0 });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const updateForm = (key, value) => {
    setFormError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    pushCampaignsApi.getAudienceOptions().then(setOptions).catch(() => setOptions({ regions: [], roles: [] }));
  }, []);

  useEffect(() => {
    if (form.audienceType !== 'users' || patients.length > 0 || patientsLoading) return;
    setPatientsLoading(true);
    managementApi.getPatients()
      .then((response) => setPatients(Array.isArray(response) ? response : response?.items || []))
      .catch(() => setPatients([]))
      .finally(() => setPatientsLoading(false));
  }, [form.audienceType, patients.length, patientsLoading]);

  const audience = useMemo(() => buildAudience(form), [form]);
  const audienceKey = useDeferredValue(JSON.stringify(audience));
  const incomplete = audienceIncomplete(form);

  useEffect(() => {
    // Judge completeness from the deferred value itself so a stale, empty
    // audience is never sent while the deferred render catches up.
    const deferredAudience = JSON.parse(audienceKey);
    if (!audienceReady(deferredAudience)) {
      setPreview(null);
      setPreviewError('');
      return undefined;
    }
    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError('');
    pushCampaignsApi.previewAudience(deferredAudience, { signal: controller.signal })
      .then(setPreview)
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setPreview(null);
        setPreviewError(error.message || '無法預覽發送對象');
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });
    return () => controller.abort();
  }, [audienceKey]);

  const loadList = useCallback(async (signal) => {
    setListLoading(true);
    setListError('');
    try {
      const response = await pushCampaignsApi.getCampaigns({
        status: statusFilter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, signal,
      });
      setList(response || { items: [], total: 0 });
    } catch (error) {
      if (error.name !== 'AbortError') setListError(error.message || '推播紀錄載入失敗');
    } finally {
      if (!signal?.aborted) setListLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    loadList(controller.signal);
    return () => controller.abort();
  }, [loadList]);

  const hasInFlight = list.items.some((item) => item.status === 'sending' || (item.status === 'scheduled' && item.send_mode === 'immediate'));
  useEffect(() => {
    if (!hasInFlight) return undefined;
    const timer = window.setInterval(() => loadList(), 5000);
    return () => window.clearInterval(timer);
  }, [hasInFlight, loadList]);

  const filteredPatients = useMemo(() => {
    const keyword = patientSearch.trim().toLowerCase();
    if (!keyword) return patients;
    return patients.filter((patient) => [patient.display_name, patient.username]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [patientSearch, patients]);

  const togglePatient = (patientId) => {
    setFormError('');
    setForm((current) => ({
      ...current,
      userIds: current.userIds.includes(patientId)
        ? current.userIds.filter((id) => id !== patientId)
        : [...current.userIds, patientId],
    }));
  };

  const toggleRegion = (region) => {
    setFormError('');
    setForm((current) => ({
      ...current,
      regions: current.regions.includes(region)
        ? current.regions.filter((value) => value !== region)
        : [...current.regions, region],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (incomplete) {
      setFormError(form.audienceType === 'users' ? '請至少選擇一位個案。' : '請至少設定一個群組條件。');
      return;
    }
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('請填寫推播標題與內容。');
      return;
    }
    let scheduledAt = null;
    if (form.sendMode === 'scheduled') {
      const parsed = form.scheduledAt ? new Date(form.scheduledAt) : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now()) {
        setFormError('請選擇晚於現在的排程時間。');
        return;
      }
      scheduledAt = parsed.toISOString();
    }
    const count = preview?.count;
    const when = form.sendMode === 'scheduled' ? `於 ${formatTime(scheduledAt)} 排程發送` : '立即發送';
    if (!(await requestConfirm(`確定要${when}給「${preview?.audience_label || '所選對象'}」${count ? ` 共 ${count} 位` : ''}嗎？`))) return;

    setSubmitting(true);
    setFormError('');
    try {
      await pushCampaignsApi.createCampaign({
        title: form.title.trim(),
        content: form.content.trim(),
        link_url: form.linkUrl.trim() || null,
        audience,
        send_mode: form.sendMode,
        scheduled_at: scheduledAt,
      });
      showToast(form.sendMode === 'scheduled' ? '排程推播已建立' : '推播已送出，正在發送中', 'success');
      setForm((current) => ({ ...current, title: '', content: '', linkUrl: '', scheduledAt: '' }));
      if (page === 1) await loadList();
      else setPage(1);
    } catch (error) {
      setFormError(error.message || '推播建立失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (campaignId) => {
    setDetailLoading(true);
    setDetail({ id: campaignId });
    try {
      setDetail(await pushCampaignsApi.getCampaign(campaignId));
    } catch (error) {
      showToast(error.message || '推播紀錄載入失敗', 'error');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const cancelCampaign = async () => {
    if (!detail?.id || !(await requestConfirm('確定要取消這則排程推播嗎？取消後不會發送給任何人。'))) return;
    setCancelling(true);
    try {
      setDetail(await pushCampaignsApi.cancelCampaign(detail.id));
      showToast('排程推播已取消', 'success');
      await loadList();
    } catch (error) {
      showToast(error.message || '取消失敗', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((list.total || 0) / PAGE_SIZE));
  const minSchedule = toLocalInputValue(new Date(Date.now() + 60000));

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-5">
      <header>
        <p className="text-sm font-bold tracking-wide text-primary/55">PUSH MESSAGES</p>
        <h1 className="mt-1 text-2xl font-bold text-primary md:text-3xl">推播訊息</h1>
        <p className="mt-2 text-sm font-medium text-text/55">依個案或群組發送 App 推播，可立即發送或預約時間；每則推播也會存入個案的 App 通知紀錄。</p>
      </header>

      <form onSubmit={submit} className="rounded-lg border border-sky-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-sky-100 px-5 py-3">
          <Megaphone size={17} className="text-primary/65" />
          <h2 className="text-sm font-bold text-text">建立推播</h2>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <section className="space-y-4">
            <div>
              <p className="text-xs font-bold text-text/55">1. 發送對象</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="發送對象">
                {[['all', '全部可管理個案'], ['group', '依群組'], ['users', '指定個案']].map(([value, label]) => (
                  <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold ${form.audienceType === value ? 'border-primary bg-primary text-white' : 'border-sky-200 text-primary hover:bg-sky-50'}`}>
                    <input type="radio" name="audienceType" aria-label={label} value={value} checked={form.audienceType === value} onChange={() => updateForm('audienceType', value)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {form.audienceType === 'group' && (
              <div className="space-y-3 rounded-lg border border-sky-100 bg-sky-50/30 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-bold text-text/55">組別
                    <select aria-label="組別" value={form.role} onChange={(event) => updateForm('role', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm font-medium text-text">
                      <option value="">不限</option>
                      {options.roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-text/55">心理組
                    <select aria-label="心理組" value={form.isPsychiatric} onChange={(event) => updateForm('isPsychiatric', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm font-medium text-text">
                      {triState.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-text/55">口腔組
                    <select aria-label="口腔組" value={form.isDental} onChange={(event) => updateForm('isDental', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm font-medium text-text">
                      {triState.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
                <fieldset>
                  <legend className="text-xs font-bold text-text/55">地區（可複選，不選則不限）</legend>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {options.regions.map((region) => (
                      <label key={region} className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-1.5 text-sm font-medium text-text/75">
                        <input type="checkbox" aria-label={`地區：${region}`} checked={form.regions.includes(region)} onChange={() => toggleRegion(region)} className="h-4 w-4 accent-primary" />
                        {region}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="text-xs text-text/45">多個條件會同時套用（例如「實驗組」且「口腔組」）。</p>
              </div>
            )}

            {form.audienceType === 'users' && (
              <div className="rounded-lg border border-sky-100 bg-sky-50/30 p-4">
                <div className="flex items-center gap-2">
                  <label className="relative block flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
                    <input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="搜尋姓名或帳號" aria-label="搜尋個案" className="h-10 w-full rounded-lg border border-sky-100 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary/40" />
                  </label>
                  <span className="shrink-0 text-xs font-bold text-primary">已選 {form.userIds.length} 位</span>
                  {form.userIds.length > 0 && <button type="button" onClick={() => updateForm('userIds', [])} className="shrink-0 text-xs font-bold text-text/50 hover:underline">清除</button>}
                </div>
                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-sky-100 bg-white">
                  {patientsLoading ? (
                    <p className="flex items-center gap-2 px-3 py-4 text-sm text-text/45"><Loader2 size={15} className="animate-spin" />載入個案中</p>
                  ) : filteredPatients.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-text/45">沒有符合的個案</p>
                  ) : filteredPatients.map((patient) => (
                    <label key={patient.id} className="flex cursor-pointer items-center gap-3 border-b border-sky-50 px-3 py-2 text-sm last:border-b-0 hover:bg-sky-50/60">
                      <input type="checkbox" aria-label={`選擇 ${patientName(patient)}`} checked={form.userIds.includes(patient.id)} onChange={() => togglePatient(patient.id)} className="h-4 w-4 accent-primary" />
                      <span className="font-bold text-text">{patientName(patient)}</span>
                      <span className="truncate text-xs text-text/45">@{patient.username}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-sky-100 px-4 py-3 text-sm" aria-live="polite">
              <div className="flex items-center gap-2 font-bold text-text/70"><UsersRound size={16} className="text-primary/60" />發送對象預覽</div>
              {incomplete ? (
                <p className="mt-1 text-xs text-text/45">{form.audienceType === 'users' ? '請選擇個案。' : '請設定至少一個群組條件。'}</p>
              ) : previewLoading ? (
                <p className="mt-1 flex items-center gap-2 text-xs text-text/45"><Loader2 size={13} className="animate-spin" />計算中</p>
              ) : previewError ? (
                <p className="mt-1 text-xs font-bold text-rose-700">{previewError}</p>
              ) : preview ? (
                <>
                  <p className="mt-1 text-text"><span className="font-bold">{preview.audience_label}</span>：共 <span className="font-bold text-primary">{preview.count}</span> 位，其中 {preview.with_token_count} 位已開啟 App 推播</p>
                  {preview.count > preview.with_token_count && <p className="mt-0.5 text-xs text-text/45">未開啟推播的個案仍會在 App 通知列表看到這則訊息。</p>}
                  {preview.users.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-text/50">{preview.users.map((user) => user.display_name).join('、')}{preview.count > preview.users.length ? ` 等 ${preview.count} 位` : ''}</p>}
                </>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <p className="text-xs font-bold text-text/55">2. 推播內容</p>
            <label className="block text-xs font-bold text-text/55">標題
              <input value={form.title} maxLength={TITLE_MAX} onChange={(event) => updateForm('title', event.target.value)} placeholder="例如：十月健康講座報名開始" className="mt-1 h-10 w-full rounded-lg border border-sky-100 px-3 text-sm font-medium text-text outline-none focus:border-primary/40" />
            </label>
            <label className="block text-xs font-bold text-text/55">內容 <span className="font-medium text-text/40">{form.content.length}/{CONTENT_MAX}</span>
              <textarea value={form.content} maxLength={CONTENT_MAX} rows={4} onChange={(event) => updateForm('content', event.target.value)} placeholder="課程時間、地點與注意事項" className="mt-1 w-full rounded-lg border border-sky-100 px-3 py-2 text-sm font-medium text-text outline-none focus:border-primary/40" />
            </label>
            <label className="block text-xs font-bold text-text/55"><span className="inline-flex items-center gap-1"><Link2 size={13} />報名或說明連結（選填）</span>
              <input type="url" value={form.linkUrl} onChange={(event) => updateForm('linkUrl', event.target.value)} placeholder="https://" className="mt-1 h-10 w-full rounded-lg border border-sky-100 px-3 text-sm font-medium text-text outline-none focus:border-primary/40" />
              <span className="mt-1 block font-medium text-text/40">連結會附在推播內容的最後一行，長輩在 App 通知中可看到。</span>
            </label>

            <p className="pt-1 text-xs font-bold text-text/55">3. 發送時間</p>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="發送時間">
              {[['immediate', '立即發送'], ['scheduled', '排程發送']].map(([value, label]) => (
                <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold ${form.sendMode === value ? 'border-primary bg-primary text-white' : 'border-sky-200 text-primary hover:bg-sky-50'}`}>
                  <input type="radio" name="sendMode" aria-label={label} value={value} checked={form.sendMode === value} onChange={() => updateForm('sendMode', value)} className="sr-only" />
                  {label}
                </label>
              ))}
              {form.sendMode === 'scheduled' && (
                <input type="datetime-local" value={form.scheduledAt} min={minSchedule} onChange={(event) => updateForm('scheduledAt', event.target.value)} aria-label="排程發送時間" className="h-10 rounded-lg border border-sky-100 px-3 text-sm font-medium text-text" />
              )}
            </div>
            {form.sendMode === 'scheduled' && <p className="text-xs text-text/45">以台灣時間計，系統每分鐘檢查一次；發送前可在下方紀錄取消。</p>}

            {formError && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert size={16} className="mt-0.5 shrink-0" />{formError}</p>}
            <button type="submit" disabled={submitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : form.sendMode === 'scheduled' ? <CalendarClock size={16} /> : <Send size={16} />}
              {form.sendMode === 'scheduled' ? '建立排程' : '立即發送'}
            </button>
          </section>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-sky-100 px-4 py-3">
          <h2 className="text-sm font-bold text-text">發送紀錄</h2>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="推播狀態" className="h-9 rounded-lg border border-sky-100 px-3 text-sm font-medium">
            <option value="">全部狀態</option>
            {Object.entries(campaignStatus).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" onClick={() => loadList()} disabled={listLoading} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-1.5 text-sm font-bold text-primary hover:bg-sky-50 disabled:opacity-50">
            <RefreshCw size={14} className={listLoading ? 'animate-spin' : ''} />重新整理
          </button>
        </div>
        {listLoading && list.items.length === 0 ? (
          <p className="flex min-h-[160px] items-center justify-center gap-2 text-sm text-text/45"><Loader2 size={17} className="animate-spin" />載入推播紀錄中</p>
        ) : listError ? (
          <p className="flex min-h-[160px] items-center justify-center gap-2 text-sm font-bold text-rose-700"><CircleAlert size={17} />{listError}</p>
        ) : list.items.length === 0 ? (
          <p className="flex min-h-[160px] items-center justify-center text-sm text-text/45">目前沒有推播紀錄</p>
        ) : (
          <ul className="divide-y divide-sky-50">
            {list.items.map((item) => {
              const statusInfo = campaignStatus[item.status] || campaignStatus.scheduled;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => openDetail(item.id)} className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-sky-50/60 md:flex-row md:items-center md:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-2 py-0.5 text-xs font-bold ${statusInfo.className}`}>{statusInfo.label}</span>
                        <span className="truncate font-bold text-text">{item.title}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-text/50">{item.audience_label}・建立者 {item.created_by_name || '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-0.5 text-xs text-text/55 md:min-w-[380px] md:grid-cols-[1.4fr_1fr]">
                      <span>{item.send_mode === 'scheduled' ? '排程' : '發送'}：{formatTime(item.status === 'sent' ? item.completed_at || item.scheduled_at : item.scheduled_at)}</span>
                      <span>對象 {item.recipient_count} 位</span>
                      <span className="col-span-2">{item.status === 'cancelled' ? '已取消，未發送給任何人' : `已推播 ${item.sent_count}・未開啟推播 ${item.no_token_count}・失敗 ${item.failed_count}${item.pending_count > 0 ? `・等待 ${item.pending_count}` : ''}`}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {list.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-sky-100 px-4 py-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-2 text-sm font-bold text-primary disabled:opacity-40"><ChevronLeft size={16} />上一頁</button>
            <span className="text-xs text-text/45">第 {page} / {totalPages} 頁</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-2 text-sm font-bold text-primary disabled:opacity-40">下一頁<ChevronRight size={16} /></button>
          </div>
        )}
      </section>

      {detail && (
        <Modal title={detail.title || '推播紀錄'} onClose={() => setDetail(null)}>
          {detailLoading ? (
            <p className="flex items-center justify-center gap-2 p-10 text-sm text-text/45"><Loader2 size={17} className="animate-spin" />載入中</p>
          ) : (
            <div className="space-y-4 p-5">
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-bold text-text/45">狀態</dt><dd className="font-bold">{campaignStatus[detail.status]?.label}</dd></div>
                <div><dt className="text-xs font-bold text-text/45">發送對象</dt><dd>{detail.audience_type === 'users' ? detail.audience_label : `${detail.audience_label}（${detail.recipient_count} 位）`}</dd></div>
                <div><dt className="text-xs font-bold text-text/45">{detail.send_mode === 'scheduled' ? '排程時間' : '建立時間'}</dt><dd>{formatTime(detail.scheduled_at)}</dd></div>
                <div><dt className="text-xs font-bold text-text/45">完成時間</dt><dd>{detail.status === 'cancelled' ? `已於 ${formatTime(detail.cancelled_at)} 取消` : formatTime(detail.completed_at)}</dd></div>
              </dl>
              <div className="rounded-lg border border-sky-100 bg-sky-50/30 p-3 text-sm">
                <p className="whitespace-pre-wrap text-text">{detail.content}</p>
                {detail.link_url && <a href={detail.link_url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs font-bold text-primary hover:underline"><Link2 size={13} />{detail.link_url}</a>}
              </div>
              {detail.status === 'scheduled' && detail.send_mode === 'scheduled' && (
                <button type="button" onClick={cancelCampaign} disabled={cancelling} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                  {cancelling && <Loader2 size={14} className="animate-spin" />}取消排程
                </button>
              )}
              <div>
                <p className="text-xs font-bold text-text/55">發送對象與結果</p>
                <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-sky-100">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-sky-50 text-xs text-text/55">
                      <tr><th className="px-3 py-2 font-bold">個案</th><th className="px-3 py-2 font-bold">結果</th><th className="px-3 py-2 font-bold">裝置</th></tr>
                    </thead>
                    <tbody className="divide-y divide-sky-50">
                      {(detail.recipients || []).map((recipient) => {
                        const info = detail.status === 'cancelled' && recipient.status === 'pending'
                          ? { label: '未發送（已取消）', className: 'text-text/45' }
                          : recipientStatus[recipient.status] || recipientStatus.pending;
                        return (
                          <tr key={recipient.user_id}>
                            <td className="px-3 py-2"><span className="font-bold text-text">{recipient.display_name || '—'}</span> <span className="text-xs text-text/45">@{recipient.username}</span></td>
                            <td className={`px-3 py-2 text-xs font-bold ${info.className}`}>{info.label}{recipient.error ? <span className="block font-medium text-text/45">{recipient.error}</span> : null}</td>
                            <td className="px-3 py-2 text-xs text-text/55">{recipient.token_count ? `${recipient.success_count}/${recipient.token_count}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default PushCampaignManager;
