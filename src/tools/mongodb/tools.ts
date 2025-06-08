import { ConnectTool } from "./metadata/connect.js";
import { ListCollectionsTool } from "./metadata/listCollections.js";
import { CollectionIndexesTool } from "./read/collectionIndexes.js";
import { ListDatabasesTool } from "./metadata/listDatabases.js";
// import { CollectionSchemaTool } from "./metadata/collectionSchema.js";
import { FindTool } from "./read/find.js";
// import { CollectionStorageSizeTool } from "./metadata/collectionStorageSize.js";
import { CountTool } from "./read/count.js";
import { DbStatsTool } from "./metadata/dbStats.js";
import { AggregateTool } from "./read/aggregate.js";
// import { ExplainTool } from "./metadata/explain.js";
// import { LogsTool } from "./metadata/logs.js";

export const MongoDbTools = [
    // 连接工具
    ConnectTool,
    
    // 元数据查询工具
    ListDatabasesTool,
    ListCollectionsTool,
    // CollectionSchemaTool,
    // CollectionStorageSizeTool,
    DbStatsTool,
    // ExplainTool,
    // LogsTool,
    
    // 读取查询工具
    FindTool,
    CountTool,
    AggregateTool,
    CollectionIndexesTool,
];
