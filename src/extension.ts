import * as vscode from "vscode";
import { analyzeCodebaseTask, validateConfiguration } from "./agent/codeBaseAgent";
import { createChatbotViewProvider, clearChat, VIEW_TYPE } from "./ui/ChatBotViewProvider";
import { getOpenAIApiKey, validateApiKey, setCachedApiKey } from "./config";

export async function activate(context: vscode.ExtensionContext) {
  // Register command so user can set/update key anytime
  context.subscriptions.push(
    vscode.commands.registerCommand('codebase-analyzer.setApiKey', async () => {
      const key = await getOpenAIApiKey(context); // will prompt + store if needed
      if (key) {
        setCachedApiKey(key);
        vscode.window.showInformationMessage('OpenAI API key saved.');
      } else {
        vscode.window.showWarningMessage('No API key was provided.');
      }
    })
  );

  // On activation, try to load key (env, secret storage, or prompt) and cache it
  const key = await getOpenAIApiKey(context);
  if (key) {
    setCachedApiKey(key);
    console.log("Using OpenAI key from SecretStorage or environment and cached it.");
  } else {
    // If not set (user canceled prompt or no env), politely offer to set it
    const { valid } = await validateApiKey(context);
    if (!valid) {
      const choice = await vscode.window.showInformationMessage(
        'OpenAI API key is not configured. Would you like to set it now?',
        'Set API Key',
        'Dismiss'
      );

      if (choice === 'Set API Key') {
        const newKey = await getOpenAIApiKey(context); // prompts and stores
        if (newKey) {
          setCachedApiKey(newKey);
          vscode.window.showInformationMessage('API key saved. You are good to go!');
        } else {
          vscode.window.showWarningMessage('No API key provided. Some features will be disabled.');
        }
      } else {
        vscode.window.showInformationMessage('You can set the API key later from the Command Palette: "AI Codebase Analyzer: Set API Key"');
      }
    }
  }

  console.log("🚀 AI Codebase Analyzer extension is now active");

  // Create and register the chatbot view provider
  const chatbotProvider = createChatbotViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_TYPE, chatbotProvider)
  );

  // Register the main analysis command
  const analyzeCommand = vscode.commands.registerCommand(
    "codebase-analyzer.analyzeCodebase",
    async () => {
      try {
        // Validate configuration first (uses cached key)
        const configValidation = await validateConfiguration();
        if (!configValidation.valid) {
          vscode.window.showErrorMessage(
            "AI service is currently unavailable. Please try again later."
          );
          return;
        }

        // Get task query from user
        const taskQuery = await vscode.window.showInputBox({
          prompt: "What would you like me to analyze or help you with?",
          placeHolder: 'e.g., "Review my authentication logic" or "How can I improve this code?"',
          ignoreFocusOut: true,
          validateInput: (value) => {
            return value?.trim().length < 5
              ? "Please enter a more detailed question or task"
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
                message: "AI is thinking..." 
              });

              const result = await analyzeCodebaseTask(taskQuery);

              progress.report({
                increment: 25,
                message: "Preparing results...",
              });

              // Show results in a new document
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

  // Register clear chat command
  const clearChatCommand = vscode.commands.registerCommand(
    "codebase-analyzer.clearChat",
    () => {
      clearChat();
      vscode.window.showInformationMessage("Chat cleared");
    }
  );

  // Register all commands
  context.subscriptions.push(analyzeCommand, clearChatCommand);

  // Show welcome message
  vscode.window.showInformationMessage(
    "🤖 AI Codebase Analyzer is ready! Start chatting in the sidebar."
  );

  console.log("✅ Extension activated successfully");
}

export function deactivate() {
  console.log("👋 AI Codebase Analyzer extension deactivated");
}
