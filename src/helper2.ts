import * as vscode from "vscode";
import { review_prompt } from "./prompt";

export async function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
      "codeReviewer.reviewFile",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage("No active file to review");
          return;
        }
  
        const document = editor.document;
        const text = document.getText();
  
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Reviewing code with AI...",
            cancellable: false,
          },
          async () => {
            try {
              const apiKey =
                "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";
  
              const resp = await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "gpt-4o-mini", // or "gpt-4o"
                    messages: [
                      {
                        role: "system",
                        content:
                          review_prompt,
                      },
                      {
                        role: "user",
                        content: `Review the following code:\n\n${text}`,
                      },
                    ],
                  }),
                }
              );
  
              const data = await resp.json();
              //@ts-ignore
              const message =  data?.choices[0].message?.content;
  
              // Use VS Code's built-in MarkdownString
              const md = new vscode.MarkdownString(
                message || "No review returned.",
                true
              );
              md.isTrusted = true;
  
              const doc = await vscode.workspace.openTextDocument({
                content: md.value,
                language: "markdown",
              });
              await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            } catch (err) {
              vscode.window.showErrorMessage("Error fetching review: " + err);
            }
          }
        );
      }
    );
  
    context.subscriptions.push(disposable);
  }