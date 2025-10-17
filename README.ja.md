# Claude Code History Viewer

Claude Code の会話履歴（`~/.claude`）を閲覧するためのクロスプラットフォームデスクトップアプリです。

![Version](https://img.shields.io/badge/Version-1.1.3-blue.svg)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md) | [Русский](README.ru.md)

> ⚠️ **ベータソフトウェア** - 不安定または変更の可能性があります。問題を見つけた場合は[GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues)で報告してください。

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

## v1.1.3 の新機能

**🔍 完全な検索機能**:
- Cmd/Ctrl+F キーボードショートカットによる強力な全文検索
- 正確な一致のための引用句のサポート
- 検索結果のハイライトとメッセージへのジャンプ
- 展開可能なプレビュー付きのセッションごとにグループ化された結果

**🌍 クロスプラットフォーム対応**:
- macOS（ユニバーサルバイナリ）、Windows、Linux で動作
- プラットフォーム固有のインストーラー（.dmg、.exe、.msi、.deb、.AppImage、.rpm）
- 複数のパッケージマネージャーサポート（npm、pnpm、yarn、bun）

**🌏 完全な国際化**:
- 6言語：英語、韓国語、日本語、簡体字中国語、繁体字中国語、ロシア語
- システムロケールからの自動言語検出
- 完全なUI翻訳カバレッジ

**🎨 強化されたUI/UX**:
- 改善されたライト/ダークモードとより良いメッセージバブルスタイリング
- Xボタンと ESC キーでの選択解除
- 改善されたセッションタイトル表示
- 統一されたビュー状態アーキテクチャ

**🔧 開発者エクスペリエンス**:
- Playwright を使用した包括的な E2E テストスイート
- GitHub Actions による自動化されたリリースワークフロー
- より良いドキュメント（CLAUDE.md を参照）
- マルチプラットフォームビルドスクリプト

## 主な機能

**会話の閲覧**: 左側にツリービュー、右側に会話内容が表示されます。ライト/ダークテーマをサポートするクリーンで直感的なインターフェースです。

**強力な検索**: Cmd/Ctrl+F ですべての会話を検索できます。引用句のサポート、マッチのハイライト、コンテキスト内のメッセージに直接ジャンプ可能です。検索結果はセッションごとにグループ化され、簡単にナビゲートできます。

**使用量分析**: 包括的な分析ダッシュボードを提供:
- 時間の経過に伴う使用パターンを示すアクティビティヒートマップ
- プロジェクトおよびセッション別のトークン使用統計
- ツール使用の内訳とパーセンタイル
- セッション比較指標

**より良い読書体験**:
- 複数のテーマを持つシンタックスハイライトされたコードブロック
- 適切にフォーマットされた差分と git 操作
- 折りたたみ可能なセクションを持つ読みやすいメッセージスレッド
- 大きな会話のための仮想スクロールによるスムーズなパフォーマンス

**ツール出力の可視化**: 専用レンダラーを提供:
- 構造化された表示を持つウェブ検索結果
- Git 操作とワークフロー
- ストリーミングサポート付きターミナル出力
- 差分可視化付きファイル編集
- Todo リストの変更と更新

**クロスプラットフォームと国際化**:
- macOS（ユニバーサルバイナリ）、Windows、Linux で動作
- 6言語の完全サポート：英語、韓国語、日本語、簡体字中国語、繁体字中国語、ロシア語
- 自動言語検出

仮想スクロールとページネーションで大きな会話履歴を効率的に処理し、安全な自動更新システムを備えています。

## インストール

### ビルド済みバイナリのダウンロード

[Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases)から最新版を入手してください。

**macOS**:
- `.dmg` ファイルをダウンロード
- アプリを Applications フォルダにドラッグ
- ユニバーサルバイナリは Intel と Apple Silicon の両方をサポート

**Windows**:
- `.exe` インストーラー（NSIS）または `.msi`（WiX）をダウンロード
- インストーラーを実行
- 必要に応じて WebView2 が自動的にインストールされます

**Linux**:
- `.deb`（Debian/Ubuntu）、`.AppImage`（汎用）、または `.rpm`（Fedora/RHEL）をダウンロード
- `.deb`: `sudo dpkg -i claude-code-history-viewer*.deb`
- `.AppImage`: `chmod +x *.AppImage && ./claude-code-history-viewer*.AppImage`
- `.rpm`: `sudo rpm -i claude-code-history-viewer*.rpm`

### ソースからビルド

**すべてのプラットフォーム**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install  # または npm install、yarn、bun
pnpm tauri:build  # 現在のプラットフォーム用にビルド
```

**プラットフォーム固有のビルド**:
```bash
pnpm tauri:build:mac      # macOS ユニバーサルバイナリ
pnpm tauri:build:windows  # Windows x86_64
pnpm tauri:build:linux    # Linux x86_64
```

**要件**:
- Node.js 18+
- パッケージマネージャー: pnpm、npm、yarn、または bun
- Rust ツールチェーン (https://rustup.rs からインストール)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: WebKitGTK、ビルドツール、およびその他の依存関係（完全なリストは CLAUDE.md を参照）
- **Windows**: WebView2 ランタイム（自動インストール）

## 使用方法

### 基本的なナビゲーション
1. アプリを起動
2. `~/.claude`を自動的にスキャンして会話データを見つけます
3. 左サイドバーのツリーでプロジェクトを閲覧
4. セッションをクリックしてメッセージを表示
5. 上部のタブを使用して次のビューを切り替え:
   - **Messages**: 完全な会話を読む
   - **Analytics**: アクティビティヒートマップとパターンを表示
   - **Token Stats**: トークン使用量を分析

### 検索機能
- **Cmd+F**（macOS）または **Ctrl+F**（Windows/Linux）を押して検索を開く
- クエリを入力して Enter を押す
- 正確なフレーズには引用符を使用: `"エラーメッセージ"`
- 結果をクリックしてそのメッセージに直接ジャンプ
- 結果は展開可能なプレビュー付きでセッションごとにグループ化

### キーボードショートカット
- **Cmd/Ctrl+F**: 検索を開く
- **ESC**: 選択を解除または検索を閉じる
- **セッションをクリック**: 会話をロード
- **X ボタン**: 現在の選択を解除

### テーマと言語
- テーマは自動的にシステムの設定に合わせます（ライト/ダーク）
- 言語はシステムロケールから自動検出されます
- 設定メニュー（右上）で変更可能

## 現在の制限

- **ベータソフトウェア** - 粗い部分やたまにバグがあるかもしれません
- 大きな会話履歴（10,000+ メッセージ）は初期ロードに時間がかかる場合があります
- 読み取り専用アクセス - アプリから会話を編集または削除できません
- まだエクスポート機能がありません（将来のリリース予定）

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

**「Claude データが見つかりません」**:
- Claude Code を少なくとも一度使用して会話履歴が作成されていることを確認してください
- ホームフォルダに `~/.claude` ディレクトリがあることを確認してください
- **macOS/Linux**: `ls ~/.claude`
- **Windows**: `C:\Users\<ユーザー名>\.claude` を確認

**パフォーマンスの問題**:
- 大きなセッション（1,000+ メッセージ）は仮想スクロールでスムーズなパフォーマンスを提供
- ロードが遅く感じる場合は、まず小さなセッションを選択してみてください
- 必要に応じてメモリを解放するために他のアプリを閉じてください

**検索が機能しない**:
- クエリを入力して Enter を押したことを確認してください
- 正確な一致には引用符で囲んだフレーズを試してください: `"特定のエラー"`
- 検索しているセッションにテキストが含まれていることを確認してください

**プラットフォーム固有の問題**:
- **Windows**: アプリが起動しない場合、WebView2 がインストールされていることを確認してください（通常は自動インストール）
- **Linux**: webkit 関連のエラーが表示される場合、WebKitGTK をインストールしてください: `sudo apt install libwebkit2gtk-4.1-dev`
- **macOS**: セキュリティ警告が表示される場合、アプリを右クリックして「開く」を選択してください

**更新の問題**: 自動更新が失敗した場合は、[Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases)から最新バージョンを手動でダウンロードしてください。

## 貢献

貢献を歓迎します！お手伝いいただける方法:

**バグレポート**:
- [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues)で issue を開く
- OS、アプリバージョン、再現手順を含める
- スクリーンショットやエラーメッセージが役立ちます

**機能リクエスト**:
- 重複を避けるため、まず既存の issue を確認
- ユースケースと期待される動作を説明
- 実装できる場合は PR の提出を検討

**Pull Request**:
- リポジトリをフォークし、機能ブランチを作成
- 既存のコードスタイルに従う（ESLint が設定されています）
- 可能な場合は新機能のテストを追加
- 新機能を追加したりアーキテクチャを変更する場合は CLAUDE.md を更新
- 提出前にプラットフォームでテスト

**開発セットアップ**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:dev  # ホットリロード付き開発サーバーを起動
```

詳細なアーキテクチャドキュメント、開発コマンド、実装ノートについては [CLAUDE.md](CLAUDE.md) を参照してください。

**貢献者**:
このプロジェクトに貢献してくださったすべての方に感謝します！特に感謝:
- オリジナルコンセプトと初期開発
- 検索 UI の実装と改善
- E2E テストインフラストラクチャ
- マルチプラットフォームサポートと国際化
- そしてすべてのバグレポーターと機能リクエスター

## 技術スタック

**コア**:
- **Tauri v2** - Rust バックエンドを持つ軽量ネイティブシェル（2-10MB フットプリント）
- **React 19** - フックと関数コンポーネントを持つモダンフロントエンド
- **TypeScript** - 型安全な開発

**UI とスタイリング**:
- **Tailwind CSS v4** - Claude ブランドカラーを持つユーティリティファーストスタイリング
- **Radix UI** - アクセシブルでスタイルのないコンポーネントプリミティブ
- **Lucide React** - 美しいアイコンライブラリ
- **Prism** - コードブロックのシンタックスハイライト

**状態とデータ**:
- **Zustand** - 軽量状態管理
- **i18next** - 6言語での国際化
- **@tanstack/react-virtual** - パフォーマンスのための仮想スクロール

**ビルドとツール**:
- **Vite** - 高速ビルドツールと開発サーバー
- **Vitest** - ユニットテストフレームワーク
- **Playwright** - Tauri アプリのための E2E テスト
- **ESLint** - コードリンティングと品質

**プラットフォーム機能**:
- **Tauri プラグイン**: Store、Dialog、Updater、OS、Process、HTTP
- **GitHub Actions** - 自動化されたマルチプラットフォームビルドとリリース

## ライセンス

MIT ライセンス - [LICENSE](LICENSE)ファイルを参照。

---

**質問や問題がありますか？** 設定と発生した問題について詳しく説明して[issue を作成](https://github.com/ndokutovich/claude-code-history-viewer/issues)してください。
