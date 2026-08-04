import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileWarning,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { careOutreachApi } from '../api/careOutreach';
import { managementApi } from '../api/management';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';

const statusLabels = {
  open: '待接手', acknowledged: '已接手', contacted: '已聯絡', monitoring: '追蹤中', resolved: '已結案', false_positive: '誤判',
};

const severityLabels = { critical: '緊急', high: '高風險', normal: '需留意', low: '一般' };

const severityStyles = {
  critical: 'border-rose-200 bg-rose-50 text-rose-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  normal: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-sky-200 bg-sky-50 text-sky-700',
};

const sourceLabels = {
  ai_safety: 'AI 安全警示',
  questionnaire_validation: '問卷資料檢核',
  questionnaire_query: '問卷資料檢核',
  questionnaire: '問卷資料檢核',
};

const reasonOptions = [
  ['technical_problem', '技術問題'],
  ['forgot_password', '忘記密碼'],
  ['cannot_operate', '不會操作'],
  ['cannot_find_app', '找不到 APP'],
  ['update_changed_ui', '更新後介面改變'],
  ['device_problem', '裝置問題'],
  ['health_condition', '健康因素'],
  ['hospitalized', '住院'],
  ['family_matter', '家庭因素'],
  ['low_motivation', '動機較低'],
  ['does_not_see_benefit', '不清楚使用效益'],
  ['does_not_understand_purpose', '不清楚計畫目的'],
  ['ai_concern', 'AI 對話關懷'],
  ['questionnaire_concern', '問卷資料確認'],
  ['other', '其他'],
];

const sourceLabel = (source) => sourceLabels[source] || (source ? '其他系統來源' : '未分類來源');

