import { apiFetch, apiFetchBlob } from './client';

export const managementApi = {
  // --- 使用者管理 ---

  // 獲取病患清單 (V2: /management/users)
  getPatients: () => apiFetch('/management/users'),

  // 建立新使用者 (V2: /management/users)
  createUser: (data) => apiFetch('/management/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新使用者資料 (V2 New: /management/users/{user_id})
  // 用於更新姓名、顯示名稱、密碼或詳細資料
  updateUser: (userId, data) => apiFetch(`/management/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 刪除使用者 (V2: /management/users/{user_id})
  deleteUser: (userId) => apiFetch(`/management/users/${userId}`, {
    method: 'DELETE',
  }),

  // 獲取特定使用者詳情 (V2: /management/users/{user_id})
  getPatientDetail: (userId) => apiFetch(`/management/users/${userId}`),

  // (超級管理員限定) 獲取所有後端帳號清單 (V2: /management/backend)
  getBackendUsers: (roleId) => {
    const query = roleId ? `?role_id=${roleId}` : '';
    return apiFetch(`/management/backend${query}`);
  },

  // (超級管理員限定) 審核帳號或更新角色 (V2 Update: /management/users/{user_id}/role?role_in={id})
  // 最新規範：role_id 改為 query parameter 傳遞
  updateUserRole: (userId, roleId) => apiFetch(`/management/users/${userId}/role?role_in=${roleId}`, {
    method: 'PATCH',
  }),

  // (超級管理員限定) 將使用者分配給特定的個管師 (V2: /management/assign)
  assignUser: (data) => apiFetch('/management/assign', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // (超級管理員限定) 解除使用者與個管師的分配關係 (V2: /management/unassign)
  unassignUser: (data) => apiFetch('/management/unassign', {
    method: 'DELETE',
    body: JSON.stringify(data),
  }),

  // (超級管理員限定) 查詢特定個管師負責的所有使用者 (V2: /management/manager-assigned/{manager_id})
  getManagerAssignedUsers: (managerId) => apiFetch(`/management/manager-assigned/${managerId}`),

  // --- 資產管理 (Assets - Shared V2) ---

  // 上傳衛教教材 (V2: /assets/)
  createAsset: (formData) => apiFetch('/assets/', {
    method: 'POST',
    body: formData,
  }),

  // 查看/下載資產 (V2: /assets/{asset_id})
  getAsset: (assetId) => apiFetch(`/assets/${assetId}`),

  // 刪除資產檔案 (V2: /assets/{asset_id})
  deleteAsset: (assetId) => apiFetch(`/assets/${assetId}`, {
    method: 'DELETE',
  }),

  // --- 任務管理 (V2) ---

  // 取得實體檔案並以 Blob 格式回傳
  getAssetFile: (urlIn) => apiFetchBlob(`/assets/url/${encodeURIComponent(urlIn)}`),


  // 取得所有任務清單
  getMissions: () => apiFetch('/management/missions'),

  // 建立新任務 (V2: 可包含 return_types 要求)
  createMission: (data) => apiFetch('/management/missions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新任務內容
  updateMission: (missionId, data) => apiFetch(`/management/missions/${missionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 刪除任務
  deleteMission: (missionId) => apiFetch(`/management/missions/${missionId}`, {
    method: 'DELETE',
  }),

  // 取得所有任務指派清單 (MissionList)
  getMissionsElective: () => apiFetch('/management/missions/elective'),

  // 指派任務給使用者 (MissionList)
  assignMission: (data) => apiFetch('/management/missions/elective', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新任務指派屬性 (例如: 是否必修)
  updateMissionElective: (missionId, userId, isCompulsory) =>
    apiFetch(`/management/missions/elective/mission/${missionId}/user/${userId}?is_compulsory=${isCompulsory}`, {
      method: 'PUT',
    }),

  // 刪除特定使用者的任務指派紀錄
  deleteMissionElective: (missionId, userId) =>
    apiFetch(`/management/missions/elective/mission/${missionId}/user/${userId}`, {
      method: 'DELETE',
    }),

  // 放行指派必修任務時，自動代替使用者建立起始任務日誌狀態
  createMissionLogForUser: (missionId, userId) =>
    apiFetch(`/management/missions/elective/mission/${missionId}/user/${userId}/logs`, {
      method: 'POST',
    }),

  // --- 任務執行監看 (V2 New) ---

  // 取得特定病患任務執行日誌 (查看病患是否完成、評分等)
  getMissionLogs: (userId) => apiFetch(`/management/missions/logs/users/${userId}`),

  // 取得特定病患回傳的成果檔案 (查看照片、影片成果)
  getMissionReturns: (userId) => apiFetch(`/management/missions/logs/data/users/${userId}`),

  // 取的所有可用成果回傳的檔案類型字典
  getFileTypes: () => apiFetch(`/management/missions/logs/data/types`),

  // --- 任務資產與類型綁定關聯 ---

  // 取得所有任務與資產的關聯列表
  getMissionDataRelations: () => apiFetch('/management/missions/data'),

  // 將資料資產與任務建立連結 (教學任務影片/圖片)
  createMissionDataRelation: (data) => apiFetch('/management/missions/data', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 刪除特定任務與資產的連結
  deleteMissionDataRelation: (missionId, assetId) =>
    apiFetch(`/management/missions/data/mission/${missionId}/data/${assetId}`, {
      method: 'DELETE',
    }),

  // 取得所有任務與允許的檔案類型拘束列表
  getMissionReturnTypeRelations: () => apiFetch('/management/missions/data/type'),

  // 為特定任務綁定允許提交的檔案類型
  createMissionReturnTypeRelation: (data) => apiFetch('/management/missions/data/type', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 放棄特定任務綁定的特定檔案類型拘束
  deleteMissionReturnTypeRelation: (missionId, fileTypeId) =>
    apiFetch(`/management/missions/data/mission/${missionId}/type/${fileTypeId}`, {
      method: 'DELETE',
    }),
};

export const authApi = {
  login: async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    // V2 登入路徑: /auth/login
    const response = await fetch('https://api.eldercare.fclinlab.com/api/v2/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Login failed');
    }

    return response.json();
  },

  // V2 User Info: /app/me
  getMe: () => apiFetch('/app/me'),
};
