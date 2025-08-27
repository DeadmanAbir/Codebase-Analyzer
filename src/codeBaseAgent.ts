import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as vscode from "vscode";
import { createReadFileTool } from "./tools/readFileTool";
import {z} from "zod"

// Helper function to get OpenAI API key from VS Code configuration
function getOpenAIApiKey(): string {
  const config = vscode.workspace.getConfiguration("codebaseAnalyzer");
  //   const apiKey = config.get<string>("openaiApiKey");
  const apiKey =
    "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";

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Please set it in VS Code settings under "codebaseAnalyzer.openaiApiKey"'
    );
  }

  return apiKey;
}

function createLLMInstance(): ChatOpenAI {
  const apiKey = getOpenAIApiKey();

const model = new ChatOpenAI({
    apiKey,
    model: "gpt-5-mini-2025-08-07",
    // temperature: 0.1,
    // maxTokens: 2000,
    // streaming: false,
    reasoning: {
      summary: "auto",
      effort: "high",
    },
  });

const fileAccessSchema = z.object({
  fileName: z.array(
    z.string().describe("Name of the files that are needed to be accessed for further planning of task execution")
  ),
});

const structuredLlm = model.withStructuredOutput(fileAccessSchema);

  return new ChatOpenAI({
    apiKey,
    model: "gpt-5-mini-2025-08-07",
    // temperature: 0.1,
    // maxTokens: 2000,
    // streaming: false,
    reasoning: {
      summary: "auto",
      effort: "high",
    },
  });
}

// Helper function to create tools array
function createTools(): DynamicStructuredTool[] {
  return [createReadFileTool()];
}

// Helper function to create the prompt template
function createPromptTemplate(): ChatPromptTemplate {
  return ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a software development assistant that helps analyze codebases.

Your primary task is to:
1. First, use the read_file_structure tool to understand the codebase organization
2. Based on the file structure and the user's task query, identify which specific files are most relevant for the task
3. Provide a focused list of files that should be examined for task planning

Guidelines:
- Always call the read_file_structure tool first to understand the codebase
- Focus on identifying the most relevant files for the given task
- Be selective - don't just list all files, focus on the most important ones for the task

Response format should be:
1. List of specific files to examine Just file names that's it.
`,
    ],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
}

// Helper function to create the agent executor
async function createAgentExecutor(): Promise<AgentExecutor> {
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
    maxIterations: 3,
    verbose: true,
    returnIntermediateSteps: true,
  });
}

// Main function to analyze task
export async function analyzeCodebaseTask(taskQuery: string) {
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
}

// Helper function to validate configuration
export function validateConfiguration(): { valid: boolean; message: string } {
  try {
    getOpenAIApiKey();

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
}

// Helper function for testing agent without full workflow
export async function testAgentInitialization(): Promise<{
  success: boolean;
  message: string;
}> {
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
}
