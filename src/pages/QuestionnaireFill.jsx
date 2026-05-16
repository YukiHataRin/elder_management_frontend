import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Cloud, CloudOff, Download, FileText, Loader2, Save, Send } from 'lucide-react';
import QuestionnaireFormRenderer from '../components/QuestionnaireFormRenderer';
import { getQuestionnaireFields } from '../utils/questionnaire';
import { downloadBlob, sanitizeFilename } from '../utils/download';
import { formsApi } from '../api/forms';
import { managementApi } from '../api/management';
import { useToast } from '../context/useToast';
import { useAuth } from '../context/useAuth';

const getTodayString = () => new Date().toISOString().slice(0, 10);

const isEmptyValue = (value) => value === undefined || value === null || value === '';

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
  if (Object.keys(existingAnswers).length > 0) return existingAnswers;

  const fields = getQuestionnaireFields(questionnaire);
  const details = patient?.details || {};
  const nextAnswers = {};

  fields.forEach(field => {
    if (field.id === 'subject_code' && details.nation_id) {
      nextAnswers[field.id] = details.nation_id;
    }
    if (field.id === 'assessment_date') {
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

const ScoreSummary = ({ questionnaire, scoreJson, assessmentResultJson }) => {
  const hasScore = scoreJson && Object.keys(scoreJson).length > 0;
  const hasAssessment = assessmentResultJson && Object.keys(assessmentResultJson).length > 0;
  if (!hasScore && !hasAssessment) return null;

  const fields = getQuestionnaireFields(questionnaire);
  const fieldLabels = Object.fromEntries(fields.map(field => [field.id, field.label || field.id]));
  const totalScore = formatScoreValue(scoreJson?.total_score);
  const interpretation = scoreJson?.interpretation || assessmentResultJson?.summary || assessmentResultJson?.interpretation;
  const fieldScores = Array.isArray(scoreJson?.fields) ? scoreJson.fields : [];

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
        {interpretation && (
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-bold text-text/45">判讀</p>
            <p className="mt-1 text-lg font-bold text-green-800">{interpretation}</p>
          </div>
        )}
      </div>
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
  const { isAdmin, user } = useAuth();
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

  const isSubmitted = response?.status === 'submitted';
  const canEditResponse = !response || isAdmin || response.filled_by_user_id === user?.id;
  const isReadOnly = isSubmitted || !canEditResponse;
  const subjectNationId = patient?.details?.nation_id?.trim();
  const draftStorageKey = useMemo(() => getDraftStorageKey({
    responseId,
    patientId: id,
    templateId,
    userId: user?.id,
  }), [id, responseId, templateId, user?.id]);

  const responseMeta = useMemo(() => ([
    { label: '狀態', value: isSubmitted ? '已送出' : '草稿' },
    { label: '建立時間', value: formatDateTime(response?.created_at) },
    { label: '更新時間', value: formatDateTime(response?.updated_at) },
  ]), [isSubmitted, response]);
  const autosaveMeta = getAutosaveMeta(autosaveStatus, isOnline, lastAutosavedAt);

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

  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

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
        const savedResponse = responseId
          ? await formsApi.updateDraft(responseId, payload)
          : await formsApi.saveDraft(templateId, payload);
        setResponse(savedResponse);
        setAutosaveStatus('saved');
        setLastAutosavedAt(new Date().toISOString());
        if (!responseId && savedResponse.id) {
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
          navigate(`/patients/${id}/questionnaires/${templateId}/fill?responseId=${savedResponse.id}`, { replace: true });
        }
      } catch (error) {
        console.error('Failed to autosave questionnaire draft:', error);
        setAutosaveStatus(navigator.onLine ? 'error' : 'offline');
      }
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    answers,
    buildPayload,
    draftStorageKey,
    id,
    isOnline,
    isReadOnly,
    loading,
    navigate,
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
      const savedResponse = responseId
        ? await formsApi.updateDraft(responseId, buildPayload())
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

    const confirmed = await requestConfirm('送出後會成為正式問卷回覆，確定要送出嗎？', '確認送出問卷');
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const submittedResponse = responseId
        ? await formsApi.submitExistingResponse(responseId, buildPayload())
        : await formsApi.submitResponse(templateId, buildPayload());
      setResponse(submittedResponse);
      setAnswers(submittedResponse.answers_json || answers);
      removeLocalDraft(draftStorageKey);
      showToast('問卷已送出', 'success');
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
      const templateTitle = questionnaire?.title || `問卷_${templateId}`;
      downloadBlob(blob, `${sanitizeFilename(templateTitle)}_回覆${response.id}.xlsx`);
    } catch (error) {
      console.error('Failed to download questionnaire xlsx:', error);
      showToast('下載問卷 XLSX 失敗: ' + error.message, 'error');
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
        onAnswerChange={handleAnswerChange}
      />

      <ScoreSummary
        questionnaire={questionnaire}
        scoreJson={response?.score_json}
        assessmentResultJson={response?.assessment_result_json}
      />

      <div className="sticky bottom-4 z-20 rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-text/50">
            {isReadOnly ? <FileText size={17} /> : autosaveMeta.icon}
            {isSubmitted ? '此問卷已送出，內容僅供檢視' : canEditResponse ? '可先儲存草稿，確認後再正式送出' : '此草稿由其他個管師派發，內容僅供檢視'}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting || isReadOnly || !subjectNationId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              儲存草稿
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || isSubmitting || isReadOnly || !subjectNationId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              正式送出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireFill;
