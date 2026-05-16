import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Download, Eye, FileText, Loader2, Search } from 'lucide-react';
import { formsApi } from '../api/forms';
import { useToast } from '../context/useToast';
import { buildQuestionnaireXlsxFilename, downloadBlob } from '../utils/download';

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

const QuestionnaireManager = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [responses, setResponses] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [responseSearch, setResponseSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
        const data = await formsApi.listTemplateResponses(selectedTemplateId);
        setResponses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load questionnaire responses:', error);
        showToast('載入填答紀錄失敗: ' + error.message, 'error');
      } finally {
        setIsLoadingResponses(false);
      }
    };

    loadResponses();
  }, [selectedTemplateId, showToast]);

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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-bold text-primary">
            <ClipboardList size={14} />
            問卷管理
          </div>
          <h1 className="text-3xl font-bold text-primary">問卷管理</h1>
          <p className="mt-2 text-sm text-text/55">以問卷為主軸查看所有填答紀錄。</p>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:w-[420px]">
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
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
            <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
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

        <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-bold text-primary">
                <FileText size={14} />
                {selectedTemplate?.category || '未分類'}
              </div>
              <h2 className="text-xl font-bold text-text">{selectedTemplate?.title || '請選擇問卷'}</h2>
              <p className="mt-1 text-sm text-text/45">
                目前顯示 {filteredResponses.length} / {responses.length} 筆填答紀錄
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_160px]">
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
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_170px] gap-3 border-b border-sky-100 bg-sky-50/70 px-4 py-3 text-xs font-bold text-text/45 lg:grid">
                  <span>個案</span>
                  <span>狀態</span>
                  <span>個管師</span>
                  <span>時間</span>
                  <span className="text-right">操作</span>
                </div>
                <div className="divide-y divide-sky-100">
                  {filteredResponses.map(response => {
                    const meta = statusMeta(response.status);
                    return (
                      <div key={response.id} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-[1.4fr_1fr_1fr_1fr_170px] lg:items-center">
                        <div>
                          <p className="font-bold text-text">{response.subject_display_name || `個案 #${response.subject_backend_user_id || '-'}`}</p>
                          <p className="mt-1 text-xs text-text/45">身分/代碼：{response.subject_nation_id}</p>
                          <p className="mt-1 text-xs text-text/35">回覆 ID：{response.id}</p>
                        </div>
                        <div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-text/55">個管師 ID {response.filled_by_user_id}</p>
                        <div className="text-xs text-text/45">
                          <p>建立：{formatDateTime(response.created_at)}</p>
                          <p className="mt-1">更新：{formatDateTime(response.updated_at || response.created_at)}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {response.status === 'submitted' && (
                            <button
                              type="button"
                              onClick={() => handleDownloadXlsx(response)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm font-bold text-green-700 hover:bg-green-100"
                            >
                              <Download size={16} />
                              XLSX
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/patients/${response.subject_backend_user_id}/questionnaires/${response.template_id}/fill?responseId=${response.id}`)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-light"
                          >
                            <Eye size={16} />
                            檢視
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
      </div>
    </div>
  );
};

export default QuestionnaireManager;
