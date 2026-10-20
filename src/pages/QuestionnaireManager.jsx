import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Loader2,
  MoreVertical,
  RotateCcw,
  Search,
  Table2,
  Trash2,
} from 'lucide-react';
import { formsApi } from '../api/forms';
import { useToast } from '../context/useToast';
import { buildQuestionnaireXlsxFilename, downloadBlob } from '../utils/download';

const VISIT_OPTIONS = ['V1', 'V2', 'V3', 'V4'];
const GENDER_OPTIONS = [
  { value: 1, label: '男' },
  { value: 2, label: '女' },
];
const ROLE_OPTIONS = [
  { value: 3, label: '實驗組' },
  { value: 4, label: '對照組' },
];
const ICOPE_GROUP_OPTIONS = [
  { value: 'healthy', label: '健康族群' },
  { value: 'muscle_frailty', label: '肌力衰弱' },
  { value: 'oral_frailty', label: '口腔' },
  { value: 'psychology', label: '心理' },
];

const defaultExportFilters = {
  search: '',
  visits: [],
  assessmentDateFrom: '',
  assessmentDateTo: '',
  ageMin: '',
  ageMax: '',
  genderIds: [],
  roleIds: [],
  icopeGroups: [],
  limit: 1000,
};

const formatDateTime = (value) => {
  if (!value) return '尚未記錄';
  return new Date(value).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusMeta = (status) => (
  status === 'submitted'
    ? { label: '已送出', className: 'border-green-100 bg-green-50 text-green-700' }
    : { label: '草稿', className: 'border-amber-100 bg-amber-50 text-amber-700' }
);

const responseDisplayMeta = (response) => (
  response?.archived_at
    ? { label: '已封存', className: 'border-slate-200 bg-slate-50 text-slate-600' }
    : statusMeta(response.status)
);

const queryStatusMeta = (status) => (
  status === 'resolved'
    ? { label: '已處理', className: 'border-slate-100 bg-slate-50 text-slate-600', icon: <CheckCircle size={15} /> }
    : { label: '待處理', className: 'border-amber-100 bg-amber-50 text-amber-700', icon: <AlertTriangle size={15} /> }
);

const getFillerLabel = (response) => {
  const name = response.filled_by_display_name;
  const username = response.filled_by_username;
  const role = response.filled_by_role_name;
  const identity = [name, username ? `@${username}` : null].filter(Boolean).join(' ');
  return [identity || `使用者 #${response.filled_by_user_id}`, role].filter(Boolean).join(' / ');
};

const toggleArrayValue = (currentValues, value) => (
  currentValues.includes(value)
    ? currentValues.filter(item => item !== value)
    : [...currentValues, value]
);

const QuestionnaireManager = () => {
  const navigate = useNavigate();
  const { showToast, requestConfirm } = useToast();
  const [activeTab, setActiveTab] = useState('manage');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [responses, setResponses] = useState([]);
  const [showArchivedResponses, setShowArchivedResponses] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [responseSearch, setResponseSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [queryItems, setQueryItems] = useState([]);
  const [isLoadingQueries, setIsLoadingQueries] = useState(false);
  const [queryStatusFilter, setQueryStatusFilter] = useState('open');
  const [queryTemplateFilter, setQueryTemplateFilter] = useState('all');
  const [querySearch, setQuerySearch] = useState('');
  const [openResponseActionMenu, setOpenResponseActionMenu] = useState(null);
  const [exportFilters, setExportFilters] = useState(defaultExportFilters);
  const [exportCandidates, setExportCandidates] = useState([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [isLoadingExportCandidates, setIsLoadingExportCandidates] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const data = await formsApi.listQuestionnaires();
        const items = Array.isArray(data) ? data : [];
        setTemplates(items);
        setSelectedTemplateId(items[0]?.id || null);
      } catch (error) {
        console.error('Failed to load questionnaire templates:', error);
        showToast('載入問卷庫失敗: ' + error.message, 'error');
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [showToast]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setResponses([]);
      return;
    }

    const loadResponses = async () => {
      setIsLoadingResponses(true);
      try {
        const data = showArchivedResponses
          ? await formsApi.listArchivedResponses({ templateId: selectedTemplateId })
          : await formsApi.listTemplateResponses(selectedTemplateId);
        setResponses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load questionnaire responses:', error);
        showToast('載入填答紀錄失敗: ' + error.message, 'error');
      } finally {
        setIsLoadingResponses(false);
      }
    };

    loadResponses();
  }, [selectedTemplateId, showArchivedResponses, showToast]);

  useEffect(() => {
    const loadQueries = async () => {
      setIsLoadingQueries(true);
      try {
        const data = await formsApi.listResponseQueries({
          status: queryStatusFilter,
          templateId: queryTemplateFilter === 'all' ? null : queryTemplateFilter,
          search: querySearch.trim() || undefined,
          limit: 200,
        });
        setQueryItems(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load questionnaire validation queries:', error);
        showToast('載入資料檢核清單失敗: ' + error.message, 'error');
      } finally {
        setIsLoadingQueries(false);
      }
    };

    const timer = window.setTimeout(loadQueries, 250);
    return () => window.clearTimeout(timer);
  }, [querySearch, queryStatusFilter, queryTemplateFilter, showToast]);

  useEffect(() => {
    setExportCandidates([]);
    setSelectedCandidateIds([]);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!openResponseActionMenu) return undefined;
    const closeMenu = () => setOpenResponseActionMenu(null);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [openResponseActionMenu]);

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearch.trim().toLowerCase();
    return templates.filter(template => {
      if (!keyword) return true;
      return [
        template.title,
        template.code,
        template.category,
        template.sequence_group,
        template.source_path,
      ].filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });
  }, [templateSearch, templates]);

  const filteredResponses = useMemo(() => {
    const keyword = responseSearch.trim().toLowerCase();
    return responses.filter(response => {
      const matchesStatus = statusFilter === 'all' || response.status === statusFilter;
      const matchesKeyword = !keyword || [
        response.subject_display_name,
        response.subject_nation_id,
        response.subject_backend_user_id,
        response.filled_by_user_id,
        response.id,
      ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase().includes(keyword);
      return matchesStatus && matchesKeyword;
    });
  }, [responseSearch, responses, statusFilter]);

  const selectedTemplate = templates.find(template => String(template.id) === String(selectedTemplateId));
  const submittedCount = responses.filter(response => response.status === 'submitted').length;
  const draftCount = responses.filter(response => response.status === 'draft').length;
  const archivedCount = responses.filter(response => response.archived_at).length;
  const openQueryCount = queryStatusFilter === 'open'
    ? queryItems.length
    : queryItems.filter(query => query.status === 'open').length;

  const reloadResponses = async () => {
    if (!selectedTemplateId) return;
    setIsLoadingResponses(true);
    try {
      const data = showArchivedResponses
        ? await formsApi.listArchivedResponses({ templateId: selectedTemplateId })
        : await formsApi.listTemplateResponses(selectedTemplateId);
      setResponses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to reload questionnaire responses:', error);
      showToast('重新載入填答紀錄失敗: ' + error.message, 'error');
    } finally {
      setIsLoadingResponses(false);
    }
  };

  const handleDownloadXlsx = async (response) => {
    if (response.status !== 'submitted') {
      showToast('只有已送出的問卷可以下載 XLSX', 'error');
      return;
    }

    try {
      const blob = await formsApi.downloadResponseXlsx(response.id);
      downloadBlob(blob, buildQuestionnaireXlsxFilename({
        subjectName: response.subject_display_name,
        subjectNationId: response.subject_nation_id,
        templateTitle: selectedTemplate?.title || response.template_title || `問卷_${response.template_id}`,
        submittedAt: response.submitted_at,
      }));
    } catch (error) {
      console.error('Failed to download questionnaire xlsx:', error);
      showToast('下載問卷 XLSX 失敗: ' + error.message, 'error');
    }
  };

  const handleDownloadPdf = async (response) => {
    try {
      const blob = await formsApi.downloadResponsePdf(response.id);
      downloadBlob(blob, `${response.subject_display_name || '個案'}_${selectedTemplate?.title || response.template_title || `問卷_${response.template_id}`}_${response.id}.pdf`);
    } catch (error) {
      console.error('Failed to download questionnaire pdf:', error);
      showToast('下載問卷 PDF 失敗: ' + error.message, 'error');
    }
  };

  const handleArchiveResponse = async (response) => {
    const confirmed = await requestConfirm('確定要封存這份問卷嗎？封存後不會出現在一般問卷列表、比對與資料檢核清單。', '封存問卷');
    if (!confirmed) return;
    try {
      await formsApi.archiveResponse(response.id, { archive_reason: '使用者從問卷管理封存' });
      showToast('問卷已封存', 'success');
      reloadResponses();
    } catch (error) {
      console.error('Failed to archive questionnaire response:', error);
      showToast('封存問卷失敗: ' + error.message, 'error');
    }
  };

  const handleRestoreResponse = async (response) => {
    const confirmed = await requestConfirm('確定要還原這份已封存問卷嗎？還原後會回到一般問卷列表。', '還原問卷');
    if (!confirmed) return;
    try {
      await formsApi.restoreResponse(response.id);
      showToast('問卷已還原', 'success');
      reloadResponses();
    } catch (error) {
      console.error('Failed to restore questionnaire response:', error);
      showToast('還原問卷失敗: ' + error.message, 'error');
    }
  };

  const handleLoadExportCandidates = async () => {
    if (!selectedTemplateId) {
      showToast('請先選擇問卷', 'error');
      return;
    }
    setIsLoadingExportCandidates(true);
    try {
      const data = await formsApi.listExportCandidates(selectedTemplateId, exportFilters);
      const items = Array.isArray(data) ? data : [];
      setExportCandidates(items);
      setSelectedCandidateIds([]);
      showToast(`已載入 ${items.length} 筆可匯出資料`, 'success');
    } catch (error) {
      console.error('Failed to load export candidates:', error);
      showToast('載入匯出候選資料失敗: ' + error.message, 'error');
    } finally {
      setIsLoadingExportCandidates(false);
    }
  };

  const handleExportBatchXlsx = async () => {
    if (!selectedTemplateId || selectedCandidateIds.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await formsApi.downloadQuestionnaireBatchXlsx(selectedTemplateId, {
        response_ids: selectedCandidateIds,
        filters: exportFilters,
      });
      const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
      downloadBlob(blob, `${selectedTemplate?.title || `問卷_${selectedTemplateId}`}_批次匯出_${today}.xlsx`);
    } catch (error) {
      console.error('Failed to export questionnaire batch xlsx:', error);
      showToast('批次匯出失敗: ' + error.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleResponseActionMenu = (event, response) => {
    event.stopPropagation();
    if (openResponseActionMenu?.id === response.id) {
      setOpenResponseActionMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = response.status === 'submitted' ? 230 : 190;
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    const opensUp = rect.bottom + menuHeight + 12 > window.innerHeight;
    const top = opensUp ? Math.max(12, rect.top - menuHeight - 8) : rect.bottom + 8;
    setOpenResponseActionMenu({ id: response.id, top, left });
  };

  const setExportArrayFilter = (key, value) => {
    setExportFilters(prev => ({
      ...prev,
      [key]: toggleArrayValue(prev[key] || [], value),
    }));
  };

  const renderTemplateSelector = () => (
    <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <label className="text-xs font-bold text-text/50">搜尋問卷</label>
        <div className="relative mt-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
          <input
            type="search"
            className="min-h-11 w-full rounded-xl border border-sky-100 bg-sky-50/30 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={templateSearch}
            onChange={(event) => setTemplateSearch(event.target.value)}
            placeholder="問卷名稱、分類、代碼"
          />
        </div>
      </div>

      {isLoadingTemplates ? (
        <div className="flex items-center justify-center py-12 text-primary">
          <Loader2 size={24} className="mr-2 animate-spin" />
          載入問卷庫...
        </div>
      ) : (
        <div className="max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1">
          {filteredTemplates.map(template => {
            const isSelected = String(template.id) === String(selectedTemplateId);
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-sky-100 bg-white text-text hover:border-primary/30 hover:bg-sky-50/40'
                }`}
              >
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {template.category || '未分類'}
                  </span>
                  {template.sequence_group && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-text/45">
                      {template.sequence_group}
                    </span>
                  )}
                </div>
                <p className="font-bold leading-snug">{template.title}</p>
                <p className="mt-1 text-xs text-text/40">ID {template.id} / {template.extraction_status}</p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderManageTab = () => (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      {renderTemplateSelector()}
      <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-bold text-primary">
              <FileText size={14} />
              {selectedTemplate?.category || '未分類'}
            </div>
            <h2 className="text-xl font-bold text-text">{selectedTemplate?.title || '請選擇問卷'}</h2>
            <p className="mt-1 text-sm text-text/45">
              目前顯示 {filteredResponses.length} / {responses.length} 筆{showArchivedResponses ? '已封存' : ''}填答紀錄
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_220px_160px]">
            <button
              type="button"
              onClick={() => setShowArchivedResponses(prev => !prev)}
              className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors ${
                showArchivedResponses
                  ? 'border-slate-300 bg-slate-700 text-white hover:bg-slate-600'
                  : 'border-sky-100 bg-white text-primary hover:bg-sky-50'
              }`}
            >
              {showArchivedResponses ? '查看一般' : '已封存區'}
            </button>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
              <input
                type="search"
                className="min-h-11 w-full rounded-xl border border-sky-100 bg-sky-50/30 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={responseSearch}
                onChange={(event) => setResponseSearch(event.target.value)}
                placeholder="個案、身分/代碼、ID"
              />
            </div>
            <select
              className="min-h-11 rounded-xl border border-sky-100 bg-sky-50/30 px-3 text-sm font-bold text-text/70 focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">全部狀態</option>
              <option value="draft">草稿</option>
              <option value="submitted">已送出</option>
            </select>
          </div>
        </div>

        <div className="mt-5">
          {isLoadingResponses ? (
            <div className="flex items-center justify-center py-16 text-primary">
              <Loader2 size={28} className="mr-2 animate-spin" />
              載入填答紀錄...
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-sky-100 bg-sky-50/30 py-16 text-center text-text/40">
              <FileText size={44} className="mx-auto mb-3 text-sky-300" />
              <p className="font-bold">目前沒有符合條件的填答紀錄</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-sky-100">
              <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_72px] gap-3 border-b border-sky-100 bg-sky-50/70 px-4 py-3 text-xs font-bold text-text/45 lg:grid">
                <span>個案</span>
                <span>狀態</span>
                <span>個管師</span>
                <span>時間</span>
                <span className="text-right">操作</span>
              </div>
              <div className="divide-y divide-sky-100">
                {filteredResponses.map(response => {
                  const meta = responseDisplayMeta(response);
                  return (
                    <div key={response.id} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-[1.4fr_1fr_1fr_1fr_72px] lg:items-center">
                      <div>
                        <p className="font-bold text-text">{response.subject_display_name || `個案 #${response.subject_backend_user_id || '-'}`}</p>
                        <p className="mt-1 text-xs text-text/45">身分/代碼：{response.subject_nation_id}</p>
                        <p className="mt-1 text-xs text-text/35">回覆 ID：{response.id}</p>
                      </div>
                      <div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                          {meta.label}
                        </span>
                        {response.visit && <p className="mt-2 text-xs text-text/40">Visit：{response.visit}</p>}
                        {response.assessment_date && <p className="mt-1 text-xs text-text/40">評估：{response.assessment_date}</p>}
                      </div>
                      <p className="text-text/55">{getFillerLabel(response)}</p>
                      <div className="text-xs text-text/45">
                        <p>建立：{formatDateTime(response.created_at)}</p>
                        <p className="mt-1">更新：{formatDateTime(response.updated_at || response.created_at)}</p>
                      </div>
                      <div className="relative flex justify-end">
                        <button
                          type="button"
                          onClick={(event) => toggleResponseActionMenu(event, response)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-100 bg-white text-primary transition-colors hover:bg-sky-50"
                          aria-label="問卷操作"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openResponseActionMenu?.id === response.id && (
                          <div
                            className="fixed z-[1000] w-44 overflow-hidden rounded-xl border border-sky-100 bg-white py-1 text-sm shadow-xl"
                            style={{ top: openResponseActionMenu.top, left: openResponseActionMenu.left }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenResponseActionMenu(null);
                                navigate(`/patients/${response.subject_backend_user_id}/questionnaires/${response.template_id}/fill?responseId=${response.id}`);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-text/70 hover:bg-sky-50"
                            >
                              <Eye size={16} />
                              {response.archived_at || response.status === 'submitted' ? '檢視問卷' : '編輯問卷'}
                            </button>
                            {response.status === 'submitted' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenResponseActionMenu(null);
                                  handleDownloadXlsx(response);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-green-700 hover:bg-green-50"
                              >
                                <Download size={16} />
                                下載 XLSX
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenResponseActionMenu(null);
                                handleDownloadPdf(response);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-primary hover:bg-sky-50"
                            >
                              <Download size={16} />
                              下載 PDF
                            </button>
                            {response.archived_at ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenResponseActionMenu(null);
                                  handleRestoreResponse(response);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-slate-700 hover:bg-slate-50"
                              >
                                <RotateCcw size={16} />
                                還原問卷
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenResponseActionMenu(null);
                                  handleArchiveResponse(response);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 size={16} />
                                封存問卷
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderQueriesTab = () => (
    <section className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            <AlertTriangle size={14} />
            資料檢核清單
          </div>
          <h2 className="text-xl font-bold text-text">V1-V4 量表異常值</h2>
          <p className="mt-1 text-sm text-text/45">顯示目前可查看個案的問卷 validation query，待處理 {openQueryCount} 筆。</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_220px_240px]">
          <select
            className="min-h-11 rounded-xl border border-amber-100 bg-amber-50/30 px-3 text-sm font-bold text-text/70 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={queryStatusFilter}
            onChange={(event) => setQueryStatusFilter(event.target.value)}
          >
            <option value="open">待處理</option>
            <option value="resolved">已處理</option>
            <option value="all">全部</option>
          </select>
          <select
            className="min-h-11 rounded-xl border border-amber-100 bg-amber-50/30 px-3 text-sm font-bold text-text/70 focus:outline-none focus:ring-2 focus:ring-amber-200"
            value={queryTemplateFilter}
            onChange={(event) => setQueryTemplateFilter(event.target.value)}
          >
            <option value="all">全部問卷</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>{template.id}. {template.title}</option>
            ))}
          </select>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
            <input
              type="search"
              className="min-h-11 w-full rounded-xl border border-amber-100 bg-amber-50/30 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              value={querySearch}
              onChange={(event) => setQuerySearch(event.target.value)}
              placeholder="個案、欄位、問卷"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        {isLoadingQueries ? (
          <div className="flex items-center justify-center rounded-xl border border-amber-100 bg-amber-50/40 py-10 text-amber-700">
            <Loader2 size={22} className="mr-2 animate-spin" />
            載入資料檢核...
          </div>
        ) : queryItems.length === 0 ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50/30 py-10 text-center text-text/40">
            <CheckCircle size={36} className="mx-auto mb-2 text-green-400" />
            <p className="font-bold">目前沒有符合條件的資料檢核紀錄</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-amber-100">
            <div className="hidden grid-cols-[1.2fr_1.4fr_1fr_1fr_120px] gap-3 border-b border-amber-100 bg-amber-50/70 px-4 py-3 text-xs font-bold text-text/45 lg:grid">
              <span>個案</span>
              <span>檢核內容</span>
              <span>問卷</span>
              <span>狀態 / 時間</span>
              <span className="text-right">操作</span>
            </div>
            <div className="max-h-[640px] divide-y divide-amber-100 overflow-y-auto">
              {queryItems.map(query => {
                const meta = queryStatusMeta(query.status);
                return (
                  <div key={query.id} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-[1.2fr_1.4fr_1fr_1fr_120px] lg:items-center">
                    <div>
                      <p className="font-bold text-text">{query.subject_display_name || `個案 #${query.subject_backend_user_id || '-'}`}</p>
                      <p className="mt-1 text-xs text-text/45">身分/代碼：{query.subject_nation_id}</p>
                      <p className="mt-1 text-xs text-text/35">Visit：{query.visit || '-'}</p>
                    </div>
                    <div>
                      <p className="font-bold text-amber-900">{query.field_label || query.field_id}</p>
                      {query.section_title && <p className="mt-1 text-xs font-bold text-text/40">{query.section_title}</p>}
                      <p className="mt-1 text-text/60">{query.message}</p>
                      <p className="mt-1 text-xs font-bold text-text/40">目前值：{String(query.value_json?.value ?? '空白')}</p>
                    </div>
                    <div>
                      <p className="font-bold text-text/70">{query.template_title || `問卷 #${query.template_id}`}</p>
                      <p className="mt-1 text-xs text-text/40">Response #{query.response_id}</p>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      <p className="mt-2 text-xs text-text/45">建立：{formatDateTime(query.created_at)}</p>
                      {query.resolved_at && <p className="mt-1 text-xs text-text/45">處理：{formatDateTime(query.resolved_at)}</p>}
                      {query.care_date && <p className="mt-1 text-xs font-bold text-amber-700">關懷日期：{query.care_date}</p>}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => navigate(`/patients/${query.subject_backend_user_id}/questionnaires/${query.template_id}/fill?responseId=${query.response_id}`)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                        disabled={!query.subject_backend_user_id}
                      >
                        <Eye size={16} />
                        處理
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );

  const renderExportTab = () => (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      {renderTemplateSelector()}
      <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
            <Table2 size={14} />
            批次 Excel 匯出
          </div>
          <h2 className="text-xl font-bold text-text">{selectedTemplate?.title || '請選擇問卷'}</h2>
          <p className="text-sm text-text/45">預設只匯出最新的已送出回覆。同一個案、同一問卷、同一 Visit 如有多筆，只取最新送出資料。</p>
        </div>

        <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/30 p-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
              <input
                type="search"
                className="min-h-11 w-full rounded-xl border border-sky-100 bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={exportFilters.search}
                onChange={(event) => setExportFilters(prev => ({ ...prev, search: event.target.value }))}
                placeholder="帳號、姓名、身分/代碼，例如 S0*"
              />
            </div>
            <input
              type="date"
              className="min-h-11 rounded-xl border border-sky-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={exportFilters.assessmentDateFrom}
              onChange={(event) => setExportFilters(prev => ({ ...prev, assessmentDateFrom: event.target.value }))}
            />
            <input
              type="date"
              className="min-h-11 rounded-xl border border-sky-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={exportFilters.assessmentDateTo}
              onChange={(event) => setExportFilters(prev => ({ ...prev, assessmentDateTo: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                className="min-h-11 rounded-xl border border-sky-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={exportFilters.ageMin}
                onChange={(event) => setExportFilters(prev => ({ ...prev, ageMin: event.target.value }))}
                placeholder="年齡起"
              />
              <input
                type="number"
                min="0"
                className="min-h-11 rounded-xl border border-sky-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={exportFilters.ageMax}
                onChange={(event) => setExportFilters(prev => ({ ...prev, ageMax: event.target.value }))}
                placeholder="年齡迄"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-text/45">Visit</legend>
              <div className="flex flex-wrap gap-2">
                {VISIT_OPTIONS.map(visit => (
                  <label key={visit} className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-text/65">
                    <input
                      type="checkbox"
                      checked={exportFilters.visits.includes(visit)}
                      onChange={() => setExportArrayFilter('visits', visit)}
                    />
                    {visit}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-text/45">性別</legend>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map(option => (
                  <label key={option.value} className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-text/65">
                    <input
                      type="checkbox"
                      checked={exportFilters.genderIds.includes(option.value)}
                      onChange={() => setExportArrayFilter('genderIds', option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-text/45">實驗/對照組</legend>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(option => (
                  <label key={option.value} className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-text/65">
                    <input
                      type="checkbox"
                      checked={exportFilters.roleIds.includes(option.value)}
                      onChange={() => setExportArrayFilter('roleIds', option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-text/45">ICOPE 收案分類</legend>
              <div className="flex flex-wrap gap-2">
                {ICOPE_GROUP_OPTIONS.map(option => (
                  <label key={option.value} className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-text/65">
                    <input
                      type="checkbox"
                      checked={exportFilters.icopeGroups.includes(option.value)}
                      onChange={() => setExportArrayFilter('icopeGroups', option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setExportFilters(defaultExportFilters);
                setExportCandidates([]);
                setSelectedCandidateIds([]);
              }}
              className="min-h-11 rounded-xl border border-sky-100 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50"
            >
              清除篩選
            </button>
            <button
              type="button"
              onClick={handleLoadExportCandidates}
              disabled={!selectedTemplateId || isLoadingExportCandidates}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoadingExportCandidates && <Loader2 size={18} className="animate-spin" />}
              載入候選資料
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-text">
            已選 {selectedCandidateIds.length} / {exportCandidates.length} 筆
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCandidateIds(exportCandidates.map(candidate => candidate.response_id))}
              disabled={exportCandidates.length === 0}
              className="min-h-10 rounded-xl border border-sky-100 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50 disabled:opacity-50"
            >
              全選篩選結果
            </button>
            <button
              type="button"
              onClick={() => setSelectedCandidateIds([])}
              disabled={selectedCandidateIds.length === 0}
              className="min-h-10 rounded-xl border border-sky-100 bg-white px-4 text-sm font-bold text-primary hover:bg-sky-50 disabled:opacity-50"
            >
              全取消
            </button>
            <button
              type="button"
              onClick={handleExportBatchXlsx}
              disabled={selectedCandidateIds.length === 0 || isExporting}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              匯出 Excel
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-sky-100">
          <div className="hidden grid-cols-[52px_1.2fr_0.8fr_0.9fr_1fr_1fr_1fr] gap-3 border-b border-sky-100 bg-sky-50/70 px-4 py-3 text-xs font-bold text-text/45 xl:grid">
            <span></span>
            <span>個案</span>
            <span>Visit / 日期</span>
            <span>年齡 / 性別</span>
            <span>組別</span>
            <span>填答者</span>
            <span>送出時間</span>
          </div>
          {isLoadingExportCandidates ? (
            <div className="flex items-center justify-center py-16 text-primary">
              <Loader2 size={28} className="mr-2 animate-spin" />
              載入候選資料...
            </div>
          ) : exportCandidates.length === 0 ? (
            <div className="py-16 text-center text-text/40">
              <Table2 size={42} className="mx-auto mb-3 text-sky-300" />
              <p className="font-bold">尚未載入候選資料，或沒有符合條件的已送出問卷</p>
            </div>
          ) : (
            <div className="max-h-[640px] divide-y divide-sky-100 overflow-y-auto">
              {exportCandidates.map(candidate => {
                const checked = selectedCandidateIds.includes(candidate.response_id);
                return (
                  <label key={candidate.response_id} className="grid cursor-pointer grid-cols-1 gap-3 px-4 py-4 text-sm hover:bg-sky-50/40 xl:grid-cols-[52px_1.2fr_0.8fr_0.9fr_1fr_1fr_1fr] xl:items-center">
                    <span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedCandidateIds(prev => toggleArrayValue(prev, candidate.response_id))}
                        className="h-4 w-4"
                      />
                    </span>
                    <span>
                      <span className="block font-bold text-text">{candidate.subject_display_name || `個案 #${candidate.subject_backend_user_id || '-'}`}</span>
                      <span className="mt-1 block text-xs text-text/45">@{candidate.subject_username || '-'} / {candidate.subject_nation_id}</span>
                      <span className="mt-1 block text-xs text-text/35">Response #{candidate.response_id}</span>
                    </span>
                    <span className="text-text/60">
                      <span className="block font-bold">{candidate.visit || '-'}</span>
                      <span className="mt-1 block text-xs">{candidate.assessment_date || '未填評估日期'}</span>
                    </span>
                    <span className="text-text/60">{candidate.age ?? '-'} / {candidate.gender_name || '-'}</span>
                    <span className="text-text/60">
                      <span className="block font-bold">{candidate.role_name || '-'}</span>
                      <span className="mt-1 block text-xs">{(candidate.icope_group_labels || []).join('、') || '無 ICOPE 分類'}</span>
                    </span>
                    <span className="text-text/60">{candidate.filled_by_display_name || candidate.filled_by_username || '-'}</span>
                    <span className="text-xs text-text/45">{formatDateTime(candidate.submitted_at)}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const tabs = [
    { id: 'manage', label: '問卷管理', icon: <ClipboardList size={16} /> },
    { id: 'queries', label: '異常值', icon: <AlertTriangle size={16} /> },
    { id: 'export', label: '匯出', icon: <Table2 size={16} /> },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-bold text-primary">
            <ClipboardList size={14} />
            問卷管理
          </div>
          <h1 className="text-3xl font-bold text-primary">問卷管理</h1>
          <p className="mt-2 text-sm text-text/55">以問卷為主軸查看、檢核與匯出填答紀錄。</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:w-[560px] lg:grid-cols-4">
          <div className="rounded-2xl border border-sky-100 bg-white p-4">
            <p className="text-xs font-bold text-text/40">問卷數</p>
            <p className="mt-1 text-2xl font-bold text-primary">{templates.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <p className="text-xs font-bold text-amber-700/70">草稿</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{draftCount}</p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
            <p className="text-xs font-bold text-green-700/70">已送出</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{submittedCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">已封存</p>
            <p className="mt-1 text-2xl font-bold text-slate-700">{archivedCount}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-sky-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text/45 hover:text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'manage' && renderManageTab()}
      {activeTab === 'queries' && renderQueriesTab()}
      {activeTab === 'export' && renderExportTab()}
    </div>
  );
};

export default QuestionnaireManager;
