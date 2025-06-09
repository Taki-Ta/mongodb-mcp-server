# GitHub Actions 说明

## Docker 镜像构建 Workflow

本项目包含一个自动化的 GitHub Action workflow，用于构建 MongoDB MCP Server 的 Docker 镜像。

### 触发条件

该 workflow 会在以下情况下自动运行：

1. **推送到主分支**: `main`, `master`, `develop`
2. **创建标签**: 以 `v` 开头的标签（如 `v1.0.0`）
3. **Pull Request**: 针对 `main` 或 `master` 分支的 PR
4. **手动触发**: 通过 GitHub 界面手动运行

### 构建产物

每次构建完成后，会生成以下文件：

- **Docker 镜像**: `mongodb-mcp-server-{version}-amd64.tar.gz`
- **使用说明**: `download-instructions-{version}.md`
- **发布说明**: `release-notes-{version}.md` (仅在标签发布时)

### 下载方式

1. 访问 [GitHub Actions](../../actions) 页面
2. 选择最新的 "Build Docker Image" workflow 运行
3. 在 "Artifacts" 部分下载所需文件

### 使用方法

#### 1. 下载并加载镜像

```bash
# 解压镜像文件
gunzip mongodb-mcp-server-{version}-amd64.tar.gz

# 加载到 Docker
docker load -i mongodb-mcp-server-{version}-amd64.tar
```

#### 2. 运行容器

```bash
docker run -d -p 8000:8000 \
  -e MDB_MCP_CONNECTION_STRING="mongodb://user:pass@host:port/database" \
  -e MDB_DB="your_database_name" \
  mongodb-mcp-server:{version}
```

### 环境变量

- `PORT`: 服务端口 (默认: 8000)
- `MDB_MCP_CONNECTION_STRING`: MongoDB 连接字符串
- `MDB_DB`: 默认数据库名称 (默认: ChatBI)

### 镜像特性

- **架构**: linux/amd64
- **基础镜像**: node:23.11.1-alpine
- **多阶段构建**: 优化镜像大小
- **健康检查**: 内置健康检查机制
- **生产优化**: 仅包含生产依赖

### 版本管理

- **标签发布**: 使用 git 标签版本号
- **主分支**: 使用 `main-{commit_hash}` 格式
- **其他分支**: 使用 `{branch_name}-{commit_hash}` 格式

### 自动化功能

- **PR 评论**: 在 PR 中自动添加下载链接和使用说明
- **缓存机制**: 使用 GitHub Actions 缓存加速构建
- **文件压缩**: 自动压缩镜像文件减小下载体积
- **多环境支持**: 支持不同分支和标签的构建 