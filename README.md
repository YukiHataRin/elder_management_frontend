<div align="center">

# 🏥 Health Task Manager (HTM)
### 專業長者健康任務管理平台 — 管理端系統 v2.0

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-V2_Integration-orange?style=for-the-badge)

---

<p align="center">
  <b>Elderly Care 生態系的核心組件</b><br />
  專為超級管理員與個案管理師打造，實現精準的長者健康監控與任務分派。
</p>

[✨ 功能特色](#-功能特色) • [🚀 快速開始](#-快速開始) • [📡 API 規範](#-api-規範) • [📝 擴充需求](#-擴充需求)

</div>

---

## 📖 專案簡介
**Health Task Manager (HTM)** 是 Elderly Care 平台後台管理系統。本系統採用最新的 **React 18** 與 **Vite** 構建，並深度整合 **V2 API** 規格。透過直觀的儀表板，管理者可以輕鬆追蹤病患的肌少症等級、活動紀錄及長照幣點數。

## ✨ 功能特色

### 核心管理能力
*   **🔐 V2 權限體系**: 基於 OAuth2 的角色存取控制 (RBAC)，區分 Admin 與 Case Manager 權限。
*   **📂 個案全方位監控**: 從基本資料、身分證號到精準的肌少症分級追蹤。
*   **🛠️ 任務指派引擎**: 支援社會心理、物理治療、口腔保健等多領域任務分派。
*   **💰 遊戲化獎勵管理**: 實時管理個案點數 (長照幣) 累積狀況。

### 介面設計亮點
*   **Responsive UI**: 完美適配平板與桌面端，方便在機構內隨處使用。
*   **Clean Architecture**: 模組化 API 封裝，易於維護與擴充。

## 🛠️ 技術棧
| 分類 | 技術 |
| :--- | :--- |
| **前端框架** | React 18 (Hooks) |
| **構建工具** | Vite + HMR |
| **樣式處理** | Tailwind CSS (JIT mode) |
| **圖標庫** | Lucide React |
| **API 請求** | Fetch (Scoped Interface) |
| **狀態管理** | React Context API |

## 📡 API 規範 (V2)
本專案嚴格遵守 V2 API 架構：
*   **Base URL**: `https://api.eldercare.fclinlab.com/api/v2`
*   **核心配置**: 位於 `src/api/client.js`
*   **方法定義**: 詳見 `src/api/management.js`

## 📝 擴充需求
目前的 V2 實作已完成階段性開發，關於「個案資料完全編輯」與「回傳檔案檢視」等進階需求，請參閱：
👉 **[API_REQUIREMENTS_V2_EXT.md](./API_REQUIREMENTS_V2_EXT.md)**

## 🚀 快速開始

### 1. 安裝環境
```bash
git clone https://github.com/YukiHataRin/elder_management_frontend.git
cd elder_management_frontend
npm install
```

### 2. 開發模式
```bash
npm run dev
```

---

## 📅 版本紀錄
*   **v2.0.0** (2026-03-22): 全面升級 V2 API，修正所有管理端 Endpoints。
*   **v1.0.0**: 初始概念驗證版本。

## 👥 維護者
**YukiHataRin**  
📧 Email: [howard920529@gmail.com](mailto:howard920529@gmail.com)  
🔗 GitHub: [@YukiHataRin](https://github.com/YukiHataRin)

---
<div align="center">
  Developed with ❤️ for Elderly Care Project.
</div>
