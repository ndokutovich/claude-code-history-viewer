# Claude Code History Viewer

用於瀏覽 Claude Code 對話記錄(`~/.claude`)的桌面應用程式。

![Version](https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg)
![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

> ⚠️ **測試版軟體** - 可能不穩定或有變化

## 開發緣由

Claude Code 將對話記錄保存在 `~/.claude/projects/` 資料夾的 JSONL 檔案中。這些檔案難以閱讀和搜尋，因此開發了這個應用程式，提供適當的介面來檢視對話和使用統計。

## 截圖和示範

### 主介面

瀏覽專案並檢視具有語法醒目提示程式碼區塊的對話

<p align="center">
  <img width="49%" alt="Main Interface 1" src="https://github.com/user-attachments/assets/45719832-324c-40c3-8dfe-5c70ddffc0a9" />
  <img width="49%" alt="Main Interface 2" src="https://github.com/user-attachments/assets/bb9fbc9d-9d78-4a95-a2ab-a1b1b763f515" />
</p>

### 分析儀表板

活動熱力圖和工具使用統計，了解您的使用模式

<img width="720" alt="Analytics Dashboard" src="https://github.com/user-attachments/assets/77dc026c-8901-47d1-a8ca-e5235b97e945" />

### Token 統計

每個專案的 token 使用量細分和工作階段層級分析

<img width="720" alt="Token Statistics" src="https://github.com/user-attachments/assets/ec5b17d0-076c-435e-8cec-1c6fd74265db" />

### 演示

<img width="720" alt="Demo" src="https://github.com/user-attachments/assets/d3ea389e-a912-433e-b6e2-2e895eaa346d" />

## 主要功能

**瀏覽對話**: 左側顯示專案樹狀結構，右側顯示對話內容。

**搜尋和篩選**: 在整個對話記錄中尋找特定對話或訊息。

**使用分析**: 檢視最常用的專案、時間段內的 token 使用量、活動模式等。有助於了解您的 Claude Code 使用習慣。

**更好的閱讀體驗**: 程式碼區塊語法醒目提示、格式化差異對比、可讀的訊息串流，比原始 JSONL 檔案更易讀。

**工具輸出視覺化**: 網路搜尋結果、git 操作、終端機輸出等以可讀格式顯示。

應用程式可以順暢處理大型對話記錄，並在新增新對話時自動重新整理。

## 安裝

### 下載

從 [Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases) 取得最新版本。

### 從原始碼建置

```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:build
```

**需求**: Node.js 18+、pnpm、Rust 工具鏈、Xcode Command Line Tools (macOS)

## 使用方法

1. 啟動應用程式
2. 自動掃描 `~/.claude` 尋找對話資料
3. 在左側邊欄瀏覽專案
4. 點擊工作階段檢視訊息
5. 在分析標籤檢視使用統計

## 目前限制

- **僅支援 macOS**（計劃支援 Windows/Linux）
- **測試版軟體** - 可能存在一些問題
- 大型對話記錄（數千則訊息）初始載入可能較慢
- 自動更新系統仍在測試中

## 資料隱私

完全在本機執行。不向伺服器傳送資料，僅讀取您的 `~/.claude` 目錄。

## Claude 目錄結構

應用程式期望以下結構：

```
~/.claude/
├── projects/          # 專案對話
│   └── [project-name]/
│       └── *.jsonl    # 對話檔案
├── ide/              # IDE 資料
├── statsig/          # 分析資料
└── todos/            # 待辦事項
```

## 故障排除

**「未找到 Claude 資料」**: 確保您已使用 Claude Code 並有對話記錄。檢查 `~/.claude` 是否存在。

**效能問題**: 如果對話記錄很大，嘗試關閉其他應用程式。目前將所有資料載入到記憶體中。

**更新問題**: 測試版自動更新器可能不穩定。如有問題請手動下載。

## 貢獻

歡迎 Pull Request。這是個人專案，回覆可能會有延遲。

## 技術堆疊

使用 Tauri (Rust + React) 建置。介面使用 Tailwind CSS 和 Radix 元件。

## 授權條款

MIT 授權條款 - 見 [LICENSE](LICENSE) 檔案。

---

**有問題或疑問？** 請詳細描述您的設定和遇到的問題，[建立 issue](https://github.com/ndokutovich/claude-code-history-viewer/issues)。
