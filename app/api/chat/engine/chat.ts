import {
  BaseChatEngine,
  BaseToolWithCall,
  LLMAgent,
  QueryEngineTool
} from "llamaindex";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataSource } from "./index";
import { generateFilters } from "./queryFilter";
import { createTools } from "./tools";

export async function createChatEngine(documentIds?: string[], params?: any) {
  const tools: BaseToolWithCall[] = [];

  // Add a query engine tool if we have a data source
  // Delete this code if you don't have a data source
  const index = await getDataSource(params);
  if (index) {
    tools.push(
      new QueryEngineTool({
        queryEngine: index.asQueryEngine({
          retriever: index.asRetriever({
            // FIXME: Cannot read properties of undefined (reading 'SEMANTIC_HYBRID')
            // mode: VectorStoreQueryMode.SEMANTIC_HYBRID,
            mode: "semantic_hybrid" as any,
            similarityTopK: 5,
          }),
          preFilters: generateFilters(documentIds || [])
        }),
        metadata: {
          name: "data_query_engine",
          description: `A query engine for documents from your data source.`,
        },
      }),
    );
  }

  const configFile = path.join("config", "tools.json");
  let toolConfig: any;
  try {
    // add tools from config file if it exists
    toolConfig = JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch (e) {
    console.info(`Could not read ${configFile} file. Using no tools.`);
  }
  if (toolConfig) {
    tools.push(...(await createTools(toolConfig)));
  }
  const systemPrompt = process.env.LLAMAINDEX_SYSTEM_PROMPT;

  const agent = new LLMAgent({
    tools,
    verbose: true,
    systemPrompt,
  }) as unknown as BaseChatEngine;

  return agent;
}
