import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  ChevronLeft,
  Clock3,
  Loader2,
  MessageCircleMore,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { aiChatsApi } from '../api/aiChats';

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DAY_FORMATTER = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const formatDateTime = (value) => (value ? DATE_FORMATTER.format(new Date(value)) : '尚無對話');
const formatDay = (value) => DAY_FORMATTER.format(new Date(value));

const genderLabel = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['male', 'm', '男', '男性'].includes(normalized)) return '男性';
  if (['female', 'f', '女', '女性'].includes(normalized)) return '女性';
  return '未設定';
};

const periodLabels = {
  1: '今天',
  3: '最近 3 天',
  7: '最近 7 天',
  30: '最近 30 天',
  90: '最近 90 天',
  0: '全部時間',
};

const ChatCareManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [activity, setActivity] = useState('all');
  const [recentDays, setRecentDays] = useState(30);
  const [patientData, setPatientData] = useState({ items: [], summary: null, total: 0 });
  const [selectedPatientId, setSelectedPatientId] = useState(() => {
    const value = Number(searchParams.get('patientId'));
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  const [messagePage, setMessagePage] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [messageReloadKey, setMessageReloadKey] = useState(0);
  const [patientError, setPatientError] = useState('');
  const [messageError, setMessageError] = useState('');
  const conversationEndRef = useRef(null);
  const lastScrolledPatientRef = useRef(null);

  const selectedPatient = useMemo(
    () => patientData.items.find((item) => item.patient_id === selectedPatientId) || messagePage?.patient || null,
    [messagePage?.patient, patientData.items, selectedPatientId],
  );

  const fetchPatients = useCallback(async (signal) => {
    setLoadingPatients(true);
    setPatientError('');
    try {
      const data = await aiChatsApi.getPatients({
        search: deferredSearch,
        activity,
        recentDays,
        signal,
      });
      setPatientData(data);
      setSelectedPatientId((current) => {
        if (current && data.items.some((item) => item.patient_id === current)) return current;
        return null;
      });
    } catch (error) {
      if (error.name !== 'AbortError') setPatientError(error.message);
    } finally {
      if (!signal?.aborted) setLoadingPatients(false);
    }
  }, [activity, deferredSearch, recentDays]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPatients(controller.signal);
    return () => controller.abort();
  }, [fetchPatients]);

  useEffect(() => {
    if (!selectedPatientId) {
      setMessagePage(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoadingMessages(true);
    setMessageError('');
    aiChatsApi.getPatientMessages(selectedPatientId, { signal: controller.signal })
      .then(setMessagePage)
      .catch((error) => {
        if (error.name !== 'AbortError') setMessageError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingMessages(false);
      });
    return () => controller.abort();
  }, [messageReloadKey, selectedPatientId]);

  useEffect(() => {
    if (
      !loadingMessages
      && messagePage?.messages?.length
      && lastScrolledPatientRef.current !== selectedPatientId
    ) {
      conversationEndRef.current?.scrollIntoView({ block: 'end' });
      lastScrolledPatientRef.current = selectedPatientId;
    }
  }, [loadingMessages, messagePage?.messages?.length, selectedPatientId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedPatientId) next.set('patientId', String(selectedPatientId));
    else next.delete('patientId');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [searchParams, selectedPatientId, setSearchParams]);

  const loadEarlier = async () => {
    if (!selectedPatientId || !messagePage?.next_before_id) return;
    setLoadingEarlier(true);
    setMessageError('');
    try {
      const earlier = await aiChatsApi.getPatientMessages(selectedPatientId, {
        beforeId: messagePage.next_before_id,
      });
      setMessagePage((current) => ({
        ...current,
        messages: [...earlier.messages, ...current.messages],
        has_more: earlier.has_more,
        next_before_id: earlier.next_before_id,
      }));
    } catch (error) {
      setMessageError(error.message);
    } finally {
      setLoadingEarlier(false);
    }
  };

  const messagesByDay = useMemo(() => {
    const groups = [];
    (messagePage?.messages || []).forEach((message) => {
      const day = formatDay(message.created_at);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.day === day) lastGroup.messages.push(message);
      else groups.push({ day, messages: [message] });
    });
    return groups;
  }, [messagePage?.messages]);

  const summary = patientData.summary || {
    accessible_patients: 0,
    patients_with_chat: 0,
    patients_without_chat: 0,
    active_today: 0,
  };

  return (
    <div className="mx-auto flex h-full min-h-[680px] max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary md:text-3xl">AI 對話紀錄</h1>
          <div className="mt-2 flex items-center gap-2 text-xs font-medium text-text/55">
            <ShieldCheck size={15} />
            <span>查看對話原文會留下稽核紀錄</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchPatients()}
          disabled={loadingPatients}
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50 disabled:opacity-50 md:self-auto"
        >
          <RefreshCw size={16} className={loadingPatients ? 'animate-spin' : ''} />
          重新整理
        </button>
      </header>

      <section className="grid overflow-hidden rounded-lg border border-sky-100 bg-white sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '可管理個案', value: summary.accessible_patients, icon: Users },
          { label: '曾使用 AI 對話', value: summary.patients_with_chat, icon: MessageCircleMore },
          { label: '今日有對話', value: summary.active_today, icon: Clock3 },
          { label: '尚無對話', value: summary.patients_without_chat, icon: User },
        ].map((item, index) => (
          <div key={item.label} className={`flex items-center gap-3 px-5 py-4 ${index ? 'border-t border-sky-100 sm:border-l sm:border-t-0' : ''}`}>
            <item.icon size={19} className="text-primary/60" />
            <div>
              <p className="text-xs font-bold text-text/45">{item.label}</p>
              <p className="mt-0.5 text-xl font-bold text-text">{item.value}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid min-h-0 flex-1 overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`${selectedPatientId ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-sky-100`}>
          <div className="space-y-3 border-b border-sky-100 p-4">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜尋姓名、帳號或個案代碼"
                aria-label="搜尋個案"
                className="h-10 w-full rounded-lg border border-sky-100 bg-sky-50/30 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="relative">
                <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
                <select
                  value={recentDays}
                  onChange={(event) => setRecentDays(Number(event.target.value))}
                  aria-label="對話時間"
                  className="h-10 w-full appearance-none rounded-lg border border-sky-100 bg-white pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40"
                >
                  {[1, 3, 7, 30, 90, 0].map((days) => (
                    <option key={days} value={days}>{periodLabels[days]}</option>
                  ))}
                </select>
              </label>
              <select
                value={activity}
                onChange={(event) => setActivity(event.target.value)}
                aria-label="對話狀態"
                className="h-10 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm font-medium outline-none focus:border-primary/40"
              >
                <option value="all">全部個案</option>
                <option value="with_chat">有對話</option>
                <option value="without_chat">尚無對話</option>
              </select>
            </div>
            <p className="text-xs font-medium text-text/40">顯示 {patientData.total} 位個案</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingPatients ? (
              <div className="flex h-44 items-center justify-center gap-2 text-sm font-medium text-text/45">
                <Loader2 size={18} className="animate-spin" />載入個案中
              </div>
            ) : patientError ? (
              <div className="space-y-3 p-6 text-center">
                <p className="text-sm font-medium text-rose-600">{patientError}</p>
                <button type="button" onClick={() => fetchPatients()} className="text-sm font-bold text-primary">重新載入</button>
              </div>
            ) : patientData.items.length === 0 ? (
              <div className="p-8 text-center text-sm font-medium text-text/40">沒有符合目前條件的個案</div>
            ) : patientData.items.map((patient) => {
              const selected = patient.patient_id === selectedPatientId;
              return (
                <button
                  type="button"
                  key={patient.patient_id}
                  onClick={() => setSelectedPatientId(patient.patient_id)}
                  className={`w-full border-b border-sky-50 px-4 py-4 text-left transition-colors ${selected ? 'bg-sky-50' : 'hover:bg-sky-50/60'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${patient.message_count ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                      {patient.display_name?.charAt(0) || '個'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-bold text-text">{patient.display_name}</p>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${patient.message_count ? 'bg-sky-100 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                          {patient.message_count ? `${patient.user_message_count} 則提問` : '尚無對話'}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text/40">@{patient.username} · {patient.role_name || '未分組'}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-text/45">
                        <Clock3 size={12} />{formatDateTime(patient.last_message_at)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className={`${selectedPatientId ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col`}>
          {!selectedPatient ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-text/35">
              <MessageCircleMore size={34} />
              <p className="text-sm font-bold">請選擇一位個案</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-sky-100 px-4 py-4 md:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPatientId(null)}
                    className="rounded-lg p-2 text-text/50 hover:bg-sky-50 lg:hidden"
                    aria-label="返回個案列表"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {selectedPatient.display_name?.charAt(0) || '個'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-text">{selectedPatient.display_name}</h2>
                    <p className="truncate text-xs text-text/45">
                      @{selectedPatient.username} · {genderLabel(selectedPatient.gender)} · {selectedPatient.role_name || '未分組'}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/patients/${selectedPatient.patient_id}`}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-sky-200 px-3 text-xs font-bold text-primary hover:bg-sky-50"
                >
                  <ArrowLeft size={14} className="rotate-180" />
                  <span className="hidden sm:inline">個案資料</span>
                </Link>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-sky-50/25 px-4 py-5 md:px-8">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm font-medium text-text/45">
                    <Loader2 size={18} className="animate-spin" />載入對話中
                  </div>
                ) : messageError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm font-medium text-rose-600">{messageError}</p>
                    <button type="button" onClick={() => setMessageReloadKey((value) => value + 1)} className="text-sm font-bold text-primary">重新載入</button>
                  </div>
                ) : messagesByDay.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text/35">
                    <Bot size={34} />
                    <p className="text-sm font-bold">此個案尚未使用 AI 聊天功能</p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl space-y-6">
                    {messagePage?.has_more && (
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={loadEarlier}
                          disabled={loadingEarlier}
                          className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-2 text-xs font-bold text-primary hover:bg-sky-50 disabled:opacity-50"
                        >
                          {loadingEarlier && <Loader2 size={14} className="animate-spin" />}
                          載入更早對話
                        </button>
                      </div>
                    )}
                    {messagesByDay.map((group) => (
                      <div key={group.day} className="space-y-4">
                        <div className="flex items-center gap-3 text-[11px] font-bold text-text/35">
                          <span className="h-px flex-1 bg-sky-100" />
                          {group.day}
                          <span className="h-px flex-1 bg-sky-100" />
                        </div>
                        {group.messages.map((message) => {
                          const fromPatient = message.role === 'user';
                          return (
                            <article key={message.id} className={`flex ${fromPatient ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[88%] md:max-w-[76%] ${fromPatient ? '' : 'text-right'}`}>
                                <div className={`mb-1 flex items-center gap-1.5 text-[11px] font-bold text-text/40 ${fromPatient ? '' : 'justify-end'}`}>
                                  {fromPatient ? <User size={12} /> : <Bot size={12} />}
                                  {fromPatient ? '個案' : 'AI 助理'}
                                </div>
                                <div className={`whitespace-pre-wrap break-words rounded-lg px-4 py-3 text-left text-sm leading-6 shadow-sm ${fromPatient ? 'border border-sky-100 bg-white text-text' : 'bg-slate-100 text-slate-700'}`}>
                                  {message.content}
                                </div>
                                <time className="mt-1 block text-[10px] font-medium text-text/35">{formatDateTime(message.created_at)}</time>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={conversationEndRef} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default ChatCareManager;