const formatDateTime = (value) => {
  if (!value) return '未記錄';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未記錄';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const toLocalDateTime = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const getSubject = (item) => item?.subject || item?.patient || {};

const subjectName = (item) => item?.subject_display_name || item?.subject_name || getSubject(item).display_name || getSubject(item).name || '未命名個案';

const subjectUsername = (item) => item?.subject_username || item?.subject_account || getSubject(item).username || '';

const getPayload = (payload) => ({
  caseData: payload?.case || payload?.item || payload,
  triggers: payload?.triggers || payload?.case?.triggers || payload?.item?.triggers || [],
  contacts: payload?.contacts || payload?.case?.contacts || payload?.item?.contacts || [],
  statusLogs: payload?.status_logs || payload?.statusLogs || payload?.case?.status_logs || payload?.item?.status_logs || [],
});

const getAssignedManagerId = (item) => item?.assigned_manager_user_id || item?.assigned_manager_id || item?.assigned_manager?.id || '';

const getSource = (trigger) => trigger?.source || trigger?.source_type || trigger?.trigger_type || '';

const triggerSummary = (trigger) => {
  const evidence = trigger?.evidence || {};
  if (getSource(trigger) === 'questionnaire_validation') {
    const questionnaire = evidence.template_title || '問卷';
    const field = evidence.field_label || '欄位';
    return `${questionnaire}：${field}需要確認${evidence.rule_text ? `（${evidence.rule_text}）` : ''}`;
  }
  const riskLabels = {
    self_harm_or_suicide: '對話出現自傷或自殺相關安全訊號',
    emotional_distress: '對話出現明顯情緒困擾訊號',
    historical_self_harm: '對話提及過往自傷相關情形',
  };
  return riskLabels[evidence.risk_type] || '系統偵測到需要人工確認的關懷訊號';
};

const Modal = ({ title, children, onClose, wide = false }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation">
    <div className={`max-h-[90vh] w-full overflow-hidden rounded-lg border border-sky-100 bg-white shadow-xl ${wide ? 'max-w-2xl' : 'max-w-md'}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between border-b border-sky-100 px-5 py-4">
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        <button type="button" onClick={onClose} aria-label="關閉視窗" className="rounded-lg p-1.5 text-text/40 hover:bg-sky-50 hover:text-text"><X size={18} /></button>
      </div>
      <div className="max-h-[calc(90vh-132px)] overflow-y-auto">{children}</div>
    </div>
  </div>
);

const CareOutreachDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { showToast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [managers, setManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [actionForm, setActionForm] = useState({ assignedManagerId: '', resolutionNote: '' });
  const [contactForm, setContactForm] = useState({
    contactedAt: toLocalDateTime(),
    channel: 'phone',
    outcome: 'reached',
    reasonCodes: [],
    reasonOther: '',
    interventionNote: '',
    followUpAt: '',
  });

  const loadDetail = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await careOutreachApi.getCase(caseId, { signal });
      setDetail(getPayload(response));
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message || '關懷案件載入失敗');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const controller = new AbortController();
    loadDetail(controller.signal);
    return () => controller.abort();
  }, [loadDetail]);

  const caseData = detail?.caseData;
  const triggers = detail?.triggers || [];
  const contacts = detail?.contacts || [];
  const statusLogs = detail?.statusLogs || [];
  const isClosed = ['resolved', 'false_positive'].includes(caseData?.status);
  const severity = caseData?.highest_severity || caseData?.severity || 'low';
  const isOverdue = Boolean(caseData?.overdue) || (!isClosed && caseData?.due_at && new Date(caseData.due_at).getTime() < Date.now());

  const managerItems = useMemo(() => {
    if (Array.isArray(managers)) return managers;
    return managers?.items || managers?.data || [];
  }, [managers]);

  const openAction = async (action) => {
    setActionForm({
      assignedManagerId: getAssignedManagerId(caseData) ? String(getAssignedManagerId(caseData)) : '',
      resolutionNote: '',
    });
    setModal({ type: 'action', action });
    if (action === 'assign' && isAdmin && managerItems.length === 0) {
      setLoadingManagers(true);
      try {
        const assignments = await managementApi.getUserManagerAssignments(caseData.subject_user_id);
        setManagers((Array.isArray(assignments) ? assignments : assignments?.items || []).map((item) => item.manager || item));
      } catch (managerError) {
        showToast(`個管師清單載入失敗：${managerError.message}`, 'error');
      } finally {
        setLoadingManagers(false);
      }
    }
  };

  const actionMeta = {
    acknowledge: { title: '接手案件', confirm: '確認接手' },
    take_ownership: { title: '接手案件', confirm: '確認接手' },
    monitor: { title: '開始追蹤', confirm: '確認開始追蹤' },
    resolve: { title: '結案', confirm: '確認結案' },
    false_positive: { title: '標示誤判', confirm: '確認標示誤判' },
    assign: { title: '指派個管師', confirm: '確認指派' },
  };

  const executeAction = async () => {
    const action = modal?.action;
    if (!action) return;
    if (['resolve', 'false_positive'].includes(action) && !actionForm.resolutionNote.trim()) {
      showToast('請填寫處理說明或判定理由', 'error');
      return;
    }
    if (action === 'assign' && !actionForm.assignedManagerId) {
      showToast('請選擇個管師', 'error');
      return;
    }
    setBusy(true);
    try {
      const actionPayload = {
        action,
        expected_status: caseData?.status,
      };
      if (action === 'assign') actionPayload.assigned_manager_user_id = Number(actionForm.assignedManagerId);
      if (['resolve', 'false_positive'].includes(action)) actionPayload.resolution_note = actionForm.resolutionNote.trim();
      await careOutreachApi.updateCase(caseId, actionPayload);
      setModal(null);
      await loadDetail();
      showToast(action === 'false_positive' ? '案件已標示為誤判' : action === 'resolve' ? '案件已結案' : '案件狀態已更新', 'success');
    } catch (actionError) {
      showToast(actionError.message || '案件狀態更新失敗', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openContact = () => {
    setContactForm({ contactedAt: toLocalDateTime(), channel: 'phone', outcome: 'reached', reasonCodes: [], reasonOther: '', interventionNote: '', followUpAt: '' });
    setModal({ type: 'contact' });
  };

  const submitContact = async (event) => {
    event.preventDefault();
    if (!contactForm.contactedAt || !contactForm.channel || !contactForm.outcome || !contactForm.interventionNote.trim()) {
      showToast('聯絡時間、方式、結果與處遇紀錄皆為必填', 'error');
      return;
    }
    setBusy(true);
    try {
      await careOutreachApi.addContact(caseId, {
        contacted_at: new Date(contactForm.contactedAt).toISOString(),
        channel: contactForm.channel,
        outcome: contactForm.outcome,
        reason_codes: contactForm.reasonCodes,
        reason_other: contactForm.reasonOther.trim() || null,
        intervention_note: contactForm.interventionNote.trim(),
        follow_up_at: contactForm.followUpAt ? new Date(contactForm.followUpAt).toISOString() : null,
      });
      setModal(null);
      await loadDetail();
      showToast('聯絡紀錄已新增', 'success');
    } catch (contactError) {
      showToast(contactError.message || '聯絡紀錄新增失敗', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex min-h-[680px] items-center justify-center gap-2 text-sm text-text/45"><Loader2 size={20} className="animate-spin" />載入關懷案件中</div>;

  if (error || !caseData) return (
    <div className="mx-auto flex min-h-[680px] max-w-xl flex-col items-center justify-center gap-4 text-center">
      <ShieldAlert size={38} className="text-rose-500" />
      <h1 className="text-xl font-bold text-primary">找不到這筆關懷案件</h1>
      <p className="text-sm leading-6 text-text/55">{error || '案件可能不存在、已被移除，或您目前沒有查看權限。'}</p>
      <button type="button" onClick={() => navigate('/care-outreach')} className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-bold text-primary hover:bg-sky-50">返回案件列表</button>
    </div>
  );

  return (
    <div className="care-outreach-page mx-auto flex min-h-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => navigate('/care-outreach')} aria-label="返回關懷案件列表" className="rounded-lg border border-sky-200 bg-white p-2 text-primary hover:bg-sky-50"><ArrowLeft size={19} /></button>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold tracking-wide text-primary/55">CARE OUTREACH</p><h1 className="truncate text-2xl font-bold text-primary">關懷案件詳情</h1></div>
        <button type="button" onClick={() => loadDetail()} disabled={loading} className="rounded-lg border border-sky-200 bg-white p-2 text-primary hover:bg-sky-50 disabled:opacity-50" aria-label="重新整理案件"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
      </header>

      <section className="rounded-lg border border-sky-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-sky-100 p-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-text">{subjectName(caseData)}</h2>{subjectUsername(caseData) && <span className="text-sm text-text/45">@{subjectUsername(caseData)}</span>}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold"><span className={`rounded border px-2.5 py-1 ${severityStyles[severity] || severityStyles.low}`}>{severityLabels[severity] || severity}</span><span className="rounded border border-sky-100 bg-sky-50 px-2.5 py-1 text-primary/75">{sourceLabel(getSource(triggers[0]) || caseData.source)}</span><span className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">{statusLabels[caseData.status] || caseData.status || '未設定'}</span>{isOverdue && <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700"><CalendarClock size={13} />已逾期</span>}</div>
            <p className="mt-3 text-xs text-text/45">案件編號 #{caseData.id} · 建立於 {formatDateTime(caseData.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {!isClosed && ['open', 'acknowledged'].includes(caseData.status) && <button type="button" onClick={() => openAction('take_ownership')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary-light"><UserCheck size={16} />接手</button>}
            {!isClosed && <button type="button" onClick={openContact} className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50"><Phone size={16} />新增聯絡</button>}
            {!isClosed && caseData.status !== 'monitoring' && caseData.status !== 'open' && <button type="button" onClick={() => openAction('monitor')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50"><Clock3 size={16} />開始追蹤</button>}
            {!isClosed && isAdmin && <button type="button" onClick={() => openAction('assign')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50"><UsersRound size={16} />指派</button>}
            {!isClosed && <button type="button" onClick={() => openAction('false_positive')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 hover:bg-rose-50"><AlertTriangle size={16} />誤判</button>}
            {!isClosed && <button type="button" onClick={() => openAction('resolve')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"><CheckCircle2 size={16} />結案</button>}
          </div>
        </div>
        <div className="grid gap-4 p-5 text-sm md:grid-cols-3">
          <div><p className="text-xs font-bold text-text/45">到期時間</p><p className={`mt-1 font-medium ${isOverdue ? 'text-rose-700' : 'text-text'}`}>{formatDateTime(caseData.due_at)}{isOverdue ? '（已逾期）' : ''}</p></div>
          <div><p className="text-xs font-bold text-text/45">負責個管師</p><p className="mt-1 font-medium text-text">{caseData.assigned_manager_name || caseData.assigned_manager?.display_name || (getAssignedManagerId(caseData) ? `帳號 #${getAssignedManagerId(caseData)}` : '尚未指派')}</p></div>
          <div><p className="text-xs font-bold text-text/45">最近更新</p><p className="mt-1 font-medium text-text">{formatDateTime(caseData.updated_at || caseData.created_at)}</p></div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="rounded-lg border border-sky-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-sky-100 px-5 py-4"><ShieldAlert size={18} className="text-primary/65" /><h2 className="font-bold text-text">觸發來源</h2><span className="ml-auto text-xs text-text/40">{triggers.length} 筆</span></div>
          {triggers.length === 0 ? <p className="p-5 text-sm text-text/45">尚無觸發來源紀錄</p> : <div className="divide-y divide-sky-50">{triggers.map((trigger) => <div key={trigger.id || `${trigger.trigger_type}-${trigger.source_event_id}`} className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><span className={`rounded border px-2 py-0.5 text-xs font-bold ${severityStyles[trigger.severity] || severityStyles.low}`}>{severityLabels[trigger.severity] || trigger.severity || '一般'}</span><span className="rounded border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs font-bold text-primary/75">{sourceLabel(getSource(trigger))}</span>{trigger.source_status && <span className="text-xs text-text/45">來源狀態：{trigger.source_status}</span>}</div><p className="mt-2 text-sm leading-6 text-text/70">{triggerSummary(trigger)}</p><div className="mt-2 grid gap-1 text-xs text-text/50 sm:grid-cols-2"><span>發現：{formatDateTime(trigger.detected_at)}</span><span>期限：{formatDateTime(trigger.due_at)}</span></div></div>)}</div>}
        </section>

        <section className="rounded-lg border border-sky-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-sky-100 px-5 py-4"><MessageCircle size={18} className="text-primary/65" /><h2 className="font-bold text-text">聯絡紀錄</h2><span className="ml-auto text-xs text-text/40">{contacts.length} 筆</span></div>
          {contacts.length === 0 ? <div className="p-5"><p className="text-sm text-text/45">尚無人工聯絡紀錄</p>{!isClosed && <button type="button" onClick={openContact} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sky-200 px-3 py-2 text-sm font-bold text-primary hover:bg-sky-50"><Phone size={15} />新增聯絡</button>}</div> : <div className="divide-y divide-sky-50">{contacts.map((contact) => <div key={contact.id || contact.contacted_at} className="px-5 py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-text">{contact.channel || '未記錄方式'} · {contact.outcome || '未記錄結果'}</p><p className="mt-1 text-xs text-text/45">{formatDateTime(contact.contacted_at)} · {contact.recorded_by_name_snapshot || contact.recorded_by_name || '未記錄人員'}</p></div><Phone size={16} className="mt-0.5 text-primary/45" /></div>{contact.intervention_note && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-sky-50/70 p-3 text-sm leading-6 text-text/75">{contact.intervention_note}</p>}{contact.follow_up_at && <p className="mt-2 text-xs text-text/45">下次追蹤：{formatDateTime(contact.follow_up_at)}</p>}</div>)}</div>}
        </section>
      </div>

      <section className="rounded-lg border border-sky-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-sky-100 px-5 py-4"><Clock3 size={18} className="text-primary/65" /><h2 className="font-bold text-text">案件狀態歷程</h2></div>
        {statusLogs.length === 0 ? <p className="p-5 text-sm text-text/45">尚無狀態異動紀錄</p> : <div className="divide-y divide-sky-50">{statusLogs.map((log) => <div key={log.id || `${log.created_at}-${log.action}`} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[180px_minmax(0,1fr)_180px]"><div className="text-xs text-text/45">{formatDateTime(log.created_at || log.changed_at)}</div><div><p className="font-bold text-text">{log.action || '狀態更新'}{log.from_status && log.to_status && <span className="ml-2 font-medium text-text/50">{statusLabels[log.from_status] || log.from_status} → {statusLabels[log.to_status] || log.to_status}</span>}</p>{log.note && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text/65">{log.note}</p>}</div><div className="text-xs text-text/45">{log.actor_name_snapshot || log.actor_name || (log.actor_user_id ? `帳號 #${log.actor_user_id}` : '系統')}</div></div>)}</div>}
      </section>

      <div className="flex flex-wrap items-center gap-3 pb-4 text-xs text-text/45"><FileWarning size={15} />案件畫面僅顯示處理所需的摘要與歷程。{user?.display_name && <span className="ml-auto">目前操作人：{user.display_name}</span>}</div>

      {modal?.type === 'action' && <Modal title={actionMeta[modal.action]?.title || '更新案件'} onClose={() => setModal(null)}>
        <div className="space-y-4 p-5">
          {modal.action === 'assign' && <label className="block"><span className="text-xs font-bold text-text/55">選擇個管師</span>{loadingManagers ? <div className="mt-2 flex h-11 items-center justify-center rounded-lg border border-sky-100 text-sm text-text/45"><Loader2 size={17} className="animate-spin" /></div> : <select value={actionForm.assignedManagerId} onChange={(event) => setActionForm((current) => ({ ...current, assignedManagerId: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-sky-100 px-3 text-sm outline-none focus:border-primary/40"><option value="">請選擇個管師</option>{managerItems.map((manager) => <option key={manager.id} value={manager.id}>{manager.display_name || manager.name || manager.username || `帳號 #${manager.id}`}</option>)}</select>}</label>}
          {['resolve', 'false_positive'].includes(modal.action) && <label className="block"><span className="text-xs font-bold text-text/55">{modal.action === 'resolve' ? '結案說明' : '誤判理由'}（必填）</span><textarea value={actionForm.resolutionNote} onChange={(event) => setActionForm((current) => ({ ...current, resolutionNote: event.target.value }))} rows={5} placeholder={modal.action === 'resolve' ? '請記錄處理結果與後續安排' : '請記錄判定為誤判的原因'} className="mt-2 w-full resize-none rounded-lg border border-sky-100 p-3 text-sm outline-none focus:border-primary/40" /></label>}
          {!['assign', 'resolve', 'false_positive'].includes(modal.action) && <p className="text-sm leading-6 text-text/65">確認後將把此案件更新為「{modal.action === 'monitor' ? '追蹤中' : '已接手'}」。狀態異動會留下案件歷程。</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-sky-100 px-5 py-4"><button type="button" onClick={() => setModal(null)} disabled={busy} className="h-10 rounded-lg border border-sky-200 px-4 text-sm font-bold text-text/60 hover:bg-sky-50">取消</button><button type="button" onClick={executeAction} disabled={busy || loadingManagers} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary-light disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />}{actionMeta[modal.action]?.confirm || '確認'}</button></div>
      </Modal>}

      {modal?.type === 'contact' && <Modal title="新增聯絡紀錄" onClose={() => setModal(null)} wide>
        <form onSubmit={submitContact} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-xs font-bold text-text/55">聯絡時間（必填）</span><input type="datetime-local" value={contactForm.contactedAt} onChange={(event) => setContactForm((current) => ({ ...current, contactedAt: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-sky-100 px-3 text-sm outline-none focus:border-primary/40" /></label><label className="block"><span className="text-xs font-bold text-text/55">聯絡方式（必填）</span><select value={contactForm.channel} onChange={(event) => setContactForm((current) => ({ ...current, channel: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-sky-100 px-3 text-sm outline-none focus:border-primary/40"><option value="phone">電話</option><option value="message">訊息（LINE／Email）</option><option value="in_person">面談</option><option value="other">其他</option></select></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-xs font-bold text-text/55">聯絡結果（必填）</span><select value={contactForm.outcome} onChange={(event) => setContactForm((current) => ({ ...current, outcome: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-sky-100 px-3 text-sm outline-none focus:border-primary/40"><option value="reached">已聯絡</option><option value="no_answer">未接通</option><option value="callback_scheduled">已約定後續聯絡</option><option value="refused">拒絕聯絡</option><option value="other">其他</option></select></label><label className="block"><span className="text-xs font-bold text-text/55">下次追蹤時間（選填）</span><input type="datetime-local" value={contactForm.followUpAt} onChange={(event) => setContactForm((current) => ({ ...current, followUpAt: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-sky-100 px-3 text-sm outline-none focus:border-primary/40" /></label></div>
          <fieldset className="rounded-lg border border-sky-100 p-3"><legend className="px-1 text-xs font-bold text-text/55">關懷原因（可複選）</legend><div className="mt-1 grid gap-2 sm:grid-cols-2 md:grid-cols-3">{reasonOptions.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm text-text/70"><input type="checkbox" checked={contactForm.reasonCodes.includes(value)} onChange={(event) => setContactForm((current) => ({ ...current, reasonCodes: event.target.checked ? [...current.reasonCodes, value] : current.reasonCodes.filter((item) => item !== value) }))} className="h-4 w-4 accent-primary" />{label}</label>)}</div></fieldset>
          <label className="block"><span className="text-xs font-bold text-text/55">其他說明（選填）</span><input value={contactForm.reasonOther} onChange={(event) => setContactForm((current) => ({ ...current, reasonOther: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-sky-100 px-3 text-sm outline-none focus:border-primary/40" /></label>
          <label className="block"><span className="text-xs font-bold text-text/55">處遇紀錄（必填）</span><textarea required value={contactForm.interventionNote} onChange={(event) => setContactForm((current) => ({ ...current, interventionNote: event.target.value }))} rows={6} placeholder="請記錄本次聯絡內容、處理情形與後續安排" className="mt-2 w-full resize-none rounded-lg border border-sky-100 p-3 text-sm outline-none focus:border-primary/40" /></label>
          <div className="flex justify-end gap-2 border-t border-sky-100 pt-4"><button type="button" onClick={() => setModal(null)} disabled={busy} className="h-10 rounded-lg border border-sky-200 px-4 text-sm font-bold text-text/60 hover:bg-sky-50">取消</button><button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary-light disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />}儲存聯絡紀錄</button></div>
        </form>
      </Modal>}
    </div>
  );
};

export default CareOutreachDetail;
