# Health Task Manager - 長者健康管理後台系統 (V2)

## 📌 專案概述
本專案為 **Elderly Care (長者照護)** 的管理端前端系統，旨在提供超級管理員 (Admin) 與個案管理師 (Case Manager) 一個直觀、高效的介面，用以管理長者的健康狀態、指派運動/社交任務，並追蹤執行進度。

專案已全面升級至 **API V2** 架構，具備更完善的權限控制與模組化設計。

---

## 🚀 技術棧 (Tech Stack)
*   **Framework**: [React](https://reactjs.org/) (Vite)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Routing**: React Router v6
*   **API Client**: Fetch API (封裝於 `src/api/client.js`)
*   **State Management**: React Context (AuthContext, ToastContext)

---

## 🛠️ 主要功能模組
*   **🔐 認證系統 (Auth)**: 支援 V2 OAuth2 登入流，具備角色權限分級 (Admin/Manager)。
*   **📋 個案管理 (Patient List)**: 全方位查看所有受指派的長者清單、肌少症等級與健康進度。
*   **👤 個案詳情 (Patient Detail)**: 檢視特定長者的詳細背景、電話、地址、長照幣點數及執行紀錄。
*   **🎯 任務庫管理 (Task Manager)**: 管理社會心理、肌少症、口腔保健等多元健康任務庫。
*   **⚖️ 權限與帳號管理 (Backend Management)**: 超級管理員專用介面，進行個管師帳號審核與權限變更。
*   **🎮 遊戲化元素 (Gamification)**: 查看與管理長者的積分與獎勵進度。

---

## 📡 API 整合說明 (V2)
專案已對接最新的 **Elderly Care API V2**，所有端點位於 `/api/v2` 下。

### 核心 API 文件：
*   `src/api/client.js`: 基礎 API 配置與 Token 處理。
*   `src/api/management.js`: 包含使用者管理、任務指派、權限變更等所有後台 API 方法。
*   `openapi.json`: 完整的後端 API 規格文件。

---

## 📝 當前開發狀態與未來擴充
目前專案已完成基礎 V2 架構建置，後續功能擴充需求請參考：
👉 [API_REQUIREMENTS_V2_EXT.md](./API_REQUIREMENTS_V2_EXT.md)

### 待實作功能 (Roadmap)：
1.  **個案資料完整編輯**: 包含重設密碼功能 (待後端 API 提供)。
2.  **任務執行紀錄回傳**: 檢視病患上傳的教學影片/照片紀錄。
3.  **個資統計圖表**: 視覺化呈現肌少症等級的分佈趨勢。

---

## 📦 如何開始
1.  **安裝依賴**:
    ```bash
    npm install
    ```
2.  **啟動開發環境**:
    ```bash
    npm run dev
    ```
3.  **建立生產版本**:
    ```bash
    npm run build
    ```

---

## 📅 版本紀錄
*   **v2.0.0 (2026-03-22)**: 全面升級 V2 API，重新設計 `managementApi` 結構，修復所有頁面之 API Endpoint。
*   **v1.x**: 初始原型開發 (已淘汰)。

---
**維護者**: YukiHataRin  
**聯繫方式**: howard920529@gmail.com
