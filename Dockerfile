FROM node:23.11.1-alpine

WORKDIR /app
RUN npm i --registry=http://registry.npmmirror.com mcp-proxy mongodb-mcp-server
ENV PORT=8000
ENV MDB_MCP_CONNECTION_STRING=mongodb://gw:123.zxc@10.10.1.105:27017/ChatBI
CMD npx mcp-proxy --port ${PORT} mongodb-mcp-server