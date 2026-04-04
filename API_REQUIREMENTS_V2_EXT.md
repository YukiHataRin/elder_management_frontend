# Elderly Care API V2 - 管理端功能擴充需求書 (Management User Extension)

## 1. 背景說明
目前 Elderly Care API V2 的 `Management User` 模組僅提供基本角色變更。為了讓個案管理師 (Case Manager) 能有效追蹤病患的健康進度，管理端需要具備「編輯病患完整資訊」、「重設密碼」以及「檢視任務執行進度與回傳檔案」的功能。

---

## 2. 需求一：完全編輯使用者資訊 (Update User Full Info)

建議在 `Management User (V2)` 分類下新增以下端點。

- **端點 (Endpoint)**: `/management/users/{user_id}`
- **方法 (Method)**: `PUT`
- **權限控制 (Security)**: `OAuth2PasswordBearer` (Role 1 & 2)
- **功能描述**: 
    - 允許管理員修正病患的基本資料（姓名、生日、身分證號、電話、地址）。
    - 支持 **`password`** 欄位：若有傳入值，則強制更新該使用者的登入密碼（需進行 Hash 處理）。
    - 支持 **`points`** 欄位：手動校正或發放長照幣。
    - 支持 **`sarcopenia_level`** 欄位：更新肌少症評估等級。

---

## 3. 需求二：檢視個案任務執行紀錄 (Read User Mission Logs)

目前任務執行紀錄 (`MissionLog`) 僅開放給 App 端本人讀取，管理端缺乏監控手段。

- **端點 (Endpoint)**: `/management/users/{user_id}/mission-logs`
- **方法 (Method)**: `GET`
- **權限控制 (Security)**: `OAuth2PasswordBearer` (Role 1 & 2)
- **功能描述**: 
    - 獲取特定病患的所有任務執行紀錄（包含進行中、已完成、已評分）。
    - **越權防護**: 個管師僅能讀取其負責之病患紀錄。

### 回傳資料規範 (Response Structure)
回傳應為 `List[MissionLog]`，且每個 `MissionLog` 物件應包含：
1. **任務基本資訊**: `mission_id`, `mission_name`。
2. **執行狀態**: `mission_status_id` (1:未開始, 2:進行中, 3:已完成)。
3. **評分與時間**: `score`, `assigned_at`, `updated_at`。
4. **關鍵功能 - 回傳檔案 (`returns`)**: 
    - 應巢狀包含該次任務指派中，病患所上傳的所有檔案紀錄 (`MissionReturn`)。
    - 需包含檔案的 **下載 URL**、檔案類型、以及上傳時間。

---

## 4. 建議之 Schema 擴充 (Pydantic 範例)

```python
class MissionLogWithReturns(MissionLog):
    mission: Mission
    returns: List[MissionReturn]  # 包含病患上傳的圖片、影片、語音等資產
```

---

## 5. 預期功能情境
1. **線上審核**: 病患在家中完成「舉水瓶運動」並上傳影片後，個管師可透過此 API 下載影片觀看，確認動作是否標準，並給予評分。
2. **進度追蹤**: 管理員可查看病患本週被指派的 5 項任務中，完成了哪幾項，以及每項任務的得分情況。
3. **個資維護**: 當長者遺失密碼或搬家時，管理員可迅速透過 `PUT` 接口協助更新。

---
**文件日期**: 2026-03-22
**版本**: V2 Extension Requirement - Rev.1
