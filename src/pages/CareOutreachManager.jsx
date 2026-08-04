import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { careOutreachApi } from '../api/careOutreach';

const statusLabels = {
  open: '待接手',
  acknowledged: '已接手',
  contacted: '已聯絡',
  monitoring: '追蹤中',
  resolved: '已結案',
  false_positive: '誤判',
};

const severityLabels = {
  critical: '緊急',
  high: '高風險',
  normal: '需留意',
  low: '一般',
};

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

const sourceLabel = (source) => sourceLabels[source] || (source ? '其他系統來源' : '未分類來源');

const getItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.cases || payload?.results || payload?.data || [];
};

const getTotal = (payload, items) => Number(payload?.total ?? payload?.count ?? items.length);

const getSubject = (item) => item?.subject || item?.patient || {};

const subjectName = (item) => item?.subject_display_name || item?.subject_name || getSubject(item).display_name || getSubject(item).name || '未命名個案';

const subjectUsername = (item) => item?.subject_username || item?.subject_account || getSubject(item).username || '';

const getSources = (item) => {
  const sources = item?.trigger_types || item?.sources;
  if (Array.isArray(sources) && sources.length > 0) return [...new Set(sources)];
  const source = item?.source || item?.source_type || item?.trigger_type || item?.triggers?.[0]?.trigger_type;
  return source ? [source] : [];
};

const getSeverity = (item) => item?.highest_severity || item?.severity || item?.triggers?.[0]?.severity || 'low';

const isTerminal = (status) => ['resolved', 'false_positive'].includes(status);

const isOverdue = (item) => {
  if (typeof item?.overdue === 'boolean') return item.overdue;
  if (!item?.due_at || isTerminal(item?.status)) return false;
  return new Date(item.due_at).getTime() < Date.now();
};

