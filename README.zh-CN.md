# Claude Code History Viewer

<p style="center">
  <img src="https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg" alt="Version 1.0.0-beta.3" />
  <img src="https://img.shields.io/badge/Built%20with-Tauri%202.6.1%20+%20React%2019.1.0-blue.svg" alt="Built with Tauri 2.6.1 and React 19.1.0" />
  <img src="https://img.shields.io/badge/Platform-macOS-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Languages-Multi--lingual-blueviolet.svg" alt="Multi-lingual UI" />
</p>

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

一个用于浏览和分析本地存储在`~/.claude`目录中的 Claude Code 对话历史的桌面应用程序。

> ⚠️ **测试版提醒**: 此应用程序目前处于测试阶段。功能和 API 可能会发生变化。

## 功能

### 核心功能

- 📁 **浏览项目和会话** - 浏览所有 Claude Code 项目和对话会话
- 🎨 **语法高亮** - 使用 react-syntax-highlighter 美观地高亮显示代码块
- 🌲 **树状视图导航** - 可展开树结构的直观项目/会话层次结构
- ⚡ **快速性能** - 使用 Rust 后端进行高效的文件解析和搜索
- 🖥️ **macOS 原生** - 使用 Tauri 为 macOS 构建的优化桌面应用程序

### 分析和统计

- 📊 **综合分析仪表板** - 查看带有交互式图表的详细使用分析
- 📈 **令牌使用统计** - 跟踪每个项目和会话的令牌使用情况及增长率
- 🔥 **活动热力图** - 可视化您随时间变化的交互模式
- 📊 **会话比较** - 比较不同会话之间的指标
- 📉 **工具使用分析** - 查看最常用的工具

### 高级功能

- 🔄 **自动更新系统** - 具有优先级（关键、推荐、可选）的自动更新检查
- 💭 **思考内容显示** - 以格式化块的形式查看 Claude 的推理过程
- 📃 **高效消息加载** - 通过分页处理大型对话历史
- 🔄 **会话刷新** - 无需重启即可刷新会话查看新消息
- 📝 **会话摘要** - AI 生成的摘要便于快速会话概览

### 内容渲染

- 🖼️ **图像支持** - 查看对话中嵌入的图像
- 📝 **增强 Diff 查看器** - 改进的逐行文件更改比较
- 🚀 **丰富的工具结果** - 各种工具输出的美观渲染（网络搜索、git 工作流、终端流等）

## 安装

### 下载预构建二进制文件

访问[Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases)页面下载适用于您平台的最新版本。

### 从源代码构建

#### 先决条件

- [Node.js](https://nodejs.org/) (v18 或更高版本)
- [pnpm](https://pnpm.io/) 包管理器 (v8+)
- [Rust](https://www.rust-lang.org/) 工具链 (最新稳定版)
- **macOS**: Xcode Command Line Tools

#### 构建

```bash
# 克隆仓库
git clone https://github.com/jhlee0409/claude-code-history-viewer.git
cd claude-code-history-viewer

# 安装依赖
pnpm install

# 在开发模式下运行
pnpm tauri:dev

# 构建生产版本
pnpm tauri:build
```

构建的应用程序将位于`src-tauri/target/release/bundle/`中。

## 使用方法

1. 启动应用程序
2. 应用会自动扫描您的`~/.claude`目录中的对话历史
3. 使用左侧边栏浏览项目和会话
4. 点击任何会话查看其消息
5. 查看分析仪表板了解您的使用模式
6. 通过自动更新系统检查更新

## 贡献

欢迎贡献！请提交 Pull Request。

## Claude 目录结构

应用从以下位置读取对话数据：

```text
~/.claude/
├── projects/          # 项目特定的对话数据
│   └── [project-name]/
│       └── *.jsonl    # 包含对话消息的JSONL文件
├── ide/              # IDE相关数据
├── statsig/          # 统计/分析数据
└── todos/            # 待办事项数据
```

## 故障排除

### 常见问题

**应用找不到 Claude 数据**

- 确保您已安装 Claude Code 并有一些对话历史
- 检查`~/.claude`目录是否存在并包含项目数据

**大型历史记录的性能问题**

- 应用对长消息列表使用虚拟化
- 如果性能下降，请考虑归档旧对话

## 隐私

此应用程序完全在本地运行，不会向外部服务器发送任何数据。所有对话数据都保留在您的计算机上。

## 许可证

此项目根据 MIT 许可证授权 - 有关详细信息，请参阅[LICENSE](LICENSE)文件。

## 技术栈

- 使用[Tauri](https://tauri.app/) + React + TypeScript 构建
- UI: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)

## 支持

如果遇到问题，请[创建 issue](https://github.com/jhlee0409/claude-code-history-viewer/issues)并提供详细信息。

---
