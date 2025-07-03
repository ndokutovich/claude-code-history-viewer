# Claude Code History Viewer

<p style="center">
  <img src="https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg" alt="Version 1.0.0-beta.3" />
  <img src="https://img.shields.io/badge/Built%20with-Tauri%202.6.1%20+%20React%2019.1.0-blue.svg" alt="Built with Tauri 2.6.1 and React 19.1.0" />
  <img src="https://img.shields.io/badge/Platform-macOS-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Languages-Multi--lingual-blueviolet.svg" alt="Multi-lingual UI" />
</p>

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

一個用於瀏覽和分析本機儲存在`~/.claude`目錄中的 Claude Code 對話記錄的桌面應用程式。

> ⚠️ **測試版提醒**: 此應用程式目前處於測試階段。功能和 API 可能會發生變化。

## 功能

### 核心功能

- 📁 **瀏覽專案和會話** - 瀏覽所有 Claude Code 專案和對話會話
- 🎨 **語法醒目提示** - 使用 react-syntax-highlighter 美觀地醒目提示程式碼區塊
- 🌲 **樹狀檢視導覽** - 可展開樹狀結構的直覺式專案/會話階層
- ⚡ **快速效能** - 使用 Rust 後端進行高效的檔案解析和搜尋
- 🖥️ **macOS 原生** - 使用 Tauri 為 macOS 構建的最佳化桌面應用程式

### 分析和統計

- 📊 **綜合分析儀表板** - 檢視帶有互動式圖表的詳細使用分析
- 📈 **令牌使用統計** - 追蹤每個專案和會話的令牌使用情況及成長率
- 🔥 **活動熱力圖** - 視覺化您隨時間變化的互動模式
- 📊 **會話比較** - 比較不同會話之間的指標
- 📉 **工具使用分析** - 檢視最常用的工具

### 進階功能

- 🔄 **自動更新系統** - 具有優先順序等級（重要、建議、可選）的自動更新檢查
- 💭 **思考內容顯示** - 以格式化區塊的形式檢視 Claude 的推理過程
- 📃 **高效訊息載入** - 透過分頁處理大型對話記錄
- 🔄 **會話重新整理** - 無需重新啟動即可重新整理會話檢視新訊息
- 📝 **會話摘要** - AI 生成的摘要便於快速會話概覽

### 內容渲染

- 🖼️ **圖片支援** - 檢視對話中嵌入的圖片
- 📝 **增強 Diff 檢視器** - 改良的逐行檔案變更比較
- 🚀 **豐富的工具結果** - 各種工具輸出的美觀渲染（網路搜尋、git 工作流程、終端機串流等）

## 安裝

### 下載預建構二進位檔案

造訪[Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases)頁面下載適用於您平台的最新版本。

### 從原始碼建構

#### 先決條件

- [Node.js](https://nodejs.org/) (v18 或更高版本)
- [pnpm](https://pnpm.io/) 套件管理器 (v8+)
- [Rust](https://www.rust-lang.org/) 工具鏈 (最新穩定版)
- **macOS**: Xcode Command Line Tools

#### 建構

```bash
# 複製儲存庫
git clone https://github.com/jhlee0409/claude-code-history-viewer.git
cd claude-code-history-viewer

# 安裝相依性
pnpm install

# 在開發模式下執行
pnpm tauri:dev

# 建構正式版本
pnpm tauri:build
```

建構的應用程式將位於`src-tauri/target/release/bundle/`中。

## 使用方法

1. 啟動應用程式
2. 應用程式會自動掃描您的`~/.claude`目錄中的對話記錄
3. 使用左側邊欄瀏覽專案和會話
4. 點擊任何會話檢視其訊息
5. 檢視分析儀表板了解您的使用模式
6. 透過自動更新系統檢查更新

## 貢獻

歡迎貢獻！請提交 Pull Request。

## Claude 目錄結構

應用程式從以下位置讀取對話資料：

```text
~/.claude/
├── projects/          # 專案特定的對話資料
│   └── [project-name]/
│       └── *.jsonl    # 包含對話訊息的JSONL檔案
├── ide/              # IDE相關資料
├── statsig/          # 統計/分析資料
└── todos/            # 待辦事項資料
```

## 故障排除

### 常見問題

**應用程式找不到 Claude 資料**

- 確保您已安裝 Claude Code 並有一些對話記錄
- 檢查`~/.claude`目錄是否存在並包含專案資料

**大型記錄的效能問題**

- 應用程式對長訊息清單使用虛擬化
- 如果效能下降，請考慮封存舊對話

## 隱私

此應用程式完全在本機執行，不會向外部伺服器傳送任何資料。所有對話資料都保留在您的電腦上。

## 授權條款

此專案根據 MIT 授權條款授權 - 有關詳細資訊，請參閱[LICENSE](LICENSE)檔案。

## 技術堆疊

- 使用[Tauri](https://tauri.app/) + React + TypeScript 建構
- UI: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)

## 支援

如果遇到問題，請[建立 issue](https://github.com/jhlee0409/claude-code-history-viewer/issues)並提供詳細資訊。

---