const formatDateTime = (value) => {
  if (!value) return '未記錄';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未記錄';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const CareOutreachManager = () => {
  const [filters, setFilters] = useState({
    search: '',
    status: 'active',
    severity: '',
    source: '',
    overdue: false,
  });
  const deferredSearch = useDeferredValue(filters.search.trim());
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCases = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await careOutreachApi.getCases({
        ...filters,
        search: deferredSearch,
        page,
        signal,
      });
      setPayload(response || { items: [], total: 0 });
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message || '關懷案件載入失敗');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [deferredSearch, filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    loadCases(controller.signal);
    return () => controller.abort();
  }, [loadCases]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, filters.status, filters.severity, filters.source, filters.overdue]);

  const items = useMemo(() => getItems(payload), [payload]);
  const total = getTotal(payload, items);
  const pageSize = Number(payload?.limit || payload?.page_size || payload?.pageSize || 20);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pendingCount = items.filter((item) => !isTerminal(item.status)).length;
  const overdueCount = items.filter(isOverdue).length;

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ search: '', status: 'active', severity: '', source: '', overdue: false });
  };

  return (
    <div className="care-outreach-page mx-auto flex min-h-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold tracking-wide text-primary/55">CARE OUTREACH</p>
          <h1 className="mt-1 text-2xl font-bold text-primary md:text-3xl">關懷案件</h1>
          <p className="mt-2 text-sm font-medium text-text/55">集中處理需要人工追蹤的個案事件與聯絡紀錄</p>
        </div>
        <button type="button" onClick={() => loadCases()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50 disabled:opacity-50 lg:self-auto">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          重新整理
        </button>
      </header>

      <section className="grid overflow-hidden rounded-lg border border-sky-100 bg-white sm:grid-cols-3">
        <div className="flex items-center gap-3 px-5 py-4">
          <UsersRound size={19} className="text-primary/60" />
          <div><p className="text-xs font-bold text-text/45">目前列表</p><p className="mt-0.5 text-xl font-bold text-text">{total}</p></div>
        </div>
        <div className="flex items-center gap-3 border-t border-sky-100 px-5 py-4 sm:border-l sm:border-t-0">
          <ShieldCheck size={19} className="text-primary/60" />
          <div><p className="text-xs font-bold text-text/45">本頁待處理</p><p className="mt-0.5 text-xl font-bold text-text">{pendingCount}</p></div>
        </div>
        <div className="flex items-center gap-3 border-t border-sky-100 px-5 py-4 sm:border-l sm:border-t-0">
          <AlertTriangle size={19} className="text-orange-500/80" />
          <div><p className="text-xs font-bold text-text/45">本頁已逾期</p><p className="mt-0.5 text-xl font-bold text-text">{overdueCount}</p></div>
        </div>
      </section>

      <section className="rounded-lg border border-sky-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-sky-100 px-4 py-3">
          <Filter size={17} className="text-primary/65" />
          <h2 className="text-sm font-bold text-text">篩選案件</h2>
          <button type="button" onClick={resetFilters} className="ml-auto text-xs font-bold text-primary hover:underline">清除篩選</button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(230px,1.5fr)_repeat(4,minmax(130px,1fr))]">
          <label className="relative block">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="搜尋姓名或帳號" aria-label="搜尋關懷案件" className="h-10 w-full rounded-lg border border-sky-100 bg-sky-50/20 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
          </label>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} aria-label="案件狀態" className="h-10 rounded-lg border border-sky-100 px-3 text-sm font-medium">
            <option value="active">待處理</option>
            <option value="">全部狀態</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} aria-label="風險等級" className="h-10 rounded-lg border border-sky-100 px-3 text-sm font-medium">
            <option value="">全部風險</option>
            {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.source} onChange={(event) => updateFilter('source', event.target.value)} aria-label="案件來源" className="h-10 rounded-lg border border-sky-100 px-3 text-sm font-medium">
            <option value="">全部來源</option>
            <option value="ai_safety">AI 安全警示</option>
            <option value="questionnaire_validation">問卷資料檢核</option>
          </select>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-sky-100 px-3 text-sm font-medium text-text/75">
            <input type="checkbox" checked={filters.overdue} onChange={(event) => updateFilter('overdue', event.target.checked)} className="h-4 w-4 accent-primary" />
            只看已逾期
          </label>
        </div>
      </section>

      <section className="min-h-[360px] overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 px-4 py-3">
          <p className="text-sm font-bold text-text">案件清單 <span className="ml-1 text-xs font-medium text-text/45">第 {page} / {totalPages} 頁</span></p>
          <p className="text-xs text-text/45">顯示 {items.length} / {total} 筆</p>
        </div>
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-text/45"><Loader2 size={19} className="animate-spin" />載入關懷案件中</div>
        ) : error ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-5 text-center"><CircleAlert size={30} className="text-rose-500" /><p className="text-sm font-bold text-rose-700">{error}</p><button type="button" onClick={() => loadCases()} className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-bold text-primary hover:bg-sky-50">重試</button></div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-5 text-center text-text/40"><ShieldCheck size={34} /><p className="text-sm font-medium">目前沒有符合條件的關懷案件</p><button type="button" onClick={resetFilters} className="text-sm font-bold text-primary hover:underline">清除篩選</button></div>
        ) : (
          <div className="divide-y divide-sky-50">
            {items.map((item) => {
              const severity = getSeverity(item);
              const sources = getSources(item);
              const overdue = isOverdue(item);
              return (
                <Link key={item.id} to={`/care-outreach/cases/${item.id}`} className="block px-4 py-4 transition-colors hover:bg-sky-50/60 focus:bg-sky-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/25 md:px-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-bold text-text">{subjectName(item)}</h3>
                        {subjectUsername(item) && <span className="truncate text-xs text-text/45">@{subjectUsername(item)}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text/55">
                        <span className={`rounded border px-2 py-0.5 font-bold ${severityStyles[severity] || severityStyles.low}`}>{severityLabels[severity] || severity}</span>
                        {(sources.length > 0 ? sources : ['']).map((source) => <span key={source || 'unknown'} className="rounded border border-sky-100 bg-sky-50 px-2 py-0.5 font-bold text-primary/75">{sourceLabel(source)}</span>)}
                        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-bold text-slate-600">{statusLabels[item.status] || item.status || '未設定'}</span>
                        {overdue && <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 font-bold text-rose-700"><CalendarClock size={12} />已逾期</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-text/50 lg:min-w-[300px] lg:grid-cols-3">
                      <span>期限：{formatDateTime(item.due_at)}</span>
                      <span>建立：{formatDateTime(item.created_at)}</span>
                      <span>{item.assigned_manager_name ? `個管師：${item.assigned_manager_name}` : '尚未指派'}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between border-t border-sky-100 px-4 py-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-2 text-sm font-bold text-primary hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} />上一頁</button>
            <span className="text-xs font-medium text-text/45">第 {page} / {totalPages} 頁</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-2 text-sm font-bold text-primary hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40">下一頁<ChevronRight size={16} /></button>
          </div>
        )}
      </section>
    </div>
  );
};

export default CareOutreachManager;
