import { apiFetch } from './client';

export const managementApi = {
  // --- 使用者管理 ---

  // 獲取病患清單 (V2: /management/users)
  getPatients: () => apiFetch('/management/users'),

  // 建立新使用者 (V2: /management/users)
  createUser: (data) => apiFetch('/management/users', {
    method: 'POST',
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

  // (超級管理員限定) 審核帳號或更新角色 (V2: /management/users/{user_id}/role)
  updateUserRole: (userId, data) => apiFetch(`/management/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(data),
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

  // --- 任務管理 (V2 New) ---

  // 取得所有任務清單
  getMissions: () => apiFetch('/management/missions'),

  // 建立新任務
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

  // 取得所有任務與資產的關聯列表
  getMissionDataRelations: () => apiFetch('/management/missions/data'),

  // 將資料資產與任務建立連結
  createMissionDataRelation: (data) => apiFetch('/management/missions/data', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 刪除特定任務與資產的連結
  deleteMissionDataRelation: (missionId, assetId) => 
    apiFetch(`/management/missions/data/mission/${missionId}/data/${assetId}`, {
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
