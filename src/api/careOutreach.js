import { apiFetch, apiFetchBlob } from './client';

export const CARE_OUTREACH_SOURCE_LABELS = Object.freeze({
  ai_safety: 'AI 安全警示',
  questionnaire_validation: '問卷資料檢核',
  questionnaire_query: '問卷資料檢核',
  questionnaire: '問卷資料檢核',
  mission_usage: '任務完成率偏低',
  gps_inactivity: 'GPS 活動不足',
  app_activity: '長期未使用 APP',
  manual_outreach: '人工建立',
});

export const CARE_OUTREACH_REASON_LABELS = Object.freeze({
  technical_problem: '技術問題',
  forgot_password: '忘記密碼',
  cannot_operate: '不會操作',
  cannot_find_app: '找不到 APP',
  update_changed_ui: '更新後介面改變',
  device_problem: '裝置問題',
  health_condition: '健康因素',
  hospitalized: '住院',
  family_matter: '家庭因素',
  low_motivation: '動機較低',
  does_not_see_benefit: '不清楚使用效益',
  does_not_understand_purpose: '不清楚計畫目的',
  ai_concern: 'AI 對話關懷',
  questionnaire_concern: '問卷資料確認',
  other: '其他',
});

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    if (Array.isArray(value) && value.length === 0) return;
    query.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  const rendered = query.toString();
  return rendered ? `?${rendered}` : '';
};

export const careOutreachApi = {
  getCases: ({
    search = '',
    status = '',
    severity = '',
    source = '',
    overdue = false,
    page = 1,
    pageSize = 20,
    signal,
  } = {}) => apiFetch(`/management/care-outreach/cases${buildQuery({
    search,
    status,
    severity,
    trigger_type: source,
    overdue,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })}`, { signal }),

  getCase: (caseId, { signal } = {}) => apiFetch(`/management/care-outreach/cases/${caseId}`, { signal }),

  createCase: (data) => apiFetch('/management/care-outreach/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateCase: (caseId, data) => apiFetch(`/management/care-outreach/cases/${caseId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  addContact: (caseId, data) => apiFetch(`/management/care-outreach/cases/${caseId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getGpsProfile: (subjectId, { signal } = {}) => apiFetch(`/management/care-outreach/gps-profiles/${subjectId}`, { signal }),

  saveGpsProfile: (subjectId, data) => apiFetch(`/management/care-outreach/gps-profiles/${subjectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  exportCases: (params = {}) => apiFetchBlob(`/management/care-outreach/cases/export${buildQuery({
    ...params,
    trigger_type: params.source,
    source: undefined,
  })}`),
};
