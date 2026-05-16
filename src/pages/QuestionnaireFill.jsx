import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, FileText, Loader2, Save, Send } from 'lucide-react';
import QuestionnaireFormRenderer from '../components/QuestionnaireFormRenderer';
import { getQuestionnaireFields } from '../utils/questionnaire';
import { formsApi } from '../api/forms';
import { managementApi } from '../api/management';
import { useToast } from '../context/useToast';
import { useAuth } from '../context/useAuth';

const getTodayString = () => new Date().toISOString().slice(0, 10);

const isEmptyValue = (value) => value === undefined || value === null || value === '';

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

const JsonSummary = ({ title, data }) => {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-green-800">
        <CheckCircle size={17} />
        {title}
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-relaxed text-text/70">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
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

  const isSubmitted = response?.status === 'submitted';
  const canEditResponse = !response || isAdmin || response.filled_by_user_id === user?.id;
  const isReadOnly = isSubmitted || !canEditResponse;
  const subjectNationId = patient?.details?.nation_id?.trim();

  const responseMeta = useMemo(() => ([
    { label: '狀態', value: isSubmitted ? '已送出' : '草稿' },
    { label: '建立時間', value: formatDateTime(response?.created_at) },
    { label: '更新時間', value: formatDateTime(response?.updated_at) },
  ]), [isSubmitted, response]);

  const loadQuestionnaire = useCallback(async () => {
    setLoading(true);
    try {
      const [patientData, questionnaireData, responseData] = await Promise.all([
        managementApi.getPatientDetail(id),
        formsApi.getQuestionnaire(templateId),
        responseId ? formsApi.getResponse(responseId) : Promise.resolve(null),
      ]);

      setPatient(patientData);
      setQuestionnaire(questionnaireData);
      setResponse(responseData);
      setAnswers(buildInitialAnswers(questionnaireData, patientData, responseData));
    } catch (error) {
      console.error('Failed to load questionnaire:', error);
      showToast('載入問卷失敗: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, responseId, showToast, templateId]);

  useEffect(() => {
    loadQuestionnaire();
  }, [loadQuestionnaire]);

  const handleAnswerChange = (fieldId, value) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const buildPayload = () => ({
    subject_nation_id: subjectNationId,
    subject_backend_user_id: Number(id),
    answers_json: answers,
  });

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
      showToast('問卷已送出', 'success');
      navigate(`/patients/${id}?tab=health`);
    } catch (error) {
      console.error('Failed to submit questionnaire:', error);
      showToast('送出問卷失敗: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
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

      <QuestionnaireFormRenderer
        questionnaire={questionnaire}
        answers={answers}
        disabled={isReadOnly}
        onAnswerChange={handleAnswerChange}
      />

      <JsonSummary title="評分結果" data={response?.score_json} />
      <JsonSummary title="評估結果" data={response?.assessment_result_json} />

      <div className="sticky bottom-4 z-20 rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-text/50">
            <FileText size={17} />
            {isSubmitted ? '此問卷已送出，內容僅供檢視' : canEditResponse ? '可先儲存草稿，確認後再正式送出' : '此草稿由其他個管師派發，內容僅供檢視'}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
