# MongoDB MCP Server

A Model Context Protocol server for interacting with MongoDB Databases and MongoDB Atlas.

## 📚 Table of Contents

- [🚀 Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
    - [Quick Start](#quick-start)
- [🛠️ Supported Tools](#supported-tools)
  - [MongoDB Atlas Tools](#mongodb-atlas-tools)
  - [MongoDB Database Tools](#mongodb-database-tools)
- [⚙️ Configuration](#configuration)
  - [Configuration Options](#configuration-options)
  - [Atlas API Access](#atlas-api-access)
  - [Configuration Methods](#configuration-methods)
    - [Environment Variables](#environment-variables)
    - [Command-Line Arguments](#command-line-arguments)
    - [MCP Client Configuration](#mcp-configuration-file-examples)
- [🤝 Contributing](#contributing)

## Prerequisites

- Node.js (v20 or later)

```shell
node -v
```

- A MongoDB connection string or Atlas API credentials, **_the Server will not start unless configured_**.
  - **_Service Accounts Atlas API credentials_** are required to use the Atlas tools. You can create a service account in MongoDB Atlas and use its credentials for authentication. See [Atlas API Access](#atlas-api-access) for more details.
  - If you have a MongoDB connection string, you can use it directly to connect to your MongoDB instance.

## Setup

### Quick Start

Most MCP clients require a configuration file to be created or modified to add the MCP server.

Note: The configuration file syntax can be different across clients. Please refer to the following links for the latest expected syntax:

- **Windsurf**:https://docs.windsurf.com/windsurf/mcp
- **VSCode**: https://code.visualstudio.com/docs/copilot/chat/mcp-servers
- **Claude Desktop**: https://modelcontextprotocol.io/quickstart/user
- **Cursor**: https://docs.cursor.com/context/model-context-protocol

#### 🐳 Docker 部署

我们提供预构建的Docker镜像，可以通过GitHub Actions下载：

**下载镜像：**
1. 访问 [GitHub Actions](../../actions/workflows/docker-build.yml) 页面
2. 选择最新的构建运行记录
3. 在 "Artifacts" 部分下载 `mongodb-mcp-server-{version}-amd64.tar.gz`

**使用方法：**
```bash
# 解压并加载镜像
gunzip mongodb-mcp-server-{version}-amd64.tar.gz
docker load -i mongodb-mcp-server-{version}-amd64.tar

# 运行容器
docker run -d -p 8000:8000 \
  -e MDB_MCP_CONNECTION_STRING="mongodb+srv://username:password@cluster.mongodb.net/myDatabase" \
  -e MDB_DB="myDatabase" \
  mongodb-mcp-server:latest

# 或使用Atlas API凭据
docker run -d -p 8000:8000 \
  -e MDB_MCP_API_CLIENT_ID="your-client-id" \
  -e MDB_MCP_API_CLIENT_SECRET="your-client-secret" \
  mongodb-mcp-server:latest
```

**Docker环境变量：**
- `PORT`: 服务端口 (默认: 8000)
- `MDB_MCP_CONNECTION_STRING`: MongoDB连接字符串
- `MDB_DB`: 默认数据库名称 (默认: ChatBI)
- `MDB_MCP_API_CLIENT_ID`: Atlas API客户端ID
- `MDB_MCP_API_CLIENT_SECRET`: Atlas API客户端密钥

#### Option 1: Connection String args

You can pass your connection string via args, make sure to use a valid username and password.

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "npx",
      "args": [
        "-y",
        "mongodb-mcp-server",
        "--connectionString",
        "mongodb+srv://username:password@cluster.mongodb.net/myDatabase"
      ]
    }
  }
}
```

#### Option 2: Atlas API credentials args

Use your Atlas API Service Accounts credentials. Must follow all the steps in [Atlas API Access](#atlas-api-access) section.

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "npx",
      "args": [
        "-y",
        "mongodb-mcp-server",
        "--apiClientId",
        "your-atlas-service-accounts-client-id",
        "--apiClientSecret",
        "your-atlas-service-accounts-client-secret"
      ]
    }
  }
}
```

### Option 3: Standalone Service using command arguments

Start Server using npx command:

```shell
 npx -y mongodb-mcp-server --apiClientId="your-atlas-service-accounts-client-id" --apiClientSecret="your-atlas-service-accounts-client-secret"
```

- For a complete list of arguments see [Configuration Options](#configuration-options)
- To configure your Atlas Service Accounts credentials please refer to [Atlas API Access](#atlas-api-access)

#### Option 4: Standalone Service using environment variables

```shell
 npx -y mongodb-mcp-server
```

You can use environment variables in the config file or set them and run the server via npx.

- Connection String via environment variables in the MCP file [example](#connection-string-with-environment-variables)
- Atlas API credentials via environment variables in the MCP file [example](#atlas-api-credentials-with-environment-variables)

## 🛠️ Supported Tools

### Tool List

#### MongoDB Atlas Tools

- `atlas-list-orgs` - Lists MongoDB Atlas organizations
- `atlas-list-projects` - Lists MongoDB Atlas projects
- `atlas-create-project` - Creates a new MongoDB Atlas project
- `atlas-list-clusters` - Lists MongoDB Atlas clusters
- `atlas-inspect-cluster` - Inspect a specific MongoDB Atlas cluster
- `atlas-create-free-cluster` - Create a free MongoDB Atlas cluster
- `atlas-connect-cluster` - Connects to MongoDB Atlas cluster
- `atlas-inspect-access-list` - Inspect IP/CIDR ranges with access to MongoDB Atlas clusters
- `atlas-create-access-list` - Configure IP/CIDR access list for MongoDB Atlas clusters
- `atlas-list-db-users` - List MongoDB Atlas database users
- `atlas-create-db-user` - List MongoDB Atlas database users

NOTE: atlas tools are only available when you set credentials on [configuration](#configuration) section.

#### MongoDB Database Tools

- `connect` - Connect to a MongoDB instance
- `find` - Run a find query against a MongoDB collection
- `aggregate` - Run an aggregation against a MongoDB collection
- `count` - Get the number of documents in a MongoDB collection
- `insert-one` - Insert a single document into a MongoDB collection
- `insert-many` - Insert multiple documents into a MongoDB collection
- `create-index` - Create an index for a MongoDB collection
- `update-one` - Update a single document in a MongoDB collection
- `update-many` - Update multiple documents in a MongoDB collection
- `rename-collection` - Rename a MongoDB collection
- `delete-one` - Delete a single document from a MongoDB collection
- `delete-many` - Delete multiple documents from a MongoDB collection
- `drop-collection` - Remove a collection from a MongoDB database
- `drop-database` - Remove a MongoDB database
- `list-databases` - List all databases for a MongoDB connection
- `list-collections` - List all collections for a given database
- `collection-indexes` - Describe the indexes for a collection
- `collection-schema` - Describe the schema for a collection
- `collection-storage-size` - Get the size of a collection in MB
- `db-stats` - Return statistics about a MongoDB database

## Configuration

The MongoDB MCP Server can be configured using multiple methods, with the following precedence (highest to lowest):

1. Command-line arguments
2. Environment variables

### Configuration Options

| Option             | Description                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `apiClientId`      | Atlas API client ID for authentication                                                                                |
| `apiClientSecret`  | Atlas API client secret for authentication                                                                            |
| `connectionString` | MongoDB connection string for direct database connections (optional users may choose to inform it on every tool call) |
| `defaultDatabase`  | Default database name for MongoDB operations. Can be set via `--database` arg or `MDB_DB`/`MDB_MCP_DEFAULT_DATABASE` env vars. Defaults to "ChatBI" |
| `logPath`          | Folder to store logs                                                                                                  |
| `disabledTools`    | An array of tool names, operation types, and/or categories of tools that will be disabled                             |
| `readOnly`         | When set to true, only allows read and metadata operation types, disabling create/update/delete operations            |
| `telemetry`        | When set to disabled, disables telemetry collection                                                                   |

#### Log Path

Default log location is as follows:

- Windows: `%LOCALAPPDATA%\mongodb\mongodb-mcp\.app-logs`
- macOS/Linux: `~/.mongodb/mongodb-mcp/.app-logs`

#### Disabled Tools

You can disable specific tools or categories of tools by using the `disabledTools` option. This option accepts an array of strings,
where each string can be a tool name, operation type, or category.

The way the array is constructed depends on the type of configuration method you use:

- For **environment variable** configuration, use a comma-separated string: `export MDB_MCP_DISABLED_TOOLS="create,update,delete,atlas,collectionSchema"`.
- For **command-line argument** configuration, use a space-separated string: `--disabledTools create update delete atlas collectionSchema`.

Categories of tools:

- `atlas` - MongoDB Atlas tools, such as list clusters, create cluster, etc.
- `mongodb` - MongoDB database tools, such as find, aggregate, etc.

Operation types:

- `create` - Tools that create resources, such as create cluster, insert document, etc.
- `update` - Tools that update resources, such as update document, rename collection, etc.
- `delete` - Tools that delete resources, such as delete document, drop collection, etc.
- `read` - Tools that read resources, such as find, aggregate, list clusters, etc.
- `metadata` - Tools that read metadata, such as list databases, list collections, collection schema, etc.

#### Read-Only Mode

The `readOnly` configuration option allows you to restrict the MCP server to only use tools with "read" and "metadata" operation types. When enabled, all tools that have "create", "update" or "delete" operation types will not be registered with the server.

This is useful for scenarios where you want to provide access to MongoDB data for analysis without allowing any modifications to the data or infrastructure.

You can enable read-only mode using:

- **Environment variable**: `export MDB_MCP_READ_ONLY=true`
- **Command-line argument**: `--readOnly`

When read-only mode is active, you'll see a message in the server logs indicating which tools were prevented from registering due to this restriction.

#### Database Restriction

The `defaultDatabase` configuration option allows you to restrict the MCP server to operate only on a specific database. When configured, all database tools will use the specified database by default, and the `list-databases` tool is disabled to prevent discovery of other databases.

This is useful for scenarios where you want to limit access to a specific database for security or operational reasons.

You can set the default database using:

- **Environment variable**: `export MDB_DB=ChatBI` or `export MDB_MCP_DEFAULT_DATABASE=ChatBI`
- **Command-line argument**: `--database ChatBI`
- **Docker environment variable**: `-e MDB_DB=ChatBI`

When a default database is configured:
- All database operations will use this database unless explicitly overridden in the tool arguments
- The `list-databases` tool is disabled to prevent database discovery
- Users can still specify a different database name in individual tool calls if needed

#### Telemetry

The `telemetry` configuration option allows you to disable telemetry collection. When enabled, the MCP server will collect usage data and send it to MongoDB.

You can disable telemetry using:

- **Environment variable**: `export MDB_MCP_TELEMETRY=disabled`
- **Command-line argument**: `--telemetry disabled`
- **DO_NOT_TRACK environment variable**: `export DO_NOT_TRACK=1`

### Atlas API Access

To use the Atlas API tools, you'll need to create a service account in MongoDB Atlas:

1. **Create a Service Account:**

   - Log in to MongoDB Atlas at [cloud.mongodb.com](https://cloud.mongodb.com)
   - Navigate to Access Manager > Organization Access
   - Click Add New > Applications > Service Accounts
   - Enter name, description and expiration for your service account (e.g., "MCP, MCP Server Access, 7 days")
   - Select appropriate permissions (for full access, use Organization Owner)
   - Click "Create"

To learn more about Service Accounts, check the [MongoDB Atlas documentation](https://www.mongodb.com/docs/atlas/api/service-accounts-overview/).

2. **Save Client Credentials:**

   - After creation, you'll be shown the Client ID and Client Secret
   - **Important:** Copy and save the Client Secret immediately as it won't be displayed again

3. **Add Access List Entry:**

   - Add your IP address to the API access list

4. **Configure the MCP Server:**
   - Use one of the configuration methods below to set your `apiClientId` and `apiClientSecret`

### Configuration Methods

#### Environment Variables

Set environment variables with the prefix `MDB_MCP_` followed by the option name in uppercase with underscores:

```shell
# Set Atlas API credentials (via Service Accounts)
export MDB_MCP_API_CLIENT_ID="your-atlas-service-accounts-client-id"
export MDB_MCP_API_CLIENT_SECRET="your-atlas-service-accounts-client-secret"

# Set a custom MongoDB connection string
export MDB_MCP_CONNECTION_STRING="mongodb+srv://username:password@cluster.mongodb.net/myDatabase"

# Set default database for operations (limits MCP to only use this database)
export MDB_MCP_DEFAULT_DATABASE="ChatBI"
# Or alternatively, use the shorter form:
export MDB_DB="ChatBI"

export MDB_MCP_LOG_PATH="/path/to/logs"

```

#### MCP configuration file examples

##### Connection String with environment variables

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb+srv://username:password@cluster.mongodb.net/myDatabase"
      }
    }
  }
}
```

##### Atlas API credentials with environment variables

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server"],
      "env": {
        "MDB_MCP_API_CLIENT_ID": "your-atlas-service-accounts-client-id",
        "MDB_MCP_API_CLIENT_SECRET": "your-atlas-service-accounts-client-secret"
      }
    }
  }
}
```

#### Command-Line Arguments

Pass configuration options as command-line arguments when starting the server:

```shell
npx -y mongodb-mcp-server --apiClientId="your-atlas-service-accounts-client-id" --apiClientSecret="your-atlas-service-accounts-client-secret" --connectionString="mongodb+srv://username:password@cluster.mongodb.net/myDatabase" --database="ChatBI" --logPath=/path/to/logs
```

#### MCP configuration file examples

##### Connection String with command-line arguments

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "npx",
      "args": [
        "-y",
        "mongodb-mcp-server",
        "--connectionString",
        "mongodb+srv://username:password@cluster.mongodb.net/myDatabase"
      ]
    }
  }
}
```

##### Atlas API credentials with command-line arguments

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "npx",
      "args": [
        "-y",
        "mongodb-mcp-server",
        "--apiClientId",
        "your-atlas-service-accounts-client-id",
        "--apiClientSecret",
        "your-atlas-service-accounts-client-secret"
      ]
    }
  }
}
```

## 🤝 Contributing

Interested in contributing? Great! Please check our [Contributing Guide](CONTRIBUTING.md) for guidelines on code contributions, standards, adding new tools, and troubleshooting information.
