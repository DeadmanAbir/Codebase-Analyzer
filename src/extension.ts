import * as vscode from "vscode";
import {
  analyzeCodebaseTask,
  testAgentInitialization,
  validateConfiguration,
} from "./codeBaseAgent";
import { createChatbotViewProvider, clearChat, VIEW_TYPE } from "./ChatBotViewProvider";

export async function activate(context: vscode.ExtensionContext) {
  console.log("🚀 Codebase Analyzer extension is now active");

  // Create and register the chatbot view provider
  const chatbotProvider = createChatbotViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VIEW_TYPE,
      chatbotProvider
    )
  );

  // Register the main analysis command (kept for backward compatibility)
  const analyzeCommand = vscode.commands.registerCommand(
    "codebase-analyzer.analyzeCodebase",
    async () => {
      try {
        // Validate configuration first
        const configValidation = validateConfiguration();
        if (!configValidation.valid) {
          vscode.window.showErrorMessage(configValidation.message);

          // Show configuration hint
          const configure = await vscode.window.showInformationMessage(
            "Configure OpenAI API key to use this extension",
            "Open Settings"
          );

          if (configure) {
            vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "codebaseAnalyzer"
            );
          }
          return;
        }

        console.log("reached here");
        
        // Get task query from user
        const taskQuery = await vscode.window.showInputBox({
          prompt: "Enter your task query",
          placeHolder: 'e.g., "Add a new API endpoint for user authentication"',
          ignoreFocusOut: true,
          validateInput: (value) => {
            return value?.trim().length < 10
              ? "Please enter a more detailed task description"
              : null;
          },
        });

        if (!taskQuery) {
          return; // User cancelled
        }

        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing codebase with AI...",
            cancellable: false,
          },
          async (progress) => {
            try {
              progress.report({
                increment: 25,
                message: "Initializing AI agent...",
              });

              progress.report({
                increment: 25,
                message: "Reading file structure...",
              });

              progress.report({ increment: 25, message: "AI is analyzing..." });
              const result = await analyzeCodebaseTask(taskQuery);

              progress.report({
                increment: 25,
                message: "Generating recommendations...",
              });

              console.log("result...............", result);

              // Show results in a new document
              const timestamp = new Date().toLocaleString();
              const content =
                `# 🤖 AI Codebase Analysis Results\n\n` +
                `**📝 Task Query:** ${taskQuery}\n\n` +
                `**🕐 Analysis Time:** ${timestamp}\n\n` +
                `**📊 Results:**\n\n${result[0].text}`;

              const doc = await vscode.workspace.openTextDocument({
                content,
                language: "markdown",
              });

              await vscode.window.showTextDocument(doc);
              vscode.window.showInformationMessage(
                "✅ AI analysis completed successfully!"
              );
            } catch (error) {
              const errorMsg =
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred";
              console.error("❌ Analysis error:", error);
              vscode.window.showErrorMessage(`Analysis failed: ${errorMsg}`);
            }
          }
        );
      } catch (error) {
        console.error("❌ Extension error:", error);
        vscode.window.showErrorMessage("Failed to start codebase analysis");
      }
    }
  );

  // Register test agent initialization command
  const testAgentCommand = vscode.commands.registerCommand(
    "codebase-analyzer.testAgent",
    async () => {
      try {
        const result = await testAgentInitialization();

        if (result.success) {
          vscode.window.showInformationMessage(`✅ ${result.message}`);
        } else {
          vscode.window.showErrorMessage(`❌ ${result.message}`);
        }
      } catch (error) {
        console.error("❌ Agent test error:", error);
        vscode.window.showErrorMessage("Agent test failed");
      }
    }
  );

  // Register clear chat command
  const clearChatCommand = vscode.commands.registerCommand(
    "codebase-analyzer.clearChat",
    () => {
      clearChat();
      vscode.window.showInformationMessage("Chat cleared successfully");
    }
  );

  // Register all commands
  context.subscriptions.push(
    analyzeCommand,
    testAgentCommand,
    clearChatCommand
  );

  // Show welcome message
  vscode.window.showInformationMessage(
    "🤖 Codebase Analyzer is ready! Open the AI Assistant panel to start chatting."
  );

  // Log successful activation
  console.log("✅ Extension activated with chatbot functionality");
}

export function deactivate() {
  console.log("👋 Codebase Analyzer extension deactivated");
}