import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle, Cloud, CloudOff, Download, Eraser, FileText, Loader2, RotateCcw, Save, Send } from 'lucide-react';
import QuestionnaireFormRenderer from '../components/QuestionnaireFormRenderer';
import { getQuestionnaireFields } from '../utils/questionnaire';
import { buildQuestionnaireXlsxFilename, downloadBlob } from '../utils/download';
import { formsApi } from '../api/forms';
import { managementApi } from '../api/management';
import { useToast } from '../context/useToast';
import { useAuth } from '../context/useAuth';

const getTodayString = () => new Date().toISOString().slice(0, 10);
const DEFAULT_VISIT = 'V1';

const isEmptyValue = (value) => value === undefined || value === null || value === '';
const hasAnswerValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
};
const isAssetField = (field) => field.type === 'signature_image' || field.type === 'drawing_image';

const AUTOSAVE_DELAY_MS = 1200;
const LOCAL_DRAFT_PREFIX = 'questionnaire-draft:';
const LOCAL_DRAFT_MAX_AGE_DAYS = 7;
const LOCAL_DRAFT_MAX_AGE_MS = LOCAL_DRAFT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

const getDraftStorageKey = ({ responseId, patientId, templateId, userId }) => (
  responseId
    ? `${LOCAL_DRAFT_PREFIX}response:${responseId}:patient:${patientId}:user:${userId || 'unknown'}`
    : `${LOCAL_DRAFT_PREFIX}new:${patientId}:${templateId}:${userId || 'unknown'}`
);

const readLocalDraft = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to read local questionnaire draft', error);
    return null;
  }
};

const writeLocalDraft = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to write local questionnaire draft', error);
  }
};

const removeLocalDraft = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove local questionnaire draft', error);
  }
};

const cleanupExpiredLocalDrafts = () => {
  const now = Date.now();

  Object.keys(localStorage).forEach(key => {
    if (!key.startsWith(LOCAL_DRAFT_PREFIX)) return;

    try {
      const draft = JSON.parse(localStorage.getItem(key));
      const savedAt = new Date(draft?.saved_at).getTime();
      const isExpired = !savedAt || now - savedAt > LOCAL_DRAFT_MAX_AGE_MS;

      if (isExpired) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Removed invalid local questionnaire draft', error);
      localStorage.removeItem(key);
    }
  });
};

const getRemoteUpdatedAt = (response) => {
  if (!response?.updated_at && !response?.created_at) return 0;
  return new Date(response.updated_at || response.created_at).getTime();
};

const buildInitialAnswers = (questionnaire, patient, response) => {
  const existingAnswers = response?.answers_json || {};
  const fields = getQuestionnaireFields(questionnaire);
  const details = patient?.details || {};
  const nextAnswers = { ...existingAnswers };

  fields.forEach(field => {
    if (field.id === 'subject_code' && details.nation_id && isEmptyValue(nextAnswers[field.id])) {
      nextAnswers[field.id] = details.nation_id;
    }
    if (field.id === 'visit' && isEmptyValue(nextAnswers[field.id])) {
      nextAnswers[field.id] = DEFAULT_VISIT;
    }
    if (field.id === 'assessment_date' && isEmptyValue(nextAnswers[field.id])) {
      nextAnswers[field.id] = getTodayString();
    }
  });

  return nextAnswers;
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

const formatScoreValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  if (Number.isFinite(numberValue)) {
    return numberValue.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
  }
  return String(value);
};

const getComponentScoreItems = (scoreJson) => {
  const components = scoreJson?.component_scores;
  if (!components || typeof components !== 'object' || Array.isArray(components)) return [];

  return Object.entries(components)
    .map(([label, value]) => ({ label, value: formatScoreValue(value) }))
    .filter(item => item.value !== null);
};

const getAssessmentGroupLabels = (assessmentResultJson, scoreJson) => {
  const groups = assessmentResultJson?.matched_groups;
  if (Array.isArray(groups) && groups.length > 0) {
    return groups
      .map(group => group?.label || group?.code)
      .filter(Boolean);
  }
  const labels = scoreJson?.matched_group_labels;
  return Array.isArray(labels) ? labels.filter(Boolean) : [];
};

