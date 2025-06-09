FROM node:23.11.1-alpine

WORKDIR /app

# 复制所有源代码（除了.dockerignore中排除的）
COPY . .

# 安装依赖（包括devDependencies用于构建）
RUN npm ci --registry=http://registry.npmmirror.com

# 单独安装mcp-proxy（避免与项目依赖冲突）
RUN npm i --global --registry=http://registry.npmmirror.com mcp-proxy

ENV PORT=8000
ENV MDB_MCP_CONNECTION_STRING=mongodb://chatbi:chatbi@10.10.1.105:27017/ChatBI
ENV MDB_DB=ChatBI

# 使用本地构建的版本
CMD mcp-proxy --port ${PORT} node dist/index.js