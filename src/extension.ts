import * as vscode from "vscode";
import {
  analyzeCodebaseTask,
  validateConfiguration,
} from "./agent/codeBaseAgent";
import {
  createChatbotViewProvider,
  clearChat,
  VIEW_TYPE,
} from "./ui/ChatBotViewProvider";
import { promptForApiKey, setSessionApiKey, validateApiKey } from "./config";

export async function activate(context: vscode.ExtensionContext) {
  console.log("🚀 AI Codebase Analyzer extension is activating...");

  try {
    const apiKey = await promptForApiKey();
    if (apiKey) {
      setSessionApiKey(apiKey);
      console.log("✅ API key set for this session");
      vscode.window.showInformationMessage("🤖 AI Codebase Analyzer is ready!");
    } else {
      vscode.window
        .showWarningMessage(
          "No OpenAI API key provided. Extension features will be disabled until you provide a key.",
          "Set API Key"
        )
        .then((choice) => {
          if (choice === "Set API Key") {
            vscode.commands.executeCommand("codebase-analyzer.setApiKey");
          }
        });
    }
  } catch (error) {
    console.error("Error during API key setup:", error);
    vscode.window.showErrorMessage(
      "Failed to set up API key. Extension may not work properly."
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("codebase-analyzer.setApiKey", async () => {
      try {
        const key = await promptForApiKey();
        if (key) {
          setSessionApiKey(key);
          vscode.window.showInformationMessage(
            "✅ OpenAI API key updated for this session."
          );
        } else {
          vscode.window.showWarningMessage("No API key was provided.");
        }
      } catch (error) {
        vscode.window.showErrorMessage("Failed to set API key.");
      }
    })
  );

  const chatbotProvider = createChatbotViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_TYPE, chatbotProvider)
  );

  const analyzeCommand = vscode.commands.registerCommand(
    "codebase-analyzer.analyzeCodebase",
    async () => {
      try {
        // Validate configuration first
        const configValidation = validateConfiguration();
        if (!configValidation.valid) {
          const choice = await vscode.window.showErrorMessage(
            "OpenAI API key is not available. Would you like to set it now?",
            "Set API Key",
            "Cancel"
          );

          if (choice === "Set API Key") {
            await vscode.commands.executeCommand("codebase-analyzer.setApiKey");
            // Try again after setting key
            const newValidation = validateConfiguration();
            if (!newValidation.valid) {
              return;
            }
          } else {
            return;
          }
        }

        // Get task query from user
        const taskQuery = await vscode.window.showInputBox({
          prompt: "What would you like me to analyze or help you with?",
          placeHolder:
            'e.g., "Review my authentication logic" or "How can I improve this code?"',
          ignoreFocusOut: true,
          validateInput: (value) => {
            return value?.trim().length < 5
              ? "Please enter a more detailed question or task"
              : null;
          },
        });

        if (!taskQuery) {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "AI is analyzing your codebase...",
            cancellable: false,
          },
          async (progress) => {
            try {
              progress.report({
                increment: 25,
                message: "Reading your code...",
              });

              progress.report({
                increment: 25,
                message: "Understanding structure...",
              });

              progress.report({
                increment: 25,
                message: "AI is thinking...",
              });

              const result = await analyzeCodebaseTask(taskQuery);

              progress.report({
                increment: 25,
                message: "Preparing results...",
              });

              const timestamp = new Date().toLocaleString();
              const content =
                `# 🤖 AI Codebase Analysis\n\n` +
                `**📝 Your Question:** ${taskQuery}\n\n` +
                `**🕐 Analysis Time:** ${timestamp}\n\n` +
                `---\n\n${result[0].text}`;

              const doc = await vscode.workspace.openTextDocument({
                content,
                language: "markdown",
              });

              await vscode.window.showTextDocument(doc);
              vscode.window.showInformationMessage("✅ Analysis completed!");
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
        vscode.window.showErrorMessage("Failed to start analysis");
      }
    }
  );

  const clearChatCommand = vscode.commands.registerCommand(
    "codebase-analyzer.clearChat",
    () => {
      clearChat();
      vscode.window.showInformationMessage("Chat cleared");
    }
  );

  context.subscriptions.push(analyzeCommand, clearChatCommand);

  console.log("✅ Extension activated successfully");
}

export function deactivate() {
  console.log("👋 AI Codebase Analyzer extension deactivated");
}