const ScoreSummary = ({ questionnaire, scoreJson, assessmentResultJson }) => {
  const hasScore = scoreJson && Object.keys(scoreJson).length > 0;
  const hasAssessment = assessmentResultJson && Object.keys(assessmentResultJson).length > 0;
  if (!hasScore && !hasAssessment) return null;

  const fields = getQuestionnaireFields(questionnaire);
  const fieldLabels = Object.fromEntries(fields.map(field => [field.id, field.label || field.id]));
  const totalScore = formatScoreValue(scoreJson?.total_score);
  const fieldScores = Array.isArray(scoreJson?.fields) ? scoreJson.fields : [];
  const componentScores = getComponentScoreItems(scoreJson);
  const assessmentGroupLabels = getAssessmentGroupLabels(assessmentResultJson, scoreJson);
  const unknownDomains = Array.isArray(assessmentResultJson?.unknown_domains)
    ? assessmentResultJson.unknown_domains.filter(Boolean)
    : [];

  return (
    <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-green-800">
        <CheckCircle size={17} />
        評分結果
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {totalScore !== null && (
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-bold text-text/45">總分</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{totalScore} 分</p>
          </div>
        )}
        {componentScores.map(item => (
          <div key={item.label} className="rounded-xl bg-white p-3">
            <p className="text-xs font-bold text-text/45">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{item.value} 分</p>
          </div>
        ))}
      </div>
      {assessmentGroupLabels.length > 0 && (
        <div className="mt-3 rounded-xl bg-white p-3">
          <p className="text-xs font-bold text-text/45">收案分類</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {assessmentGroupLabels.map(label => (
              <span key={label} className="rounded-lg bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                {label}
              </span>
            ))}
          </div>
          {unknownDomains.length > 0 && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              尚有未完整判定：{unknownDomains.join('、')}
            </p>
          )}
        </div>
      )}
      {fieldScores.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-green-100 bg-white">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-green-100 px-3 py-2 text-xs font-bold text-text/45">
            <span>項目</span>
            <span>得分</span>
          </div>
          <div className="divide-y divide-green-50">
            {fieldScores.map(item => {
              const score = formatScoreValue(item.score);
              return (
                <div key={item.field_id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
                  <span className="text-text/75">{fieldLabels[item.field_id] || item.field_id}</span>
                  <span className="font-bold text-green-800">{score !== null ? `${score} 分` : '未計分'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const QUERY_ACTION_OPTIONS = [
  { value: 'accepted', label: '確認保留原值' },
  { value: 'corrected', label: '已修正資料' },
  { value: 'not_applicable', label: '不適用' },
];

const ValidationQuerySummary = ({ queries = [], onUpdateQuery, showToast }) => {
  const [notes, setNotes] = useState({});
  const [actions, setActions] = useState({});
  const [careDates, setCareDates] = useState({});
  const [busyQueryId, setBusyQueryId] = useState(null);
  const allQueries = Array.isArray(queries) ? queries : [];
  const openQueries = allQueries.filter(query => query?.status === 'open');
  const resolvedQueries = allQueries.filter(query => query?.status === 'resolved');
  if (allQueries.length === 0) return null;

  const handleResolve = async (query) => {
    const note = (notes[query.id] || '').trim();
    if (!note) {
      showToast?.('請先填寫處理紀錄', 'error');
      return;
    }

    setBusyQueryId(query.id);
    try {
      const updatedQuery = await formsApi.updateResponseQuery(query.id, {
        status: 'resolved',
        resolution_action: actions[query.id] || 'accepted',
        resolution_note: note,
        care_date: careDates[query.id] ?? query.care_date ?? getTodayString(),
      });
      onUpdateQuery?.(updatedQuery);
      setNotes(prev => ({ ...prev, [query.id]: '' }));
      showToast?.('資料檢核已標記為已處理', 'success');
    } catch (error) {
      console.error('Failed to resolve validation query:', error);
      showToast?.('標記處理失敗: ' + error.message, 'error');
    } finally {
      setBusyQueryId(null);
    }
  };

  const handleReopen = async (query) => {
    const note = (notes[query.id] || '').trim();
    setBusyQueryId(query.id);
    try {
      const updatedQuery = await formsApi.updateResponseQuery(query.id, {
        status: 'open',
        resolution_note: note || '重新開啟資料檢核',
      });
      onUpdateQuery?.(updatedQuery);
      setNotes(prev => ({ ...prev, [query.id]: '' }));
      showToast?.('資料檢核已重新開啟', 'success');
    } catch (error) {
      console.error('Failed to reopen validation query:', error);
      showToast?.('重新開啟失敗: ' + error.message, 'error');
    } finally {
      setBusyQueryId(null);
    }
  };

  const renderQueryHeader = (query, resolved = false) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className={resolved ? 'font-bold text-slate-700' : 'font-bold text-amber-900'}>
          {query.field_label || query.field_id}
        </p>
        {query.section_title && (
          <p className="mt-0.5 text-xs font-bold text-text/40">{query.section_title}</p>
        )}
      </div>
      <span className={`w-fit rounded-lg px-2 py-0.5 text-xs font-bold ${
        resolved ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'
      }`}>
        {resolved ? '已處理' : query.severity === 'error' ? '錯誤' : '提醒'}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-800">
        <AlertTriangle size={17} />
        資料檢核
        <span className="rounded-full bg-white px-2 py-0.5 text-xs">{openQueries.length} 筆</span>
      </div>
      <div className="space-y-2">
        {openQueries.map(query => (
          <div key={query.id} className="rounded-xl bg-white p-3 text-sm">
            {renderQueryHeader(query)}
            <p className="mt-2 text-text/65">{query.message}</p>
            <p className="mt-1 text-xs font-bold text-text/45">
              目前值：{String(query.value_json?.value ?? '空白')}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[160px_150px_1fr_auto]">
              <select
                value={actions[query.id] || 'accepted'}
                onChange={(event) => setActions(prev => ({ ...prev, [query.id]: event.target.value }))}
                className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm font-bold text-text outline-none focus:border-primary"
                disabled={busyQueryId === query.id}
              >
                {QUERY_ACTION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={careDates[query.id] ?? query.care_date ?? getTodayString()}
                onChange={(event) => setCareDates(prev => ({ ...prev, [query.id]: event.target.value }))}
                className="rounded-lg border border-amber-100 px-3 py-2 text-sm font-bold text-text outline-none focus:border-primary"
                aria-label="關懷日期"
                disabled={busyQueryId === query.id}
              />
              <input
                type="text"
                value={notes[query.id] || ''}
                onChange={(event) => setNotes(prev => ({ ...prev, [query.id]: event.target.value }))}
                className="rounded-lg border border-amber-100 px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="處理紀錄 / 更改理由"
                disabled={busyQueryId === query.id}
              />
              <button
                type="button"
                onClick={() => handleResolve(query)}
                disabled={busyQueryId === query.id}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyQueryId === query.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                標記已處理
              </button>
            </div>
          </div>
        ))}
        {resolvedQueries.length > 0 && (
          <div className="rounded-xl border border-slate-100 bg-white/70 p-3">
            <p className="mb-2 text-xs font-bold text-text/45">已處理紀錄</p>
            <div className="space-y-2">
              {resolvedQueries.map(query => (
                <div key={query.id} className="rounded-lg bg-white p-3 text-sm">
                  {renderQueryHeader(query, true)}
                  <p className="mt-2 text-text/60">{query.message}</p>
                  {query.resolution_note && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-text/70">
                      {query.resolution_note}
                    </p>
                  )}
                  {query.care_date && (
                    <p className="mt-2 text-xs font-bold text-text/45">
                      關懷日期：{query.care_date}
                    </p>
                  )}
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={notes[query.id] || ''}
                      onChange={(event) => setNotes(prev => ({ ...prev, [query.id]: event.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-slate-100 px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="重新開啟原因"
                      disabled={busyQueryId === query.id}
                    />
                    <button
                      type="button"
                      onClick={() => handleReopen(query)}
                      disabled={busyQueryId === query.id}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
                    >
                      {busyQueryId === query.id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                      重新開啟
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const getAutosaveMeta = (status, isOnline, lastAutosavedAt) => {
  const timeText = lastAutosavedAt ? formatDateTime(lastAutosavedAt) : null;

  if (!isOnline || status === 'offline') {
    return {
      icon: <CloudOff size={17} />,
      className: 'border-amber-100 bg-amber-50 text-amber-700',
      text: timeText ? `離線暫存於本機：${timeText}` : '目前離線，填答會先暫存在本機',
    };
  }
  if (status === 'pending') {
    return {
      icon: <Loader2 size={17} className="animate-spin" />,
      className: 'border-sky-100 bg-sky-50 text-primary',
      text: '正在自動儲存草稿...',
    };
  }
  if (status === 'error') {
    return {
      icon: <CloudOff size={17} />,
      className: 'border-rose-100 bg-rose-50 text-rose-700',
      text: timeText ? `後端暫存失敗，本機已暫存：${timeText}` : '後端暫存失敗，本機仍保留填答',
    };
  }
  if (status === 'local_restored') {
    return {
      icon: <Cloud size={17} />,
      className: 'border-amber-100 bg-amber-50 text-amber-700',
      text: timeText ? `已還原本機暫存：${timeText}` : '已還原本機暫存',
    };
  }
  if (status === 'local_only') {
    return {
      icon: <CloudOff size={17} />,
      className: 'border-amber-100 bg-amber-50 text-amber-700',
      text: timeText ? `本機已暫存：${timeText}` : '本機已暫存',
    };
  }
  return {
    icon: <Cloud size={17} />,
    className: 'border-green-100 bg-green-50 text-green-700',
    text: timeText ? `已自動儲存：${timeText}` : '已啟用自動儲存',
  };
};

const QuestionnaireFill = () => {
  const { id, templateId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast, requestConfirm } = useToast();
  const { user } = useAuth();
  const responseId = searchParams.get('responseId');

  const [patient, setPatient] = useState(null);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [response, setResponse] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState('idle');
  const [lastAutosavedAt, setLastAutosavedAt] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const hasLoadedRef = useRef(false);
  const skipNextAutosaveRef = useRef(false);
  const latestAnswersRef = useRef({});
  const ensureDraftPromiseRef = useRef(null);
  const [isEnsuringDraft, setIsEnsuringDraft] = useState(false);

  const isSubmitted = response?.status === 'submitted';
  const isArchived = Boolean(response?.archived_at);
  const canEditResponse = !isArchived;
  const isReadOnly = isArchived;
  const activeResponseId = responseId || response?.id || null;
  const subjectNationId = patient?.details?.nation_id?.trim();
  const draftStorageKey = useMemo(() => getDraftStorageKey({
    responseId,
    patientId: id,
    templateId,
    userId: user?.id,
  }), [id, responseId, templateId, user?.id]);

  const responseMeta = useMemo(() => ([
    { label: '狀態', value: isArchived ? '已封存' : isSubmitted ? '已送出' : '草稿' },
    { label: '建立時間', value: formatDateTime(response?.created_at) },
    { label: '更新時間', value: formatDateTime(response?.updated_at) },
  ]), [isArchived, isSubmitted, response]);
  const autosaveMeta = getAutosaveMeta(autosaveStatus, isOnline, lastAutosavedAt);
  const hasAnyAnswer = Object.values(answers).some(hasAnswerValue);
  const questionnaireHasAssetFields = useMemo(() => (
    getQuestionnaireFields(questionnaire).some(isAssetField)
  ), [questionnaire]);

  const loadQuestionnaire = useCallback(async () => {
    setLoading(true);
    hasLoadedRef.current = false;
    cleanupExpiredLocalDrafts();
    try {
      const [patientData, questionnaireData, responseData] = await Promise.all([
        managementApi.getPatientDetail(id),
        formsApi.getQuestionnaire(templateId),
        responseId ? formsApi.getResponse(responseId) : Promise.resolve(null),
      ]);

      if (responseData && String(responseData.subject_backend_user_id) !== String(id)) {
        throw new Error('此問卷紀錄不屬於目前個案，已停止載入以避免覆蓋資料');
      }
      if (responseData && String(responseData.template_id) !== String(templateId)) {
        throw new Error('此問卷紀錄不屬於目前問卷，已停止載入以避免覆蓋資料');
      }

      setPatient(patientData);
      setQuestionnaire(questionnaireData);
      setResponse(responseData);

      const remoteAnswers = buildInitialAnswers(questionnaireData, patientData, responseData);
      const localDraft = readLocalDraft(draftStorageKey);
      const shouldRestoreLocal = (
        localDraft?.answers_json
        && localDraft.saved_at
        && new Date(localDraft.saved_at).getTime() > getRemoteUpdatedAt(responseData)
      );
      const initialAnswers = shouldRestoreLocal ? localDraft.answers_json : remoteAnswers;

      skipNextAutosaveRef.current = true;
      latestAnswersRef.current = initialAnswers;
      setAnswers(initialAnswers);
      if (shouldRestoreLocal) {
        setAutosaveStatus('local_restored');
        setLastAutosavedAt(localDraft.saved_at);
      } else {
        setAutosaveStatus('idle');
        setLastAutosavedAt(responseData?.updated_at || null);
      }
    } catch (error) {
      console.error('Failed to load questionnaire:', error);
      showToast('載入問卷失敗: ' + error.message, 'error');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [draftStorageKey, id, responseId, showToast, templateId]);

  useEffect(() => {
    loadQuestionnaire();
  }, [loadQuestionnaire]);

  const handleAnswerChange = (fieldId, value) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const buildPayload = useCallback((nextAnswers = answers) => ({
    subject_nation_id: subjectNationId,
    subject_backend_user_id: Number(id),
    answers_json: nextAnswers,
  }), [answers, id, subjectNationId]);

  const ensureDraftResponse = useCallback(async () => {
    const currentResponseId = response?.id || responseId;
    if (currentResponseId) return currentResponseId;
    if (isReadOnly) return null;

    if (!subjectNationId) {
      showToast('此個案尚未填寫身分/代碼，請先回個案資料補上 nation_id', 'error');
      return null;
    }

    if (!isOnline) {
      showToast('目前離線，請連線後再上傳簽名或繪圖圖片', 'error');
      return null;
    }

    if (ensureDraftPromiseRef.current) {
      return ensureDraftPromiseRef.current;
    }

    setIsEnsuringDraft(true);
    setAutosaveStatus('pending');
    ensureDraftPromiseRef.current = formsApi
      .saveDraft(templateId, buildPayload(latestAnswersRef.current), { suppressAuthRedirect: true })
      .then(savedResponse => {
        setResponse(savedResponse);
        setAutosaveStatus('saved');
        const savedAt = new Date().toISOString();
        setLastAutosavedAt(savedAt);

        if (savedResponse?.id) {
          const nextKey = getDraftStorageKey({
            responseId: savedResponse.id,
            patientId: id,
            templateId,
            userId: user?.id,
          });
          writeLocalDraft(nextKey, {
            response_id: savedResponse.id,
            template_id: Number(templateId),
            patient_id: Number(id),
            subject_nation_id: subjectNationId,
            answers_json: latestAnswersRef.current,
            saved_at: savedAt,
          });
          removeLocalDraft(draftStorageKey);
          navigate(`/patients/${id}/questionnaires/${templateId}/fill?responseId=${savedResponse.id}`, { replace: true });
          return savedResponse.id;
        }

        return null;
      })
      .catch(error => {
        console.error('Failed to prepare questionnaire draft:', error);
        setAutosaveStatus(navigator.onLine ? 'error' : 'offline');
        showToast('建立草稿失敗: ' + error.message, 'error');
        return null;
      })
      .finally(() => {
        setIsEnsuringDraft(false);
        ensureDraftPromiseRef.current = null;
      });

    return ensureDraftPromiseRef.current;
  }, [
    buildPayload,
    draftStorageKey,
    id,
    isOnline,
    isReadOnly,
    navigate,
    response?.id,
    responseId,
    showToast,
    subjectNationId,
    templateId,
    user?.id,
  ]);

  const handleAssetUpload = async (field, file) => {
    const ensuredResponseId = await ensureDraftResponse();
    if (!ensuredResponseId) {
      return;
    }
    try {
      const asset = await formsApi.uploadResponseAsset(ensuredResponseId, {
        fieldId: field.id,
        assetType: field.type === 'signature_image' ? 'signature' : 'drawing',
        file,
      });
      const nextValue = {
        asset_id: asset.id,
        asset_type: asset.asset_type,
        file_name: file.name,
        mime_type: asset.mime_type,
        uploaded_at: asset.created_at,
      };
      setAnswers(prev => ({ ...prev, [field.id]: nextValue }));
      showToast('圖片已儲存', 'success');
    } catch (error) {
      console.error('Failed to upload questionnaire asset:', error);
      showToast('圖片儲存失敗: ' + error.message, 'error');
      throw error;
    }
  };

  const handleAssetClear = async (field, assetId) => {
    const activeResponseId = response?.id || responseId;
    if (!activeResponseId || !assetId || isReadOnly) return;
    try {
      await formsApi.deleteResponseAsset(activeResponseId, assetId);
      setAnswers(prev => {
        const nextAnswers = { ...prev };
        delete nextAnswers[field.id];
        return nextAnswers;
      });
      showToast('圖片已移除', 'success');
    } catch (error) {
      console.error('Failed to delete questionnaire asset:', error);
      showToast('移除圖片失敗: ' + error.message, 'error');
    }
  };

  const handleQueryUpdated = (updatedQuery) => {
    setResponse(prev => {
      if (!prev) return prev;
      const currentQueries = Array.isArray(prev.validation_queries) ? prev.validation_queries : [];
      const hasQuery = currentQueries.some(query => query.id === updatedQuery.id);
      const nextQueries = hasQuery
        ? currentQueries.map(query => (query.id === updatedQuery.id ? updatedQuery : query))
        : [...currentQueries, updatedQuery];
      return {
        ...prev,
        validation_queries: nextQueries,
        open_query_count: nextQueries.filter(query => query.status === 'open').length,
      };
    });
  };

  const handleClearAnswers = async () => {
    if (isReadOnly) return;
    const confirmed = await requestConfirm('確定要清除本問卷目前所有填答內容嗎？草稿紀錄會保留。', '清除本問卷');
    if (!confirmed) return;
    setAnswers({});
    showToast('已清除本問卷填答內容', 'success');
  };

  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (
      !hasLoadedRef.current
      || loading
      || isReadOnly
      || activeResponseId
      || !questionnaireHasAssetFields
      || !subjectNationId
      || !isOnline
    ) {
      return;
    }

    ensureDraftResponse();
  }, [
    activeResponseId,
    ensureDraftResponse,
    isOnline,
    isReadOnly,
    loading,
    questionnaireHasAssetFields,
    subjectNationId,
  ]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current || loading || isReadOnly) return undefined;

    const savedAt = new Date().toISOString();
    writeLocalDraft(draftStorageKey, {
      response_id: responseId || response?.id || null,
      template_id: Number(templateId),
      patient_id: Number(id),
      subject_nation_id: subjectNationId,
      answers_json: answers,
      saved_at: savedAt,
    });
    setLastAutosavedAt(savedAt);

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return undefined;
    }

    if (!subjectNationId) {
      setAutosaveStatus('local_only');
      return undefined;
    }

    if (!isOnline) {
      setAutosaveStatus('offline');
      return undefined;
    }

    setAutosaveStatus('pending');
    const timer = window.setTimeout(async () => {
      try {
        const payload = buildPayload(latestAnswersRef.current);
        const savedResponse = activeResponseId
          ? await formsApi.updateDraft(activeResponseId, payload, { suppressAuthRedirect: true })
          : await formsApi.saveDraft(templateId, payload, { suppressAuthRedirect: true });
        setResponse(savedResponse);
        setAutosaveStatus('saved');
        setLastAutosavedAt(new Date().toISOString());
        if (!activeResponseId && savedResponse.id) {
          const nextKey = getDraftStorageKey({
            responseId: savedResponse.id,
            patientId: id,
            templateId,
            userId: user?.id,
          });
          writeLocalDraft(nextKey, {
            response_id: savedResponse.id,
            template_id: Number(templateId),
            patient_id: Number(id),
            subject_nation_id: subjectNationId,
            answers_json: latestAnswersRef.current,
            saved_at: new Date().toISOString(),
          });
          removeLocalDraft(draftStorageKey);
        }
      } catch (error) {
        console.error('Failed to autosave questionnaire draft:', error);
        setAutosaveStatus(navigator.onLine ? 'error' : 'offline');
      }
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    answers,
    activeResponseId,
    buildPayload,
    draftStorageKey,
    id,
    isOnline,
    isReadOnly,
    loading,
    response?.id,
    responseId,
    subjectNationId,
    templateId,
    user?.id,
  ]);

  useEffect(() => {
    if (isOnline && autosaveStatus === 'offline') {
      setAutosaveStatus('pending');
      setAnswers(prev => ({ ...prev }));
    }
  }, [autosaveStatus, isOnline]);

  const validateBeforeSave = () => {
    if (!subjectNationId) {
      showToast('此個案尚未填寫身分/代碼，請先回個案資料補上 nation_id', 'error');
      return false;
    }

    const missingFields = getQuestionnaireFields(questionnaire).filter(field => (
      field.required && isEmptyValue(answers[field.id])
    ));

    if (missingFields.length > 0) {
      showToast(`請完成必填欄位：${missingFields[0].label || missingFields[0].id}`, 'error');
      return false;
    }

    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateBeforeSave() || isReadOnly) return;

    setIsSaving(true);
    try {
      const currentResponseId = response?.id || responseId;
      const savedResponse = currentResponseId
        ? await formsApi.updateDraft(currentResponseId, buildPayload())
        : await formsApi.saveDraft(templateId, buildPayload());
      setResponse(savedResponse);
      setAnswers(savedResponse.answers_json || answers);
      removeLocalDraft(draftStorageKey);
      showToast('草稿已儲存', 'success');
      if (!responseId && savedResponse.id) {
        navigate(`/patients/${id}/questionnaires/${templateId}/fill?responseId=${savedResponse.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      showToast('儲存草稿失敗: ' + error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateBeforeSave() || isReadOnly) return;

    const confirmed = await requestConfirm(
      isSubmitted ? '這會更新已送出問卷的正式內容、評分與資料檢核結果，確定要儲存更新嗎？' : '送出後會成為正式問卷回覆，確定要送出嗎？',
      isSubmitted ? '確認更新已送出問卷' : '確認送出問卷'
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const currentResponseId = response?.id || responseId;
      const submittedResponse = currentResponseId
        ? await formsApi.submitExistingResponse(currentResponseId, buildPayload())
        : await formsApi.submitResponse(templateId, buildPayload());
      setResponse(submittedResponse);
      setAnswers(submittedResponse.answers_json || answers);
      removeLocalDraft(draftStorageKey);
      showToast(isSubmitted ? '已送出問卷已更新' : '問卷已送出', 'success');
      navigate(`/patients/${id}?tab=health`);
    } catch (error) {
      console.error('Failed to submit questionnaire:', error);
      showToast('送出問卷失敗: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadXlsx = async () => {
    if (!isSubmitted || !response?.id) {
      showToast('只有已送出的問卷可以下載 XLSX', 'error');
      return;
    }

    try {
      const blob = await formsApi.downloadResponseXlsx(response.id);
      downloadBlob(blob, buildQuestionnaireXlsxFilename({
        subjectName: patient?.display_name,
        subjectNationId,
        templateTitle: questionnaire?.title || `問卷_${templateId}`,
        submittedAt: response.submitted_at,
      }));
    } catch (error) {
      console.error('Failed to download questionnaire xlsx:', error);
      showToast('下載問卷 XLSX 失敗: ' + error.message, 'error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!response?.id) {
      showToast('請先儲存草稿或載入既有問卷紀錄', 'error');
      return;
    }

    try {
      const blob = await formsApi.downloadResponsePdf(response.id);
      downloadBlob(blob, `${patient?.display_name || '個案'}_${questionnaire?.title || `問卷_${templateId}`}_${response.id}.pdf`);
    } catch (error) {
      console.error('Failed to download questionnaire pdf:', error);
      showToast('下載問卷 PDF 失敗: ' + error.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-primary">
        <Loader2 size={40} className="animate-spin" />
        <p className="font-medium">載入問卷中...</p>
      </div>
    );
  }

  if (!patient || !questionnaire) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-text/60">找不到問卷或個案資料</h2>
        <button
          type="button"
          onClick={() => navigate(`/patients/${id}`)}
          className="mt-4 font-bold text-primary hover:underline"
        >
          返回個案
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => navigate(`/patients/${id}?tab=health`)}
          className="rounded-xl p-2 text-text/60 transition-colors hover:bg-white/70 hover:text-primary"
          aria-label="返回個案問卷"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-bold text-primary">
              {questionnaire.category || '未分類'}
            </span>
            {questionnaire.sequence_group && (
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-xs font-bold text-text/50">
                {questionnaire.sequence_group}
              </span>
            )}
            {isSubmitted && (
              <span className="rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                已送出
              </span>
            )}
            {isArchived && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                已封存
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-primary">{questionnaire.title}</h2>
          <p className="mt-1 text-sm text-text/55">
            填寫對象：{patient.display_name} / {subjectNationId || '尚未設定個案代碼'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm sm:grid-cols-3">
        {responseMeta.map(item => (
          <div key={item.label} className="rounded-xl bg-sky-50/60 p-3">
            <p className="text-xs font-bold text-text/40">{item.label}</p>
            <p className="mt-1 text-sm font-bold text-text/75">{item.value}</p>
          </div>
        ))}
      </div>

      {!subjectNationId && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          此個案尚未填寫身分/代碼，無法儲存或送出問卷。請先返回個案資料補上身分/代碼。
        </div>
      )}

      {!isReadOnly && (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${autosaveMeta.className}`}>
          {autosaveMeta.icon}
          <span>{autosaveMeta.text}</span>
        </div>
      )}

      <QuestionnaireFormRenderer
        questionnaire={questionnaire}
        answers={answers}
        disabled={isReadOnly}
        responseId={response?.id || responseId}
        isPreparingResponse={isEnsuringDraft}
        onAssetUpload={handleAssetUpload}
        onAssetClear={handleAssetClear}
        onAnswerChange={handleAnswerChange}
      />

      <ScoreSummary
        questionnaire={questionnaire}
        scoreJson={response?.score_json}
        assessmentResultJson={response?.assessment_result_json}
      />

      <ValidationQuerySummary
        queries={response?.validation_queries}
        onUpdateQuery={handleQueryUpdated}
        showToast={showToast}
      />

      <div className="sticky bottom-4 z-20 rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-text/50">
            {isReadOnly ? <FileText size={17} /> : autosaveMeta.icon}
            {isArchived ? '此問卷已封存，需還原後才能編輯' : isSubmitted ? '已送出問卷仍可編輯，更新後請再次正式送出' : '可先儲存草稿，確認後再正式送出'}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {response?.id && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-sky-100"
              >
                <Download size={17} />
                下載 PDF
              </button>
            )}
            {isSubmitted && (
              <button
                type="button"
                onClick={handleDownloadXlsx}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-green-100 bg-green-50 px-5 py-2.5 text-sm font-bold text-green-700 transition-colors hover:bg-green-100"
              >
                <Download size={17} />
                下載 XLSX
              </button>
            )}
            {canEditResponse && (
              <button
                type="button"
                onClick={handleClearAnswers}
                disabled={isSaving || isSubmitting || isReadOnly || !hasAnyAnswer}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eraser size={17} />
                清除本問卷
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting || isReadOnly || !subjectNationId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {isSubmitted ? '儲存更新' : '儲存草稿'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || isSubmitting || isReadOnly || !subjectNationId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              {isSubmitted ? '更新送出' : '正式送出'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireFill;
