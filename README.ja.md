# Claude Code History Viewer

<p style="center">
  <img src="https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg" alt="Version 1.0.0-beta.3" />
  <img src="https://img.shields.io/badge/Built%20with-Tauri%202.6.1%20+%20React%2019.1.0-blue.svg" alt="Built with Tauri 2.6.1 and React 19.1.0" />
  <img src="https://img.shields.io/badge/Platform-macOS-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Languages-Multi--lingual-blueviolet.svg" alt="Multi-lingual UI" />
</p>

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

`~/.claude`ディレクトリにローカルに保存された Claude Code の会話履歴を閲覧・分析するデスクトップアプリケーションです。

> ⚠️ **ベータ版のお知らせ**: このアプリケーションは現在ベータ版です。機能と API が変更される可能性があります。

## 機能

### コア機能

- 📁 **プロジェクトとセッションの閲覧** - すべての Claude Code プロジェクトと会話セッションを閲覧
- 🎨 **シンタックスハイライト** - react-syntax-highlighter でコードブロックを美しくハイライト表示
- 🌲 **ツリービューナビゲーション** - 展開可能なツリー構造による直感的なプロジェクト/セッション階層
- ⚡ **高速パフォーマンス** - 効率的なファイル解析と検索のための Rust バックエンド
- 🖥️ **macOS ネイティブ** - macOS 用 Tauri で構築された最適化デスクトップアプリケーション

### 分析と統計

- 📊 **包括的な分析ダッシュボード** - インタラクティブチャート付きの詳細な使用状況分析を表示
- 📈 **トークン使用量統計** - プロジェクトとセッション別のトークン使用量を成長率と共に追跡
- 🔥 **アクティビティヒートマップ** - 時間経過に伴うインタラクションパターンの可視化
- 📊 **セッション比較** - 異なるセッション間のメトリクス比較
- 📉 **ツール使用量分析** - 最も頻繁に使用されるツールの確認

### 高度な機能

- 🔄 **自動アップデートシステム** - 優先度レベル（重要、推奨、オプション）による自動アップデート確認
- 💭 **思考コンテンツ表示** - Claude の推論プロセスをフォーマットされたブロックで表示
- 📃 **効率的なメッセージ読み込み** - ページネーションで大規模な会話履歴を処理
- 🔄 **セッション更新** - 再起動せずにセッションを更新して新しいメッセージを確認
- 📝 **セッション要約** - 迅速なセッション概要のための AI 生成要約

### コンテンツレンダリング

- 🖼️ **画像サポート** - 会話に埋め込まれた画像の表示
- 📝 **拡張 Diff ビューア** - 改良された行単位のファイル変更比較
- 🚀 **リッチツール結果** - 様々なツール出力の美しいレンダリング（ウェブ検索、git ワークフロー、ターミナルストリームなど）

## インストール

### ビルド済みバイナリのダウンロード

[Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases)ページにアクセスして、お使いのプラットフォーム用の最新版をダウンロードしてください。

### ソースからビルド

#### 前提条件

- [Node.js](https://nodejs.org/) (v18 以上)
- [pnpm](https://pnpm.io/) パッケージマネージャー (v8+)
- [Rust](https://www.rust-lang.org/) ツールチェーン (最新安定版)
- **macOS**: Xcode Command Line Tools

#### ビルド

```bash
# リポジトリのクローン
git clone https://github.com/jhlee0409/claude-code-history-viewer.git
cd claude-code-history-viewer

# 依存関係のインストール
pnpm install

# 開発モードで実行
pnpm tauri:dev

# プロダクション用ビルド
pnpm tauri:build
```

ビルドされたアプリケーションは`src-tauri/target/release/bundle/`にあります。

## 使用方法

1. アプリケーションを起動
2. アプリが自動的に`~/.claude`ディレクトリの会話履歴をスキャンします
3. 左サイドバーを使用してプロジェクトとセッションを閲覧します
4. セッションをクリックしてメッセージを表示します
5. 分析ダッシュボードで使用パターンを理解します
6. 自動アップデートシステムでアップデートを確認します

## 貢献

貢献を歓迎します！プルリクエストを提出してください。

## Claude ディレクトリ構造

アプリは以下から会話データを読み取ります：

```text
~/.claude/
├── projects/          # プロジェクト固有の会話データ
│   └── [project-name]/
│       └── *.jsonl    # 会話メッセージを含むJSONLファイル
├── ide/              # IDE関連データ
├── statsig/          # 統計/分析データ
└── todos/            # TODOリストデータ
```

## トラブルシューティング

### よくある問題

**アプリが Claude データを見つけられない場合**

- Claude Code がインストールされ、会話履歴があることを確認してください
- `~/.claude`ディレクトリが存在し、プロジェクトデータが含まれていることを確認してください

**大規模な履歴でのパフォーマンス問題**

- アプリは長いメッセージリストに仮想化を使用します
- パフォーマンスが低下する場合は、古い会話のアーカイブを検討してください

## プライバシー

このアプリケーションは完全にローカルで実行され、外部サーバーにデータを送信しません。すべての会話データはお使いのマシンに残ります。

## ライセンス

このプロジェクトは MIT ライセンスの下でライセンスされています。詳細については[LICENSE](LICENSE)ファイルをご覧ください。

## 技術スタック

- [Tauri](https://tauri.app/) + React + TypeScript で構築
- UI: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)

## サポート

問題が発生した場合は、詳細な情報と共に[イシューを作成](https://github.com/jhlee0409/claude-code-history-viewer/issues)してください。

---
