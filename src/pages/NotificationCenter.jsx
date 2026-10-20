import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Mail,
  MailCheck,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { managerNotificationsApi } from '../api/managerNotifications';
import { useToast } from '../context/useToast';


const statusLabels = {
  unread: '未讀',
  read: '已讀',
  acknowledged: '已接手',
  resolved: '已完成',
  false_positive: '誤判',
};

const severityStyles = {
  S3: { label: '緊急', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  S2: { label: '高風險', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  S1: { label: '需留意', className: 'border-sky-200 bg-sky-50 text-sky-700' },
};

const formatTime = (value) => {
  if (!value) return '未記錄';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
};

const NotificationCenter = () => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inbox, setInbox] = useState({ items: [], total: 0, summary: null });
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [selectedId, setSelectedId] = useState(() => Number(searchParams.get('alertId')) || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showResolution, setShowResolution] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [preference, setPreference] = useState(null);
  const [savingPreference, setSavingPreference] = useState(false);

  const selected = useMemo(
    () => inbox.items.find((item) => item.id === selectedId) || null,
    [inbox.items, selectedId],
  );

  const loadInbox = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const data = await managerNotificationsApi.getInbox({
        status, severity, search: deferredSearch, signal,
      });
      setInbox(data);
      setSelectedId((current) => (
        current && data.items.some((item) => item.id === current) ? current : null
      ));
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [deferredSearch, severity, status]);

  useEffect(() => {
    const controller = new AbortController();
    loadInbox(controller.signal);
    return () => controller.abort();
  }, [loadInbox]);

  useEffect(() => {
    if (selectedId) setSearchParams({ alertId: String(selectedId) }, { replace: true });
    else setSearchParams({}, { replace: true });
  }, [selectedId, setSearchParams]);

  const updateItem = useCallback(async (item, nextStatus, note = null) => {
    setUpdating(true);
    try {
      const updated = await managerNotificationsApi.updateStatus(item.id, nextStatus, note);
      setInbox((current) => ({
        ...current,
        items: current.items.map((entry) => (entry.id === updated.id ? updated : entry)),
        summary: current.summary ? {
          ...current.summary,
          unread: current.summary.unread - (item.status === 'unread' && nextStatus !== 'unread' ? 1 : 0),
        } : current.summary,
      }));
      window.dispatchEvent(new Event('manager-notifications-updated'));
      return updated;
    } catch (updateError) {
      showToast(updateError.message, 'error');
      return null;
    } finally {
      setUpdating(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selected?.status === 'unread') updateItem(selected, 'read');
  }, [selected, updateItem]);

  const openItem = (item) => {
    setSelectedId(item.id);
  };

  const openSettings = async () => {
    setShowSettings(true);
    try {
      setPreference(await managerNotificationsApi.getPreference());
    } catch (settingsError) {
      showToast(settingsError.message, 'error');
    }
  };

  const savePreference = async (event) => {
    event.preventDefault();
    setSavingPreference(true);
    try {
      const updated = await managerNotificationsApi.updatePreference({
        notification_email: preference.notification_email,
        email_enabled: preference.email_enabled,
      });
      setPreference(updated);
      setShowSettings(false);
      showToast('通知信箱設定已儲存', 'success');
    } catch (settingsError) {
      showToast(settingsError.message, 'error');
    } finally {
      setSavingPreference(false);
    }
  };

  const submitResolution = async () => {
    if (!resolutionNote.trim()) return;
    const updated = await updateItem(selected, showResolution, resolutionNote.trim());
    if (updated) {
      setShowResolution(null);
      setResolutionNote('');
      showToast(showResolution === 'resolved' ? '已完成處理' : '已標示為誤判', 'success');
    }
  };

  const summary = inbox.summary || { total: 0, unread: 0, urgent_open: 0, high_open: 0 };

  return (
    <div className="mx-auto flex h-full min-h-[680px] max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary md:text-3xl">通知中心</h1>
          <p className="mt-2 text-sm font-medium text-text/55">AI 安全警示需由個管師查看原文並完成人工確認</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={openSettings} className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50">
            <Settings size={16} />通知信箱
          </button>
          <button type="button" onClick={() => loadInbox()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />重新整理
          </button>
        </div>
      </header>

      <section className="grid overflow-hidden rounded-lg border border-sky-100 bg-white sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '全部通知', value: summary.total, icon: Bell },
          { label: '尚未查看', value: summary.unread, icon: Mail },
          { label: '緊急待處理', value: summary.urgent_open, icon: ShieldAlert },
          { label: '高風險待處理', value: summary.high_open, icon: AlertTriangle },
        ].map((item, index) => (
          <div key={item.label} className={`flex items-center gap-3 px-5 py-4 ${index ? 'border-t border-sky-100 sm:border-l sm:border-t-0' : ''}`}>
            <item.icon size={19} className="text-primary/60" />
            <div><p className="text-xs font-bold text-text/45">{item.label}</p><p className="mt-0.5 text-xl font-bold text-text">{item.value}</p></div>
          </div>
        ))}
      </section>

      <section className="grid min-h-0 flex-1 overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className={`${selectedId ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-sky-100`}>
          <div className="space-y-3 border-b border-sky-100 p-4">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋個案姓名或帳號" aria-label="搜尋通知" className="h-10 w-full rounded-lg border border-sky-100 bg-sky-50/30 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="通知狀態" className="h-10 rounded-lg border border-sky-100 bg-white px-3 text-sm font-medium">
                <option value="">全部狀態</option><option value="unread">未讀</option><option value="read">已讀</option><option value="acknowledged">已接手</option><option value="resolved">已完成</option><option value="false_positive">誤判</option>
              </select>
              <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="警示等級" className="h-10 rounded-lg border border-sky-100 bg-white px-3 text-sm font-medium">
                <option value="">全部等級</option><option value="S3">緊急</option><option value="S2">高風險</option><option value="S1">需留意</option>
              </select>
            </div>
            <p className="text-xs font-medium text-text/40">顯示 {inbox.total} 則通知</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? <div className="flex h-44 items-center justify-center gap-2 text-sm text-text/45"><Loader2 size={18} className="animate-spin" />載入通知中</div>
              : error ? <div className="p-6 text-center text-sm text-rose-600">{error}</div>
                : inbox.items.length === 0 ? <div className="p-8 text-center text-sm text-text/40">沒有符合目前條件的通知</div>
                  : inbox.items.map((item) => {
                    const severityStyle = severityStyles[item.severity] || severityStyles.S1;
                    return (
                      <button key={item.id} type="button" onClick={() => openItem(item)} className={`w-full border-b border-sky-50 px-4 py-4 text-left hover:bg-sky-50/70 ${item.id === selectedId ? 'bg-sky-50' : ''}`}>
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.status === 'unread' ? 'bg-rose-500' : 'bg-sky-100'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold text-text">{item.subject_display_name || '未知個案'}</p><span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${severityStyle.className}`}>{severityStyle.label}</span></div>
                            <p className="mt-1 truncate text-xs font-medium text-text/50">@{item.subject_username || '未設定'} · {statusLabels[item.status]}</p>
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-text/60">{item.content}</p>
                            <p className="mt-2 text-[11px] text-text/35">{formatTime(item.created_at)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
          </div>
        </aside>

        <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col`}>
          {!selected ? <div className="flex flex-1 flex-col items-center justify-center gap-3 text-text/35"><Bell size={38} /><p className="text-sm font-medium">請選擇一則通知查看詳情</p></div> : (
            <>
              <div className="flex items-center gap-3 border-b border-sky-100 px-5 py-4">
                <button type="button" onClick={() => setSelectedId(null)} aria-label="返回通知列表" className="rounded-lg p-2 text-text/45 hover:bg-sky-50 lg:hidden"><ArrowLeft size={20} /></button>
                <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold text-text">{selected.subject_display_name}</h2><p className="text-xs text-text/45">@{selected.subject_username} · {formatTime(selected.created_at)}</p></div>
                <Link to={`/patients/${selected.subject_user_id}`} aria-label="開啟個案資料" className="rounded-lg border border-sky-100 p-2 text-primary hover:bg-sky-50"><ExternalLink size={17} /></Link>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-7">
                <div className={`rounded-lg border p-5 ${severityStyles[selected.severity]?.className || severityStyles.S1.className}`}>
                  <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{selected.title}</h3><span className="text-xs font-bold">{statusLabels[selected.status]}</span></div>
                  <p className="mt-3 text-sm leading-6">{selected.content}</p>
                </div>
                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-sky-100 p-4"><p className="text-xs font-bold text-text/40">Email 寄送</p><p className="mt-1 font-medium text-text">{selected.email_status === 'sent' ? '已寄出' : selected.email_status === 'failed' ? '寄送失敗' : selected.email_status === 'disabled' ? '未啟用信箱' : '不需寄送'}</p>{selected.email_to && <p className="mt-1 truncate text-xs text-text/45">{selected.email_to}</p>}</div>
                  <div className="rounded-lg border border-sky-100 p-4"><p className="text-xs font-bold text-text/40">系統判定</p><p className="mt-1 font-medium text-text">規則版本 {selected.rule_version || '未記錄'}</p><p className="mt-1 text-xs text-text/45">自動初篩，非醫療診斷</p></div>
                </div>
                <div className="mt-5 rounded-lg border border-sky-100 p-5">
                  <h3 className="font-bold text-text">處理歷程</h3>
                  <div className="mt-4 space-y-3 text-sm text-text/65">
                    <p className="flex items-center gap-2"><Clock3 size={15} />建立：{formatTime(selected.created_at)}</p>
                    {selected.read_at && <p className="flex items-center gap-2"><MailCheck size={15} />已讀：{formatTime(selected.read_at)}</p>}
                    {selected.acknowledged_at && <p className="flex items-center gap-2"><UserCheck size={15} />已接手：{formatTime(selected.acknowledged_at)}</p>}
                    {selected.resolved_at && <p className="flex items-center gap-2"><CheckCircle2 size={15} />結案：{formatTime(selected.resolved_at)}</p>}
                    {selected.resolution_note && <p className="rounded-lg bg-sky-50 p-3 leading-6">{selected.resolution_note}</p>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-100 bg-white p-4">
                <Link to={`/chats?patientId=${selected.subject_user_id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 px-4 text-sm font-bold text-primary hover:bg-sky-50"><ShieldAlert size={16} />查看對話原文</Link>
                <div className="flex flex-wrap gap-2">
                  {!['acknowledged', 'resolved', 'false_positive'].includes(selected.status) && <button type="button" disabled={updating} onClick={() => updateItem(selected, 'acknowledged')} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">我已接手</button>}
                  {!['resolved', 'false_positive'].includes(selected.status) && <button type="button" onClick={() => setShowResolution('false_positive')} className="h-10 rounded-lg border border-sky-200 px-4 text-sm font-bold text-text/60">標示誤判</button>}
                  {!['resolved', 'false_positive'].includes(selected.status) && <button type="button" onClick={() => setShowResolution('resolved')} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white">完成處理</button>}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <form onSubmit={savePreference} className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-sky-100 px-5 py-4"><h3 className="font-bold text-primary">通知信箱設定</h3><button type="button" onClick={() => setShowSettings(false)} aria-label="關閉信箱設定" className="rounded-lg p-1 text-text/40 hover:bg-sky-50"><X size={18} /></button></div>
            {!preference ? <div className="flex h-36 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div> : <div className="space-y-4 p-5">
              <label className="block"><span className="text-xs font-bold text-text/55">通知 Email</span><input type="email" required={preference.email_enabled} value={preference.notification_email || ''} onChange={(event) => setPreference({ ...preference, notification_email: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-sky-100 px-3 outline-none focus:border-primary/40" /></label>
              <label className="flex items-start gap-3 rounded-lg border border-sky-100 p-4"><input type="checkbox" checked={preference.email_enabled} onChange={(event) => setPreference({ ...preference, email_enabled: event.target.checked })} className="mt-0.5 h-4 w-4" /><span><span className="block text-sm font-bold text-text">啟用高風險 Email</span><span className="mt-1 block text-xs leading-5 text-text/50">S2、S3 警示會同時寄到此信箱；站內通知不受此設定影響。</span></span></label>
            </div>}
            <div className="flex justify-end gap-2 border-t border-sky-100 px-5 py-4"><button type="button" onClick={() => setShowSettings(false)} className="h-10 rounded-lg border border-sky-200 px-4 text-sm font-bold text-text/60">取消</button><button type="submit" disabled={!preference || savingPreference} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">{savingPreference ? '儲存中' : '儲存設定'}</button></div>
          </form>
        </div>
      )}

      {showResolution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-sky-100 px-5 py-4"><h3 className="font-bold text-primary">{showResolution === 'resolved' ? '完成處理' : '標示誤判'}</h3></div>
            <div className="p-5"><label className="text-xs font-bold text-text/55">處理說明（必填）</label><textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} rows={5} placeholder="請記錄聯繫方式、處理結果或判定誤判的原因" className="mt-2 w-full resize-none rounded-lg border border-sky-100 p-3 text-sm outline-none focus:border-primary/40" /></div>
            <div className="flex justify-end gap-2 border-t border-sky-100 px-5 py-4"><button type="button" onClick={() => { setShowResolution(null); setResolutionNote(''); }} className="h-10 rounded-lg border border-sky-200 px-4 text-sm font-bold text-text/60">取消</button><button type="button" onClick={submitResolution} disabled={!resolutionNote.trim() || updating} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">確認</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
