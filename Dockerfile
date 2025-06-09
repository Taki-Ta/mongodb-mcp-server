FROM node:23.11.1-alpine AS builder

WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装所有依赖（包括devDependencies用于构建）
RUN npm ci --registry=http://registry.npmmirror.com

# 复制源代码
COPY . .

# 构建TypeScript
RUN npm run build

# 生产阶段
FROM node:23.11.1-alpine AS production

WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production --registry=http://registry.npmmirror.com && \
    npm cache clean --force

# 全局安装mcp-proxy
RUN npm i --global --registry=http://registry.npmmirror.com mcp-proxy

# 从构建阶段复制构建好的文件
COPY --from=builder /app/dist ./dist

# 设置环境变量
ENV PORT=8000
ENV MDB_MCP_CONNECTION_STRING=mongodb://chatbi:chatbi@10.10.1.105:27017/ChatBI
ENV MDB_DB=ChatBI

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# 使用本地构建的版本
CMD mcp-proxy --port ${PORT} node dist/index.js