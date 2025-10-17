# Claude Code History Viewer

一款用于浏览存储在 `~/.claude` 中的 Claude Code 对话历史的跨平台桌面应用程序。

![Version](https://img.shields.io/badge/Version-1.1.3-blue.svg)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md) | [Русский](README.ru.md)

> ⚠️ **测试版软件** - 可能存在不稳定或变更。如发现问题请在 [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues) 上报告。

## 开发原因

Claude Code 将对话历史存储在 `~/.claude/projects/` 文件夹中的 JSONL 文件中。这些文件难以阅读和搜索。此应用程序提供了一个合适的界面来浏览对话、查看使用统计信息并查找旧讨论。

## 截图和演示

### 主界面

浏览项目并查看带有语法高亮代码块的对话

<p align="center">
  <img width="49%" alt="Main Interface 1" src="https://github.com/user-attachments/assets/45719832-324c-40c3-8dfe-5c70ddffc0a9" />
  <img width="49%" alt="Main Interface 2" src="https://github.com/user-attachments/assets/bb9fbc9d-9d78-4a95-a2ab-a1b1b763f515" />
</p>

### 分析仪表板

活动热力图和工具使用统计，帮助理解使用模式

<img width="720" alt="Analytics Dashboard" src="https://github.com/user-attachments/assets/77dc026c-8901-47d1-a8ca-e5235b97e945" />

### Token 统计

每个项目的 token 使用量分解和会话级别分析

<img width="720" alt="Token Statistics" src="https://github.com/user-attachments/assets/ec5b17d0-076c-435e-8cec-1c6fd74265db" />

### 演示

<img width="720" alt="Demo" src="https://github.com/user-attachments/assets/d3ea389e-a912-433e-b6e2-2e895eaa346d" />

## v1.1.3 新功能

**🔍 完整搜索功能**:
- 使用 Cmd/Ctrl+F 键盘快捷键进行强大的全文搜索
- 支持引号短语进行精确匹配
- 搜索结果高亮和跳转到消息
- 按会话分组的搜索结果和可展开预览

**🌍 跨平台支持**:
- 在 macOS（通用二进制）、Windows 和 Linux 上运行
- 特定平台安装程序（.dmg、.exe、.msi、.deb、.AppImage、.rpm）
- 多包管理器支持（npm、pnpm、yarn、bun）

**🌏 完整国际化**:
- 6种语言：英语、韩语、日语、简体中文、繁体中文、俄语
- 从系统区域设置自动检测语言
- 完整的 UI 翻译覆盖

**🎨 增强的 UI/UX**:
- 改进的浅色/深色模式和更好的消息气泡样式
- 使用 X 按钮和 ESC 键清除选择
- 改进的会话标题显示
- 统一的视图状态架构

**🔧 开发者体验**:
- 使用 Playwright 的全面 E2E 测试套件
- 通过 GitHub Actions 自动发布工作流
- 更好的文档（参见 CLAUDE.md）
- 多平台构建脚本

## 功能特性

**浏览对话**: 左侧树形视图，右侧对话内容。简洁直观的界面，支持浅色/深色主题。

**强大搜索**: 使用 Cmd/Ctrl+F 搜索所有对话。支持引号短语、匹配高亮，并可直接跳转到上下文中的任何消息。搜索结果按会话分组，便于导航。

**使用分析**: 全面的分析仪表板包括:
- 显示使用模式随时间变化的活动热力图
- 按项目和会话的 token 使用统计
- 工具使用细分和百分位数
- 会话比较指标

**更好的阅读体验**:
- 多主题语法高亮代码块
- 格式良好的 diff 和 git 操作
- 带可折叠部分的可读消息线程
- 大型对话的虚拟滚动以获得流畅性能

**工具输出可视化**: 专用渲染器提供:
- 结构化显示的网络搜索结果
- Git 操作和工作流
- 支持流式传输的终端输出
- 带 diff 可视化的文件编辑
- 待办事项列表更改和更新

**跨平台和国际化**:
- 在 macOS（通用二进制）、Windows 和 Linux 上运行
- 完全支持 6 种语言：英语、韩语、日语、简体中文、繁体中文、俄语
- 自动语言检测

通过虚拟滚动和分页高效处理大型对话历史，并具有安全的自动更新系统。

## 安装

### 下载预构建二进制文件

从 [Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases) 获取最新版本。

**macOS**:
- 下载 `.dmg` 文件
- 将应用程序拖到 Applications 文件夹
- 通用二进制支持 Intel 和 Apple Silicon

**Windows**:
- 下载 `.exe` 安装程序（NSIS）或 `.msi`（WiX）
- 运行安装程序
- 如需要会自动安装 WebView2

**Linux**:
- 下载 `.deb`（Debian/Ubuntu）、`.AppImage`（通用）或 `.rpm`（Fedora/RHEL）
- `.deb`: `sudo dpkg -i claude-code-history-viewer*.deb`
- `.AppImage`: `chmod +x *.AppImage && ./claude-code-history-viewer*.AppImage`
- `.rpm`: `sudo rpm -i claude-code-history-viewer*.rpm`

### 从源代码构建

**所有平台**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install  # 或 npm install、yarn、bun
pnpm tauri:build  # 为当前平台构建
```

**特定平台构建**:
```bash
pnpm tauri:build:mac      # macOS 通用二进制
pnpm tauri:build:windows  # Windows x86_64
pnpm tauri:build:linux    # Linux x86_64
```

**要求**:
- Node.js 18+
- 包管理器: pnpm、npm、yarn 或 bun
- Rust 工具链（从 https://rustup.rs 安装）
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: WebKitGTK、构建工具和其他依赖项（完整列表见 CLAUDE.md）
- **Windows**: WebView2 运行时（自动安装）

## 使用方法

### 基本导航
1. 启动应用程序
2. 自动扫描 `~/.claude` 查找对话数据
3. 在左侧边栏树中浏览项目
4. 点击任何会话查看消息
5. 使用顶部标签在以下视图之间切换:
   - **Messages**: 阅读完整对话
   - **Analytics**: 查看活动热力图和模式
   - **Token Stats**: 分析 token 使用情况

### 搜索功能
- 按 **Cmd+F**（macOS）或 **Ctrl+F**（Windows/Linux）打开搜索
- 输入查询并按 Enter
- 使用引号进行精确短语: `"错误消息"`
- 单击任何结果直接跳转到上下文中的消息
- 结果按会话分组，带可展开预览

### 键盘快捷键
- **Cmd/Ctrl+F**: 打开搜索
- **ESC**: 清除选择或关闭搜索
- **点击会话**: 加载对话
- **X 按钮**: 清除当前选择

### 主题和语言
- 主题自动匹配系统偏好（浅色/深色）
- 语言从系统区域设置自动检测
- 可通过设置菜单（右上角）更改

## 当前限制

- **测试版软件** - 可能存在粗糙边缘和偶尔的错误
- 大型对话历史（10,000+ 条消息）初始加载可能需要一些时间
- 只读访问 - 无法从应用程序编辑或删除对话
- 尚无导出功能（计划在未来版本中推出）

## 数据隐私

完全在本地运行。不向任何服务器发送数据。应用程序仅读取您的 `~/.claude` 目录。

## Claude 目录结构

应用程序期望此结构:

```
~/.claude/
├── projects/          # 项目对话
│   └── [project-name]/
│       └── *.jsonl    # 对话文件
├── ide/              # IDE 数据
├── statsig/          # 分析数据
└── todos/            # 待办事项列表
```

## 故障排除

**"未找到 Claude 数据"**:
- 确保您至少使用过一次 Claude Code 创建对话历史
- 检查主文件夹中是否存在 `~/.claude` 目录
- **macOS/Linux**: `ls ~/.claude`
- **Windows**: 检查 `C:\Users\<您的用户名>\.claude`

**性能问题**:
- 大型会话（1,000+ 条消息）使用虚拟滚动实现流畅性能
- 如果加载感觉缓慢，请先尝试选择较小的会话
- 如需要，请关闭其他应用程序以释放内存

**搜索不工作**:
- 确保您输入了查询并按了 Enter
- 尝试使用引号引起的短语进行精确匹配: `"特定错误"`
- 检查您搜索的会话是否包含文本

**特定平台问题**:
- **Windows**: 如果应用程序无法启动，请确保已安装 WebView2（通常自动安装）
- **Linux**: 如果看到 webkit 相关错误，请安装 WebKitGTK: `sudo apt install libwebkit2gtk-4.1-dev`
- **macOS**: 如果收到安全警告，请右键单击应用程序并选择"打开"

**更新问题**: 如果自动更新失败，请从 [Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases) 手动下载最新版本。

## 贡献

欢迎贡献！以下是您可以提供帮助的方式:

**错误报告**:
- 在 [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues) 上开启 issue
- 包括您的操作系统、应用程序版本和重现步骤
- 截图或错误消息很有帮助

**功能请求**:
- 首先检查现有 issue 以避免重复
- 描述用例和预期行为
- 如果可以实现，请考虑提交 PR

**Pull Request**:
- Fork 存储库并创建功能分支
- 遵循现有代码风格（已配置 ESLint）
- 如可能，为新功能添加测试
- 如果添加新功能或更改架构，请更新 CLAUDE.md
- 提交前在平台上测试

**开发设置**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:dev  # 启动带热重载的开发服务器
```

有关详细的架构文档、开发命令和实现说明，请参见 [CLAUDE.md](CLAUDE.md)。

**贡献者**:
感谢为此项目做出贡献的每个人！特别感谢:
- 原始概念和初始开发
- 搜索 UI 实现和改进
- E2E 测试基础设施
- 多平台支持和国际化
- 以及所有错误报告者和功能请求者

## 技术栈

**核心**:
- **Tauri v2** - 带 Rust 后端的轻量级原生 shell（2-10MB 占用空间）
- **React 19** - 带钩子和函数组件的现代前端
- **TypeScript** - 类型安全开发

**UI 和样式**:
- **Tailwind CSS v4** - 带 Claude 品牌色的实用优先样式
- **Radix UI** - 可访问的无样式组件原语
- **Lucide React** - 精美图标库
- **Prism** - 代码块语法高亮

**状态和数据**:
- **Zustand** - 轻量级状态管理
- **i18next** - 6 种语言的国际化
- **@tanstack/react-virtual** - 性能虚拟滚动

**构建和工具**:
- **Vite** - 快速构建工具和开发服务器
- **Vitest** - 单元测试框架
- **Playwright** - Tauri 应用的 E2E 测试
- **ESLint** - 代码检查和质量

**平台功能**:
- **Tauri 插件**: Store、Dialog、Updater、OS、Process、HTTP
- **GitHub Actions** - 自动化多平台构建和发布

## 许可证

MIT 许可证 - 请参见 [LICENSE](LICENSE) 文件。

---

**有问题或疑问？** 请使用您的设置详细信息和出错内容[开启 issue](https://github.com/ndokutovich/claude-code-history-viewer/issues)。
