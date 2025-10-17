# Claude Code History Viewer

一款用於瀏覽儲存在 `~/.claude` 中的 Claude Code 對話記錄的跨平台桌面應用程式。

![Version](https://img.shields.io/badge/Version-1.1.3-blue.svg)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md) | [Русский](README.ru.md)

> ⚠️ **測試版軟體** - 可能存在不穩定或變更。如發現問題請在 [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues) 上回報。

## 開發緣由

Claude Code 將對話記錄儲存在 `~/.claude/projects/` 資料夾中的 JSONL 檔案中。這些檔案難以閱讀和搜尋。此應用程式提供了適當的介面來瀏覽對話、檢視使用統計資訊並尋找舊討論。

## 截圖和示範

### 主介面

瀏覽專案並檢視具有語法醒目提示程式碼區塊的對話

<p align="center">
  <img width="49%" alt="Main Interface 1" src="https://github.com/user-attachments/assets/45719832-324c-40c3-8dfe-5c70ddffc0a9" />
  <img width="49%" alt="Main Interface 2" src="https://github.com/user-attachments/assets/bb9fbc9d-9d78-4a95-a2ab-a1b1b763f515" />
</p>

### 分析儀表板

活動熱力圖和工具使用統計，幫助理解使用模式

<img width="720" alt="Analytics Dashboard" src="https://github.com/user-attachments/assets/77dc026c-8901-47d1-a8ca-e5235b97e945" />

### Token 統計

每個專案的 token 使用量分解和工作階段層級分析

<img width="720" alt="Token Statistics" src="https://github.com/user-attachments/assets/ec5b17d0-076c-435e-8cec-1c6fd74265db" />

### 演示

<img width="720" alt="Demo" src="https://github.com/user-attachments/assets/d3ea389e-a912-433e-b6e2-2e895eaa346d" />

## v1.1.3 新功能

**🔍 完整搜尋功能**:
- 使用 Cmd/Ctrl+F 鍵盤快捷鍵進行強大的全文搜尋
- 支援引號片語進行精確比對
- 搜尋結果醒目提示和跳轉到訊息
- 按工作階段分組的搜尋結果和可展開預覽

**🌍 跨平台支援**:
- 在 macOS（通用二進位檔）、Windows 和 Linux 上執行
- 特定平台安裝程式（.dmg、.exe、.msi、.deb、.AppImage、.rpm）
- 多套件管理器支援（npm、pnpm、yarn、bun）

**🌏 完整國際化**:
- 6種語言：英語、韓語、日語、簡體中文、繁體中文、俄語
- 從系統區域設定自動偵測語言
- 完整的 UI 翻譯覆蓋

**🎨 增強的 UI/UX**:
- 改進的淺色/深色模式和更好的訊息氣泡樣式
- 使用 X 按鈕和 ESC 鍵清除選取
- 改進的工作階段標題顯示
- 統一的檢視狀態架構

**🔧 開發者體驗**:
- 使用 Playwright 的全面 E2E 測試套件
- 透過 GitHub Actions 自動發布工作流程
- 更好的文件（參見 CLAUDE.md）
- 多平台建置指令碼

## 功能特性

**瀏覽對話**: 左側樹狀檢視，右側對話內容。簡潔直觀的介面，支援淺色/深色主題。

**強大搜尋**: 使用 Cmd/Ctrl+F 搜尋所有對話。支援引號片語、比對醒目提示，並可直接跳轉到上下文中的任何訊息。搜尋結果按工作階段分組，便於導覽。

**使用分析**: 全面的分析儀表板包括:
- 顯示使用模式隨時間變化的活動熱力圖
- 按專案和工作階段的 token 使用統計
- 工具使用細分和百分位數
- 工作階段比較指標

**更好的閱讀體驗**:
- 多主題語法醒目提示程式碼區塊
- 格式良好的 diff 和 git 操作
- 帶可折疊部分的可讀訊息串流
- 大型對話的虛擬捲動以獲得流暢效能

**工具輸出視覺化**: 專用渲染器提供:
- 結構化顯示的網路搜尋結果
- Git 操作和工作流程
- 支援串流的終端機輸出
- 帶 diff 視覺化的檔案編輯
- 待辦事項清單變更和更新

**跨平台和國際化**:
- 在 macOS（通用二進位檔）、Windows 和 Linux 上執行
- 完全支援 6 種語言：英語、韓語、日語、簡體中文、繁體中文、俄語
- 自動語言偵測

透過虛擬捲動和分頁高效處理大型對話記錄，並具有安全的自動更新系統。

## 安裝

### 下載預先建置的二進位檔

從 [Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases) 取得最新版本。

**macOS**:
- 下載 `.dmg` 檔案
- 將應用程式拖曳到 Applications 資料夾
- 通用二進位檔支援 Intel 和 Apple Silicon

**Windows**:
- 下載 `.exe` 安裝程式（NSIS）或 `.msi`（WiX）
- 執行安裝程式
- 如需要會自動安裝 WebView2

**Linux**:
- 下載 `.deb`（Debian/Ubuntu）、`.AppImage`（通用）或 `.rpm`（Fedora/RHEL）
- `.deb`: `sudo dpkg -i claude-code-history-viewer*.deb`
- `.AppImage`: `chmod +x *.AppImage && ./claude-code-history-viewer*.AppImage`
- `.rpm`: `sudo rpm -i claude-code-history-viewer*.rpm`

### 從原始碼建置

**所有平台**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install  # 或 npm install、yarn、bun
pnpm tauri:build  # 為目前平台建置
```

**特定平台建置**:
```bash
pnpm tauri:build:mac      # macOS 通用二進位檔
pnpm tauri:build:windows  # Windows x86_64
pnpm tauri:build:linux    # Linux x86_64
```

**要求**:
- Node.js 18+
- 套件管理器: pnpm、npm、yarn 或 bun
- Rust 工具鏈（從 https://rustup.rs 安裝）
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: WebKitGTK、建置工具和其他相依性（完整清單見 CLAUDE.md）
- **Windows**: WebView2 執行階段（自動安裝）

## 使用方法

### 基本導覽
1. 啟動應用程式
2. 自動掃描 `~/.claude` 尋找對話資料
3. 在左側邊欄樹狀結構中瀏覽專案
4. 點擊任何工作階段檢視訊息
5. 使用頂部標籤在以下檢視之間切換:
   - **Messages**: 閱讀完整對話
   - **Analytics**: 檢視活動熱力圖和模式
   - **Token Stats**: 分析 token 使用情況

### 搜尋功能
- 按 **Cmd+F**（macOS）或 **Ctrl+F**（Windows/Linux）開啟搜尋
- 輸入查詢並按 Enter
- 使用引號進行精確片語: `"錯誤訊息"`
- 單擊任何結果直接跳轉到上下文中的訊息
- 結果按工作階段分組，帶可展開預覽

### 鍵盤快捷鍵
- **Cmd/Ctrl+F**: 開啟搜尋
- **ESC**: 清除選取或關閉搜尋
- **點擊工作階段**: 載入對話
- **X 按鈕**: 清除目前選取

### 主題和語言
- 主題自動符合系統偏好（淺色/深色）
- 語言從系統區域設定自動偵測
- 可透過設定選單（右上角）變更

## 目前限制

- **測試版軟體** - 可能存在粗糙邊緣和偶爾的錯誤
- 大型對話記錄（10,000+ 則訊息）初始載入可能需要一些時間
- 唯讀存取 - 無法從應用程式編輯或刪除對話
- 尚無匯出功能（計劃在未來版本中推出）

## 資料隱私

完全在本機執行。不向任何伺服器傳送資料。應用程式僅讀取您的 `~/.claude` 目錄。

## Claude 目錄結構

應用程式期望此結構:

```
~/.claude/
├── projects/          # 專案對話
│   └── [project-name]/
│       └── *.jsonl    # 對話檔案
├── ide/              # IDE 資料
├── statsig/          # 分析資料
└── todos/            # 待辦事項清單
```

## 故障排除

**「未找到 Claude 資料」**:
- 確保您至少使用過一次 Claude Code 建立對話記錄
- 檢查主資料夾中是否存在 `~/.claude` 目錄
- **macOS/Linux**: `ls ~/.claude`
- **Windows**: 檢查 `C:\Users\<您的使用者名稱>\.claude`

**效能問題**:
- 大型工作階段（1,000+ 則訊息）使用虛擬捲動實現流暢效能
- 如果載入感覺緩慢，請先嘗試選取較小的工作階段
- 如需要，請關閉其他應用程式以釋放記憶體

**搜尋不工作**:
- 確保您輸入了查詢並按了 Enter
- 嘗試使用引號引起的片語進行精確比對: `"特定錯誤"`
- 檢查您搜尋的工作階段是否包含文字

**特定平台問題**:
- **Windows**: 如果應用程式無法啟動，請確保已安裝 WebView2（通常自動安裝）
- **Linux**: 如果看到 webkit 相關錯誤，請安裝 WebKitGTK: `sudo apt install libwebkit2gtk-4.1-dev`
- **macOS**: 如果收到安全性警告，請右鍵點擊應用程式並選擇「開啟」

**更新問題**: 如果自動更新失敗，請從 [Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases) 手動下載最新版本。

## 貢獻

歡迎貢獻！以下是您可以提供協助的方式:

**錯誤回報**:
- 在 [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues) 上開啟 issue
- 包括您的作業系統、應用程式版本和重現步驟
- 螢幕截圖或錯誤訊息很有幫助

**功能請求**:
- 首先檢查現有 issue 以避免重複
- 描述使用案例和預期行為
- 如果可以實作，請考慮提交 PR

**Pull Request**:
- Fork 儲存庫並建立功能分支
- 遵循現有程式碼風格（已設定 ESLint）
- 如可能，為新功能新增測試
- 如果新增新功能或變更架構，請更新 CLAUDE.md
- 提交前在平台上測試

**開發設定**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:dev  # 啟動帶熱重新載入的開發伺服器
```

有關詳細的架構文件、開發命令和實作說明，請參見 [CLAUDE.md](CLAUDE.md)。

**貢獻者**:
感謝為此專案做出貢獻的每個人！特別感謝:
- 原始概念和初始開發
- 搜尋 UI 實作和改進
- E2E 測試基礎設施
- 多平台支援和國際化
- 以及所有錯誤回報者和功能請求者

## 技術堆疊

**核心**:
- **Tauri v2** - 帶 Rust 後端的輕量級原生 shell（2-10MB 佔用空間）
- **React 19** - 帶鉤子和函數元件的現代前端
- **TypeScript** - 型別安全開發

**UI 和樣式**:
- **Tailwind CSS v4** - 帶 Claude 品牌色的實用優先樣式
- **Radix UI** - 可存取的無樣式元件原語
- **Lucide React** - 精美圖示程式庫
- **Prism** - 程式碼區塊語法醒目提示

**狀態和資料**:
- **Zustand** - 輕量級狀態管理
- **i18next** - 6 種語言的國際化
- **@tanstack/react-virtual** - 效能虛擬捲動

**建置和工具**:
- **Vite** - 快速建置工具和開發伺服器
- **Vitest** - 單元測試框架
- **Playwright** - Tauri 應用程式的 E2E 測試
- **ESLint** - 程式碼檢查和品質

**平台功能**:
- **Tauri 外掛程式**: Store、Dialog、Updater、OS、Process、HTTP
- **GitHub Actions** - 自動化多平台建置和發布

## 授權條款

MIT 授權條款 - 請參見 [LICENSE](LICENSE) 檔案。

---

**有問題或疑問？** 請使用您的設定詳細資訊和出錯內容[開啟 issue](https://github.com/ndokutovich/claude-code-history-viewer/issues)。
