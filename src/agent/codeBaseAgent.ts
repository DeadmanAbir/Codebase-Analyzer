import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as vscode from "vscode";
import { createReadFileTool } from "../tools/readFileTool";
import { z } from "zod";
import { createReadFileCodeTool } from "../tools/readFileCodeTool";
import { getCachedApiKeySync } from "../config"; // <-- use cached key

// Helper function to get OpenAI API key from cached storage
const getOpenAIApiKey = (): string => {
  const apiKey = getCachedApiKeySync();

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      'OpenAI API key not configured. Please run the command "AI Codebase Analyzer: Set OpenAI API Key".'
    );
  }

  return apiKey;
};

const createLLMInstance = (): ChatOpenAI => {
  const apiKey = getOpenAIApiKey();

  const model = new ChatOpenAI({
    apiKey,
    model: "gpt-5-mini-2025-08-07",
    reasoning: {
      summary: "auto",
      effort: "high",
    },
  });

  const fileAccessSchema = z.object({
    fileName: z.array(
      z
        .string()
        .describe(
          "Name of the files that are needed to be accessed for further planning of task execution"
        )
    ),
  });

  const structuredLlm = model.withStructuredOutput(fileAccessSchema);

  return new ChatOpenAI({
    apiKey,
    model: "gpt-5-mini-2025-08-07",
    reasoning: {
      summary: "auto",
      effort: "high",
    },
  });
};

// Helper function to create tools array
const createTools = (): DynamicStructuredTool[] => {
  return [createReadFileTool(), createReadFileCodeTool()];
};

// Helper function to create the prompt template
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

// Helper function to create the agent executor
const createAgentExecutor = async (): Promise<AgentExecutor> => {
  const llm = createLLMInstance();
  const tools = createTools();
  const prompt = createPromptTemplate();

  // Create the tool-calling agent
  const agent = await createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  // Create agent executor
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

    // Create agent executor
    const agentExecutor = await createAgentExecutor();

    console.log("📝 Executing task analysis:", taskQuery);

    // Execute the task analysis
    const result = await agentExecutor.invoke({
      input: taskQuery,
      chat_history: [],
    });
    console.log("resuklt...............", result);
    console.log("✅ Analysis completed successfully");
    return result.output || "No response generated from the agent";
  } catch (error) {
    console.error("❌ Agent execution error:", error);

    // Provide more specific error messages
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

// Helper function to validate configuration
export const validateConfiguration = (): {
  valid: boolean;
  message: string;
} => {
  try {
    // Ensure cached key exists
    const apiKey = getOpenAIApiKey();

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

// Helper function for testing agent without full workflow
export const testAgentInitialization = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    console.log("🧪 Testing agent initialization...");

    // Validate configuration first
    const configCheck = validateConfiguration();
    if (!configCheck.valid) {
      return { success: false, message: configCheck.message };
    }

    // Try to create agent components
    const llm = createLLMInstance();
    const tools = createTools();
    const prompt = createPromptTemplate();

    console.log("✅ All agent components created successfully");

    return {
      success: true,
      message: `Agent initialization successful. LLM model: ${llm.model}, Tools: ${tools.length}`,
    };
  } catch (error) {
    console.error("❌ Agent initialization failed:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown initialization error",
    };
  }
};
