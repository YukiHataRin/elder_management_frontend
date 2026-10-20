import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Filter,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react';
import CareOutreachCreateModal from '../components/CareOutreachCreateModal';
import {
  CARE_OUTREACH_SOURCE_LABELS,
  careOutreachApi,
} from '../api/careOutreach';
import { managementApi } from '../api/management';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';

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

const DEFAULT_STATUS_FILTER = 'active';
const LIST_SCROLL_KEY = 'careOutreach:listScroll';
const SELECTION_KEY = 'careOutreach:selection';
const BULK_CHUNK_SIZE = 100;

const readFiltersFromParams = (params) => ({
  search: params.get('q') || '',
  status: params.has('status') ? params.get('status') : DEFAULT_STATUS_FILTER,
  severity: params.get('severity') || '',
  source: params.get('source') || '',
  overdue: params.get('overdue') === '1',
});

const readPageFromParams = (params) => {
  const value = Number.parseInt(params.get('page') || '1', 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const readSessionJson = (key, fallback) => {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeSessionJson = (key, value) => {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session storage is a convenience only; the list still works without it.
  }
};

const findScrollParent = (element) => {
  let node = element?.parentElement;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return document.scrollingElement;
};

const bulkErrorLabels = {
  not_found: '找不到案件',
  forbidden: '沒有權限',
  conflict: '狀態已變更',
  validation: '資料不符',
  error: '處理失敗',
};

const sourceLabel = (source) => CARE_OUTREACH_SOURCE_LABELS[source] || (source ? '其他系統來源' : '未分類來源');

const sourceFilterOptions = [
  ['ai_safety', CARE_OUTREACH_SOURCE_LABELS.ai_safety],
  ['questionnaire_validation', CARE_OUTREACH_SOURCE_LABELS.questionnaire_validation],
  ['mission_usage', CARE_OUTREACH_SOURCE_LABELS.mission_usage],
  ['gps_inactivity', CARE_OUTREACH_SOURCE_LABELS.gps_inactivity],
  ['app_activity', CARE_OUTREACH_SOURCE_LABELS.app_activity],
  ['manual_outreach', CARE_OUTREACH_SOURCE_LABELS.manual_outreach],
];

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

const formatDateOnly = (value) => {
  if (!value) return '未記錄';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未記錄';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
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

const emptyGpsForm = (subjectId = '') => ({
  subjectId: subjectId ? String(subjectId) : '',
  consentStatus: 'pending',
  consentVersion: '',
  consentedAt: '',
  isActive: false,
  homeLatitude: '',
  homeLongitude: '',
  radiusMeters: '300',
});

const normalizeGpsProfile = (payload, subjectId) => {
  const profile = payload?.profile || payload?.item || payload?.data || payload || {};
  const consentStatus = profile?.consent_status || profile?.consentStatus || 'pending';
  return {
    ...emptyGpsForm(subjectId),
    consentStatus,
    consentVersion: profile?.consent_version || profile?.consentVersion || '',
    consentedAt: profile?.consented_at || profile?.consentedAt || '',
    isActive: Boolean(profile?.is_active ?? profile?.isActive) && consentStatus === 'granted',
    homeLatitude: profile?.home_latitude ?? profile?.homeLatitude ?? '',
    homeLongitude: profile?.home_longitude ?? profile?.homeLongitude ?? '',
    radiusMeters: profile?.radius_meters ?? profile?.radiusMeters ?? '300',
  };
};

const ManagerModal = ({ title, children, onClose, wide = false, busy = false }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation">
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-xl border border-sky-100 bg-white shadow-xl ${wide ? 'max-w-2xl' : 'max-w-xl'}`} role="dialog" aria-modal="true" aria-labelledby="care-outreach-manager-modal-title">
        <div className="flex items-center justify-between gap-4 border-b border-sky-100 px-5 py-4">
          <h2 id="care-outreach-manager-modal-title" className="text-lg font-bold text-primary">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={`關閉${title}`} className="rounded-lg p-2 text-text/40 transition hover:bg-sky-50 hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-40"><X size={19} /></button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const CareOutreachManager = () => {
  const { showToast, requestConfirm } = useToast();
  const { user } = useAuth();
  const currentUserId = Number(user?.id ?? user?.user_id);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFiltersFromParams(searchParams), [searchParams]);
  const page = readPageFromParams(searchParams);
  const [searchInput, setSearchInput] = useState(filters.search);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const listRef = useRef(null);
  const scrollRestoredRef = useRef(false);
  const [selection, setSelection] = useState(() => readSessionJson(SELECTION_KEY, {}));
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [payload, setPayload] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [patientsLoaded, setPatientsLoaded] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [gpsPatientSearch, setGpsPatientSearch] = useState('');
  const [gpsForm, setGpsForm] = useState(emptyGpsForm);
  const [gpsProfileLoading, setGpsProfileLoading] = useState(false);
  const [gpsProfileError, setGpsProfileError] = useState('');
  const [gpsSubmitting, setGpsSubmitting] = useState(false);
  const gpsProfileRequestRef = useRef(0);

  const loadCases = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await careOutreachApi.getCases({
        ...filters,
        page,
        signal,
      });
      setPayload(response || { items: [], total: 0 });
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message || '關懷案件載入失敗');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    loadCases(controller.signal);
    return () => controller.abort();
  }, [loadCases]);

  const updateListParams = useCallback((changes, { resetPage = true } = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) => {
        if (key === 'status') {
          if (value === DEFAULT_STATUS_FILTER) next.delete('status');
          else next.set('status', value);
        } else if (value === '' || value === false || value === null || value === undefined) {
          next.delete(key);
        } else {
          next.set(key, value === true ? '1' : String(value));
        }
      });
      if (resetPage) next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setPage = useCallback((nextPage) => {
    updateListParams({ page: nextPage > 1 ? nextPage : '' }, { resetPage: false });
  }, [updateListParams]);

  useEffect(() => {
    if (deferredSearch !== filters.search) updateListParams({ q: deferredSearch });
  }, [deferredSearch, filters.search, updateListParams]);

  useEffect(() => {
    setSearchInput((current) => (current.trim() === filters.search ? current : filters.search));
  }, [filters.search]);

  useEffect(() => {
    writeSessionJson(SELECTION_KEY, Object.keys(selection).length > 0 ? selection : null);
  }, [selection]);

  const items = useMemo(() => getItems(payload), [payload]);
  const total = getTotal(payload, items);
  const pageSize = Number(payload?.limit || payload?.page_size || payload?.pageSize || 20);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pendingCount = items.filter((item) => !isTerminal(item.status)).length;
  const overdueCount = items.filter(isOverdue).length;

  const updateFilter = (key, value) => {
    updateListParams({ [key]: value });
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  useEffect(() => {
    if (loading || scrollRestoredRef.current) return;
    scrollRestoredRef.current = true;
    const saved = readSessionJson(LIST_SCROLL_KEY, null);
    writeSessionJson(LIST_SCROLL_KEY, null);
    if (!saved || saved.search !== location.search) return;
    const scroller = findScrollParent(listRef.current);
    if (scroller) window.requestAnimationFrame(() => { scroller.scrollTop = saved.top; });
  }, [loading, location.search]);

  const rememberListPosition = () => {
    const scroller = findScrollParent(listRef.current);
    writeSessionJson(LIST_SCROLL_KEY, { search: location.search, top: scroller?.scrollTop || 0 });
  };

  const canBulkTakeOwnership = useCallback((item) => (
    !isTerminal(item.status)
    && !(Number.isFinite(currentUserId)
      && Number(item.assigned_manager_user_id) === currentUserId
      && Boolean(item.acknowledged_at))
  ), [currentUserId]);

  useEffect(() => {
    setSelection((current) => {
      let changed = false;
      const next = { ...current };
      items.forEach((item) => {
        const key = String(item.id);
        if (!next[key]) return;
        if (!canBulkTakeOwnership(item)) {
          delete next[key];
          changed = true;
        } else if (next[key].status !== item.status) {
          next[key] = { ...next[key], status: item.status };
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [items, canBulkTakeOwnership]);

  const selectableItems = items.filter(canBulkTakeOwnership);
  const selectedCount = Object.keys(selection).length;
  const pageAllSelected = selectableItems.length > 0 && selectableItems.every((item) => selection[String(item.id)]);

  const toggleSelected = (item) => {
    setSelection((current) => {
      const key = String(item.id);
      const next = { ...current };
      if (next[key]) delete next[key];
      else next[key] = { status: item.status, name: subjectName(item) };
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelection((current) => {
      const next = { ...current };
      selectableItems.forEach((item) => {
        const key = String(item.id);
        if (pageAllSelected) delete next[key];
        else next[key] = { status: item.status, name: subjectName(item) };
      });
      return next;
    });
  };

  const clearSelection = () => setSelection({});

  const submitBulkTakeOwnership = async () => {
    const entries = Object.entries(selection);
    if (entries.length === 0 || bulkSubmitting) return;
    if (!(await requestConfirm(`確定要一次接手 ${entries.length} 件關懷案件嗎？接手後會由您負責後續聯絡與處理。`))) return;
    setBulkSubmitting(true);
    setBulkResult(null);
    const results = [];
    try {
      for (let index = 0; index < entries.length; index += BULK_CHUNK_SIZE) {
        const chunk = entries.slice(index, index + BULK_CHUNK_SIZE);
        const response = await careOutreachApi.bulkUpdateCases({
          action: 'take_ownership',
          items: chunk.map(([caseId, info]) => ({ case_id: Number(caseId), expected_status: info.status || undefined })),
        });
        results.push(...(response?.results || []));
      }
    } catch (bulkError) {
      showToast(bulkError.message || '批次接手失敗，請稍後再試', 'error');
    } finally {
      const succeededIds = new Set(results.filter((result) => result.ok).map((result) => String(result.case_id)));
      const failures = results
        .filter((result) => !result.ok)
        .map((result) => ({
          ...result,
          name: selection[String(result.case_id)]?.name || `案件 #${result.case_id}`,
        }));
      if (results.length > 0) {
        setSelection((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !succeededIds.has(key) && !failures.some((failure) => String(failure.case_id) === key))));
        setBulkResult({ succeeded: succeededIds.size, failures });
        if (failures.length === 0) showToast(`已接手 ${succeededIds.size} 件關懷案件`, 'success');
        else showToast(`已接手 ${succeededIds.size} 件，${failures.length} 件未完成`, 'info');
        await loadCases();
      }
      setBulkSubmitting(false);
    }
  };

  const loadPatients = useCallback(async () => {
    setPatientsLoading(true);
    setPatientsError('');
    try {
      const response = await managementApi.getPatients();
      setPatients(getPatientItems(response));
      setPatientsLoaded(true);
    } catch (loadError) {
      setPatientsError(loadError.message || '可見個案載入失敗');
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  const preparePatientPicker = useCallback(() => {
    if (!patientsLoaded && !patientsLoading) loadPatients();
  }, [loadPatients, patientsLoaded, patientsLoading]);

  const openCreateModal = () => {
    setCreateModalOpen(true);
    preparePatientPicker();
  };

  const loadGpsProfile = useCallback(async (subjectId) => {
    const requestId = gpsProfileRequestRef.current + 1;
    gpsProfileRequestRef.current = requestId;
    setGpsProfileLoading(true);
    setGpsProfileError('');
    try {
      const response = await careOutreachApi.getGpsProfile(subjectId);
      if (requestId === gpsProfileRequestRef.current) setGpsForm(normalizeGpsProfile(response, subjectId));
    } catch (loadError) {
      if (requestId === gpsProfileRequestRef.current) {
        setGpsProfileError(loadError.message || 'GPS 設定載入失敗；可直接填寫後儲存。');
        setGpsForm(emptyGpsForm(subjectId));
      }
    } finally {
      if (requestId === gpsProfileRequestRef.current) setGpsProfileLoading(false);
    }
  }, []);

  const openGpsModal = () => {
    setGpsModalOpen(true);
    setGpsPatientSearch('');
    setGpsProfileError('');
    setGpsForm(emptyGpsForm());
    preparePatientPicker();
  };

  const closeGpsModal = () => {
    if (gpsSubmitting) return;
    setGpsModalOpen(false);
    gpsProfileRequestRef.current += 1;
  };

  const selectGpsPatient = (subjectId) => {
    setGpsForm(emptyGpsForm(subjectId));
    setGpsProfileError('');
    if (subjectId) loadGpsProfile(subjectId);
  };

  const submitCreateCase = async (data) => {
    setCreateSubmitting(true);
    try {
      await careOutreachApi.createCase(data);
      setCreateModalOpen(false);
      if (page === 1) await loadCases();
      else setPage(1);
      showToast('人工關懷案件已建立', 'success');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const updateGpsField = (key, value) => {
    setGpsProfileError('');
    setGpsForm((current) => ({ ...current, [key]: value }));
  };

  const submitGpsProfile = async (event) => {
    event.preventDefault();
    const consentStatus = gpsForm.consentStatus;
    const isActive = gpsForm.isActive && consentStatus === 'granted';
    const latitude = gpsForm.homeLatitude === '' ? null : Number(gpsForm.homeLatitude);
    const longitude = gpsForm.homeLongitude === '' ? null : Number(gpsForm.homeLongitude);
    const radius = Number(gpsForm.radiusMeters);
    if (!gpsForm.subjectId || !gpsForm.consentVersion.trim()) {
      setGpsProfileError('請選擇個案並填寫同意版本。');
      return;
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      setGpsProfileError('半徑必須是大於 0 的數字。');
      return;
    }
    if (isActive && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
      setGpsProfileError('啟用 GPS 關懷時，請填寫有效的住家緯度與經度。');
      return;
    }
    setGpsSubmitting(true);
    setGpsProfileError('');
    try {
      await careOutreachApi.saveGpsProfile(Number(gpsForm.subjectId), {
        is_active: isActive,
        consent_status: consentStatus,
        consent_version: gpsForm.consentVersion.trim(),
        consented_at: consentStatus === 'granted' ? (gpsForm.consentedAt || new Date().toISOString()) : null,
        home_latitude: latitude,
        home_longitude: longitude,
        radius_meters: radius,
      });
      setGpsModalOpen(false);
      showToast('GPS 關懷設定已儲存', 'success');
    } catch (saveError) {
      setGpsProfileError(saveError.message || 'GPS 設定儲存失敗，請稍後再試。');
    } finally {
      setGpsSubmitting(false);
    }
  };

  const gpsPatients = useMemo(() => {
    const keyword = gpsPatientSearch.trim().toLowerCase();
    if (!keyword) return patients;
    return patients.filter((patient) => [getPatientName(patient), getPatientUsername(patient)]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [gpsPatientSearch, patients]);

  return (
    <div ref={listRef} className="care-outreach-page mx-auto flex min-h-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold tracking-wide text-primary/55">CARE OUTREACH</p>
          <h1 className="mt-1 text-2xl font-bold text-primary md:text-3xl">關懷案件</h1>
          <p className="mt-2 text-sm font-medium text-text/55">集中處理需要人工追蹤的個案事件與聯絡紀錄</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button type="button" onClick={openGpsModal} title="GPS 關懷設定" aria-label="開啟 GPS 關懷設定" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sky-200 bg-white text-primary transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-primary/20">
            <Settings2 size={17} />
          </button>
          <button type="button" onClick={openCreateModal} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/30">
            <Plus size={17} />
            新增關懷案件
          </button>
          <button type="button" onClick={() => loadCases()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-primary transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            重新整理
          </button>
        </div>
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
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="搜尋姓名或帳號" aria-label="搜尋關懷案件" className="h-10 w-full rounded-lg border border-sky-100 bg-sky-50/20 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
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
            {sourceFilterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-sky-100 px-3 text-sm font-medium text-text/75">
            <input type="checkbox" checked={filters.overdue} onChange={(event) => updateFilter('overdue', event.target.checked)} className="h-4 w-4 accent-primary" />
            只看已逾期
          </label>
        </div>
      </section>

      <section className="min-h-[360px] overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <label className={`inline-flex items-center gap-2 text-xs font-bold ${selectableItems.length > 0 ? 'text-text/60' : 'text-text/30'}`}>
              <input type="checkbox" checked={pageAllSelected} onChange={togglePageSelection} disabled={loading || selectableItems.length === 0 || bulkSubmitting} aria-label="選取本頁可接手案件" className="h-4 w-4 accent-primary" />
              本頁全選
            </label>
            <p className="text-sm font-bold text-text">案件清單 <span className="ml-1 text-xs font-medium text-text/45">第 {page} / {totalPages} 頁</span></p>
          </div>
          <p className="text-xs text-text/45">顯示 {items.length} / {total} 筆</p>
        </div>
        {selectedCount > 0 && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-sky-100 bg-sky-50/95 px-4 py-2.5 backdrop-blur" role="region" aria-label="批次操作">
            <CheckSquare size={17} className="text-primary/70" />
            <p className="text-sm font-bold text-primary">已選取 {selectedCount} 件案件<span className="ml-2 text-xs font-medium text-text/45">換頁後仍會保留選取</span></p>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={clearSelection} disabled={bulkSubmitting} className="rounded-lg px-3 py-1.5 text-xs font-bold text-text/55 hover:bg-white disabled:opacity-40">清除選取</button>
              <button type="button" onClick={submitBulkTakeOwnership} disabled={bulkSubmitting} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60">
                {bulkSubmitting ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
                批次接手
              </button>
            </div>
          </div>
        )}
        {bulkResult && (
          <div className={`flex items-start gap-2 border-b px-4 py-3 text-sm ${bulkResult.failures.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`} role="status">
            <div className="min-w-0 flex-1">
              <p className="font-bold">批次接手完成：成功 {bulkResult.succeeded} 件{bulkResult.failures.length > 0 ? `，未完成 ${bulkResult.failures.length} 件` : ''}</p>
              {bulkResult.failures.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {bulkResult.failures.map((failure) => (
                    <li key={failure.case_id}><span className="font-bold">{failure.name}</span>：{bulkErrorLabels[failure.error_code] || '處理失敗'}{failure.error ? `（${failure.error}）` : ''}</li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" onClick={() => setBulkResult(null)} aria-label="關閉批次結果" className="rounded p-1 hover:bg-white/60"><X size={15} /></button>
          </div>
        )}
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
                <div key={item.id} className={`flex items-stretch ${selection[String(item.id)] ? 'bg-sky-50/50' : ''}`}>
                <div className="flex shrink-0 items-start pl-4 pt-5 md:pl-5">
                  {canBulkTakeOwnership(item) ? (
                    <input type="checkbox" checked={Boolean(selection[String(item.id)])} onChange={() => toggleSelected(item)} disabled={bulkSubmitting} aria-label={`選取 ${subjectName(item)} 的案件`} className="h-4 w-4 accent-primary" />
                  ) : (
                    <input type="checkbox" disabled aria-label={`${subjectName(item)} 的案件不可批次接手`} title={isTerminal(item.status) ? '已結案案件不可接手' : '您已接手此案件'} className="h-4 w-4 opacity-30" />
                  )}
                </div>
                <Link to={`/care-outreach/cases/${item.id}`} state={{ from: `${location.pathname}${location.search}` }} onClick={rememberListPosition} className="block min-w-0 flex-1 px-4 py-4 transition-colors hover:bg-sky-50/60 focus:bg-sky-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/25 md:px-5">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
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
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-text/50 sm:grid-cols-4 xl:w-[520px] xl:flex-none xl:grid-cols-2">
                      <span>期限：{formatDateTime(item.due_at)}</span>
                      <span>建立：{formatDateTime(item.created_at)}</span>
                      <span>週期：{formatDateOnly(item.cycle_start)}－{formatDateOnly(item.cycle_end)}</span>
                      <span>{item.assigned_manager_name ? `個管師：${item.assigned_manager_name}` : '尚未指派'}</span>
                    </div>
                  </div>
                </Link>
                </div>
              );
            })}
          </div>
        )}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between border-t border-sky-100 px-4 py-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-2 text-sm font-bold text-primary hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} />上一頁</button>
            <span className="text-xs font-medium text-text/45">第 {page} / {totalPages} 頁</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-2 text-sm font-bold text-primary hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40">下一頁<ChevronRight size={16} /></button>
          </div>
        )}
      </section>

      {gpsModalOpen && <ManagerModal title="GPS 關懷設定" onClose={closeGpsModal} wide busy={gpsSubmitting}>
        <form onSubmit={submitGpsProfile} className="space-y-5 p-5">
          {gpsProfileError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-700"><CircleAlert size={17} className="mt-0.5 shrink-0" />{gpsProfileError}</div>}

          <section>
            <div className="flex items-center gap-2"><UsersRound size={17} className="text-primary/60" /><label htmlFor="gps-patient-search" className="text-xs font-bold text-text/55">選擇個案（必填）</label>{gpsForm.subjectId && <span className="ml-auto truncate text-xs font-bold text-primary/75">{getPatientName(patients.find((patient) => String(getPatientId(patient)) === String(gpsForm.subjectId)))}</span>}</div>
            <label className="relative mt-2 block">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
              <input id="gps-patient-search" value={gpsPatientSearch} onChange={(event) => setGpsPatientSearch(event.target.value)} placeholder="搜尋姓名或帳號" aria-label="搜尋 GPS 設定個案" className="h-11 w-full rounded-lg border border-sky-100 bg-sky-50/20 pl-10 pr-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10" disabled={patientsLoading || gpsSubmitting} />
            </label>
            {patientsLoading ? (
              <div className="mt-2 flex h-28 items-center justify-center gap-2 rounded-lg border border-dashed border-sky-100 text-sm text-text/45"><Loader2 size={18} className="animate-spin" />載入可見個案中</div>
            ) : patientsError ? (
              <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-rose-100 bg-rose-50/60 px-4 py-5 text-center"><p className="text-sm font-bold text-rose-700">{patientsError}</p><button type="button" onClick={loadPatients} disabled={gpsSubmitting} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50">重試</button></div>
            ) : gpsPatients.length === 0 ? (
              <div className="mt-2 flex min-h-24 items-center justify-center rounded-lg border border-dashed border-sky-100 px-4 text-center text-sm text-text/45">沒有符合搜尋條件的可見個案。</div>
            ) : (
              <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-sky-100" role="radiogroup" aria-label="選擇 GPS 設定個案">
                {gpsPatients.map((patient) => {
                  const patientId = getPatientId(patient);
                  if (!patientId) return null;
                  const checked = String(gpsForm.subjectId) === String(patientId);
                  return <label key={patientId} className={`flex cursor-pointer items-center gap-3 border-b border-sky-50 px-3 py-3 text-sm last:border-b-0 hover:bg-sky-50/60 ${checked ? 'bg-sky-50' : ''}`}><input type="radio" name="gps-subject" value={patientId} checked={checked} onChange={(event) => selectGpsPatient(event.target.value)} disabled={gpsSubmitting} className="h-4 w-4 accent-primary" /><UsersRound size={16} className="shrink-0 text-primary/50" /><span className="min-w-0 flex-1"><span className="block truncate font-bold text-text">{getPatientName(patient)}</span>{getPatientUsername(patient) && <span className="block truncate text-xs text-text/45">@{getPatientUsername(patient)}</span>}</span></label>;
                })}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-sky-100 bg-sky-50/30 p-4">
            <div className="flex items-start gap-2"><MapPin size={18} className="mt-0.5 text-primary/65" /><div><h3 className="text-sm font-bold text-text">受控 GPS 監測</h3><p className="mt-1 text-xs leading-5 text-text/50">住家座標為敏感資料，只在此權限受控設定視窗顯示，不會進入案件列表或證據摘要。</p></div></div>
            {gpsProfileLoading ? <div className="mt-4 flex items-center gap-2 text-sm text-text/45"><Loader2 size={17} className="animate-spin" />載入個案 GPS 設定中</div> : <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-xs font-bold text-text/55">同意狀態（必填）</span><select value={gpsForm.consentStatus} onChange={(event) => { const status = event.target.value; setGpsForm((current) => ({ ...current, consentStatus: status, isActive: status === 'granted' ? current.isActive : false })); setGpsProfileError(''); }} className="mt-2 h-11 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10" disabled={!gpsForm.subjectId || gpsSubmitting}><option value="pending">待確認</option><option value="granted">已明確同意（granted）</option><option value="revoked">已撤回</option><option value="expired">已過期</option></select></label>
                <label className="block"><span className="text-xs font-bold text-text/55">同意版本（必填）</span><input value={gpsForm.consentVersion} onChange={(event) => updateGpsField('consentVersion', event.target.value)} placeholder="例如 GPS-consent-v1" className="mt-2 h-11 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50" disabled={!gpsForm.subjectId || gpsSubmitting} /></label>
              </div>
              <label className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${gpsForm.consentStatus === 'granted' ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50'}`}><input type="checkbox" checked={gpsForm.isActive} onChange={(event) => updateGpsField('isActive', event.target.checked)} disabled={!gpsForm.subjectId || gpsForm.consentStatus !== 'granted' || gpsProfileLoading || gpsSubmitting} className="mt-0.5 h-4 w-4 accent-primary" /><span><span className="block text-sm font-bold text-text">啟用 GPS 關懷</span><span className="mt-1 block text-xs leading-5 text-text/50">只有同意狀態為明確 granted 時才能啟用。</span></span></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-xs font-bold text-text/55">住家緯度{gpsForm.isActive && '（啟用時必填）'}</span><input type="number" min="-90" max="90" step="0.000001" value={gpsForm.homeLatitude} onChange={(event) => updateGpsField('homeLatitude', event.target.value)} placeholder="例如 24.123456" className="mt-2 h-11 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50" disabled={!gpsForm.subjectId || gpsSubmitting} /></label><label className="block"><span className="text-xs font-bold text-text/55">住家經度{gpsForm.isActive && '（啟用時必填）'}</span><input type="number" min="-180" max="180" step="0.000001" value={gpsForm.homeLongitude} onChange={(event) => updateGpsField('homeLongitude', event.target.value)} placeholder="例如 120.123456" className="mt-2 h-11 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50" disabled={!gpsForm.subjectId || gpsSubmitting} /></label></div>
              <label className="block"><span className="text-xs font-bold text-text/55">住家半徑（公尺）</span><input type="number" min="1" max="50000" step="1" value={gpsForm.radiusMeters} onChange={(event) => updateGpsField('radiusMeters', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-sky-100 bg-white px-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50" disabled={!gpsForm.subjectId || gpsSubmitting} /><p className="mt-1 text-xs text-text/40">預設 300 公尺。</p></label>
            </div>}
          </section>

          <div className="flex flex-col-reverse gap-2 border-t border-sky-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={closeGpsModal} disabled={gpsSubmitting} className="h-11 rounded-lg border border-sky-200 px-4 text-sm font-bold text-text/60 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-45">取消</button><button type="submit" disabled={gpsSubmitting || gpsProfileLoading || patientsLoading || !gpsForm.subjectId || Boolean(patientsError)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50">{gpsSubmitting && <Loader2 size={17} className="animate-spin" />}儲存 GPS 設定</button></div>
        </form>
      </ManagerModal>}

      {createModalOpen && <CareOutreachCreateModal
        open
        patients={patients}
        loadingPatients={patientsLoading}
        patientsError={patientsError}
        onRetryPatients={loadPatients}
        onClose={() => { if (!createSubmitting) setCreateModalOpen(false); }}
        onSubmit={submitCreateCase}
        submitting={createSubmitting}
      />}
    </div>
  );
};

export default CareOutreachManager;
