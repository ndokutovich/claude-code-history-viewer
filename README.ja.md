# Claude Code History Viewer

Claude Code の会話履歴（`~/.claude`）を閲覧するためのデスクトップアプリです。

![Version](https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg)
![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

> ⚠️ **ベータソフトウェア** - 不安定または変更の可能性があります

## 開発理由

Claude Code は会話履歴を`~/.claude/projects/`フォルダ内の JSONL ファイルとして保存します。これらのファイルは読みにくく検索も困難なため、会話を確認し使用統計を見るための適切なインターフェースを提供するアプリを作成しました。

## スクリーンショットとデモ

### メインインターフェース

プロジェクトを閲覧し、シンタックスハイライトされたコードブロックで会話を確認

<p align="center">
  <img width="49%" alt="Main Interface 1" src="https://github.com/user-attachments/assets/45719832-324c-40c3-8dfe-5c70ddffc0a9" />
  <img width="49%" alt="Main Interface 2" src="https://github.com/user-attachments/assets/bb9fbc9d-9d78-4a95-a2ab-a1b1b763f515" />
</p>

### 分析ダッシュボード

使用パターンを理解するためのアクティビティヒートマップとツール使用統計

<img width="720" alt="Analytics Dashboard" src="https://github.com/user-attachments/assets/77dc026c-8901-47d1-a8ca-e5235b97e945" />

### トークン統計

プロジェクト別のトークン使用量内訳とセッションレベルの分析

<img width="720" alt="Token Statistics" src="https://github.com/user-attachments/assets/ec5b17d0-076c-435e-8cec-1c6fd74265db" />

### デモ

<img width="720" alt="Demo" src="https://github.com/user-attachments/assets/d3ea389e-a912-433e-b6e2-2e895eaa346d" />

## 主な機能

**会話の閲覧**: 左側にプロジェクトツリー、右側に会話内容が表示されます。

**検索とフィルタリング**: 全ての会話履歴から特定の会話やメッセージを見つけることができます。

**使用量分析**: 最も使用するプロジェクト、時系列でのトークン使用量、活動パターンなどを確認できます。Claude Code の使用習慣を理解するのに役立ちます。

**より良い読書体験**: コードブロックのシンタックスハイライト、整形された差分表示、読みやすいメッセージスレッドなど、生の JSONL ファイルよりもはるかに見やすくなっています。

**ツール出力の可視化**: ウェブ検索結果、git 操作、ターミナル出力などが読みやすい形式で表示されます。

大きな会話履歴も滞りなく処理し、新しい会話が追加されると自動的に更新されます。

## インストール

### ダウンロード

[Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases)から最新版を入手してください。

### ソースからビルド

```bash
git clone https://github.com/jhlee0409/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:build
```

**必要なもの**: Node.js 18+、pnpm、Rust ツールチェーン、Xcode Command Line Tools (macOS)

## 使用方法

1. アプリを起動
2. `~/.claude`を自動的にスキャンして会話データを見つけます
3. 左サイドバーでプロジェクトを閲覧
4. セッションをクリックしてメッセージを表示
5. 分析タブで使用統計を確認

## 現在の制限

- **macOS のみサポート**（Windows/Linux サポート予定）
- **ベータソフトウェア** - まだ粗い部分があるかもしれません
- 大きな会話履歴（数千のメッセージ）は初期読み込みが遅い場合があります
- 自動更新システムはまだテスト中です

## データプライバシー

完全にローカルで動作します。サーバーにデータを送信せず、`~/.claude`ディレクトリのみを読み取ります。

## Claude ディレクトリ構造

アプリは以下の構造を想定しています：

```
~/.claude/
├── projects/          # プロジェクト会話
│   └── [project-name]/
│       └── *.jsonl    # 会話ファイル
├── ide/              # IDEデータ
├── statsig/          # 分析データ
└── todos/            # Todoリスト
```

## トラブルシューティング

**「Claude データが見つかりません」**: Claude Code を使用して会話履歴があることを確認してください。`~/.claude`が存在するかも確認してください。

**パフォーマンスの問題**: 会話履歴が非常に大きい場合は、他のアプリを閉じてみてください。現在はすべてのデータをメモリに読み込みます。

**更新の問題**: ベータ版の自動アップデーターが不安定な場合があります。問題がある場合は手動でダウンロードしてください。

## 貢献

Pull Request を歓迎します。個人プロジェクトのため、返答が遅れる場合があります。

## 技術スタック

Tauri (Rust + React)で構築。UI は Tailwind CSS と Radix コンポーネントを使用。

## ライセンス

MIT ライセンス - [LICENSE](LICENSE)ファイルを参照。

---

**質問や問題がありますか？** 設定と発生した問題について詳しく説明して[issue を作成](https://github.com/jhlee0409/claude-code-history-viewer/issues)してください。
