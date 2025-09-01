import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as vscode from "vscode";
import { createReadFileTool } from "../tools/readFileTool";
import { createReadFileCodeTool } from "../tools/readFileCodeTool";
import { getSessionApiKey } from "../config"; 

const getApiKeyForLLM = (): string => {
  const apiKey = getSessionApiKey();

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "OpenAI API key not available in session. Please restart the extension or set the API key."
    );
  }

  return apiKey;
};

const createLLMInstance = (): ChatOpenAI => {
  const apiKey = getApiKeyForLLM();
  console.log("Using OpenAI API key from session");
  const model = new ChatOpenAI({
    apiKey,
    model: "gpt-5-mini-2025-08-07",
    reasoning: {
      summary: "auto",
      effort: "high",
    },
  });

  return model;
};

const createTools = (): DynamicStructuredTool[] => {
  return [createReadFileTool(), createReadFileCodeTool()];
};

const createPromptTemplate = (): ChatPromptTemplate => {
  return ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a software development assistant that helps analyze codebases and plan task execution.

Your workflow should be:
1. **First**, use the read_file_structure tool to understand the overall codebase organization
2. **Then**, identify which specific files are most relevant for the user's task
3. **Next**, use the read_file_code tool to examine the actual content of those relevant files
4. **Finally**, provide a comprehensive action plan

You have access to these tools:
- read_file_structure: Gets the complete file/directory structure of the workspace
- read_file_code: Reads the actual content of specific files (up to 10 files per call)

Guidelines for tool usage:
- You can call tools multiple times as needed (up to 8 total calls)
- Start with file structure, then read relevant code files
- If you discover you need more files after reading initial ones, call read_file_code again
- Be strategic about which files to read first (start with main/entry points)
- You can re-examine file structure if you need to find additional files
- Don’t provide generic answer texts like “Hey, I will work upon these” or “Here is my explanation.” Just directly provide the planning, no irrelevant text.

Response format should include:

1. Specific action plan with file modifications needed
2. You don;t have to write a code you just have to provide a step by step action plan which can be used in any task executor gent like cursor or github co pilot.
3. Just proide the file name in heading and suggest the changes needed to be done.
4. Recommended implementation order
5. After everyhting provide a mermaid diagram of the changes needed to be done.
Be thorough but focused. Use your reasoning capabilities to think through the task step by step.`,
    ],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
};

const createAgentExecutor = (): AgentExecutor => {
  const llm = createLLMInstance();
  const tools = createTools();
  const prompt = createPromptTemplate();

  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
    maxIterations: 8,
    verbose: true,
    returnIntermediateSteps: true,
    handleParsingErrors: true,
  });
};

// Main function to analyze task
export const analyzeCodebaseTask = async (taskQuery: string) => {
  try {
    console.log("🤖 Initializing codebase agent...");

    const agentExecutor = createAgentExecutor();

    console.log("📝 Executing task analysis:", taskQuery);

    const result = await agentExecutor.invoke({
      input: taskQuery,
      chat_history: [],
    });

    console.log("✅ Analysis completed successfully");
    return result.output || "No response generated from the agent";
  } catch (error) {
    console.error("❌ Agent execution error:", error);

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        throw new Error("OpenAI API key issue: " + error.message);
      } else if (error.message.includes("workspace")) {
        throw new Error("Workspace access issue: " + error.message);
      } else {
        throw new Error("Agent execution failed: " + error.message);
      }
    }

    throw new Error("Unknown error occurred during analysis");
  }
};

export const validateConfiguration = (): {
  valid: boolean;
  message: string;
} => {
  try {

    if (!vscode.workspace.workspaceFolders) {
      return { valid: false, message: "No workspace folder is open" };
    }

    return { valid: true, message: "Configuration is valid" };
  } catch (error) {
    return {
      valid: false,
      message:
        error instanceof Error
          ? error.message
          : "Configuration validation failed",
    };
  }
};
