# Claude Code History Viewer

用于浏览 Claude Code 对话历史(`~/.claude`)的桌面应用程序。

![Version](https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg)
![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

> ⚠️ **测试版软件** - 可能不稳定或有变化

## 开发缘由

Claude Code 将对话历史保存在 `~/.claude/projects/` 文件夹的 JSONL 文件中。这些文件难以阅读和搜索，因此开发了这个应用程序，提供合适的界面来查看对话和使用统计。

## 截图和演示

### 主界面

浏览项目并查看带有语法高亮代码块的对话

<p align="center">
  <img width="49%" alt="Main Interface 1" src="https://github.com/user-attachments/assets/45719832-324c-40c3-8dfe-5c70ddffc0a9" />
  <img width="49%" alt="Main Interface 2" src="https://github.com/user-attachments/assets/bb9fbc9d-9d78-4a95-a2ab-a1b1b763f515" />
</p>

### 分析仪表板

活动热力图和工具使用统计，了解您的使用模式

<img width="720" alt="Analytics Dashboard" src="https://github.com/user-attachments/assets/77dc026c-8901-47d1-a8ca-e5235b97e945" />

### 令牌统计

每个项目的令牌使用量细分和会话级分析

<img width="720" alt="Token Statistics" src="https://github.com/user-attachments/assets/ec5b17d0-076c-435e-8cec-1c6fd74265db" />

### 演示

<img width="720" alt="Demo" src="https://github.com/user-attachments/assets/d3ea389e-a912-433e-b6e2-2e895eaa346d" />

## 主要功能

**浏览对话**: 左侧显示项目树，右侧显示对话内容。

**搜索和筛选**: 在整个对话历史中查找特定对话或消息。

**使用分析**: 查看最常用的项目、时间段内的令牌使用量、活动模式等。有助于了解您的 Claude Code 使用习惯。

**更好的阅读体验**: 代码块语法高亮、格式化差异对比、可读的消息线程，比原始 JSONL 文件更易读。

**工具输出可视化**: 网络搜索结果、git 操作、终端输出等以可读格式显示。

应用程序可以无卡顿处理大型对话历史，并在添加新对话时自动刷新。

## 安装

### 下载

从 [Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases) 获取最新版本。

### 从源码构建

```bash
git clone https://github.com/jhlee0409/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:build
```

**要求**: Node.js 18+、pnpm、Rust 工具链、Xcode Command Line Tools (macOS)

## 使用方法

1. 启动应用程序
2. 自动扫描 `~/.claude` 查找对话数据
3. 在左侧边栏浏览项目
4. 点击会话查看消息
5. 在分析选项卡查看使用统计

## 当前限制

- **仅支持 macOS**（计划支持 Windows/Linux）
- **测试版软件** - 可能存在一些问题
- 大型对话历史（数千条消息）初始加载可能较慢
- 自动更新系统仍在测试中

## 数据隐私

完全在本地运行。不向服务器发送数据，仅读取您的 `~/.claude` 目录。

## Claude 目录结构

应用程序期望以下结构：

```
~/.claude/
├── projects/          # 项目对话
│   └── [project-name]/
│       └── *.jsonl    # 对话文件
├── ide/              # IDE 数据
├── statsig/          # 分析数据
└── todos/            # 待办事项
```

## 故障排除

**"未找到 Claude 数据"**: 确保您已使用 Claude Code 并有对话历史。检查 `~/.claude` 是否存在。

**性能问题**: 如果对话历史很大，尝试关闭其他应用程序。目前将所有数据加载到内存中。

**更新问题**: 测试版自动更新器可能不稳定。如有问题请手动下载。

## 贡献

欢迎 Pull Request。这是个人项目，回复可能会有延迟。

## 技术栈

使用 Tauri (Rust + React) 构建。界面使用 Tailwind CSS 和 Radix 组件。

## 许可证

MIT 许可证 - 见 [LICENSE](LICENSE) 文件。

---

**有问题或疑问？** 请详细描述您的设置和遇到的问题，[创建 issue](https://github.com/jhlee0409/claude-code-history-viewer/issues)。
