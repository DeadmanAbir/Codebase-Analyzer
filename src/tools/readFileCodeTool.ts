import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as vscode from "vscode";
import * as path from "path";

// Helper function to get workspace root path
function getWorkspaceRoot(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder is open");
  }
  return workspaceFolders[0].uri.fsPath;
}

// Helper function to resolve file path
function resolveFilePath(filePath: string): string {
  const workspaceRoot = getWorkspaceRoot();

  // If path is already absolute and starts with workspace root, use as is
  if (path.isAbsolute(filePath) && filePath.startsWith(workspaceRoot)) {
    return filePath;
  }

  // If relative path, resolve relative to workspace root
  return path.resolve(workspaceRoot, filePath);
}

// Helper function to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const uri = vscode.Uri.file(filePath);
    const stat = await vscode.workspace.fs.stat(uri);
    return stat.type === vscode.FileType.File;
  } catch {
    return false;
  }
}

// Helper function to read file content
async function readFileContent(filePath: string): Promise<string> {
  try {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString("utf8");
  } catch (error) {
    throw new Error(
      `Failed to read file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Helper function to get file size in a readable format
function formatFileSize(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

// Helper function to process single file
async function processFile(filePath: string): Promise<{
  success: boolean;
  filePath: string;
  content?: string;
  size?: string;
  error?: string;
}> {
  try {
    const resolvedPath = resolveFilePath(filePath);

    // Check if file exists
    if (!(await fileExists(resolvedPath))) {
      return {
        success: false,
        filePath,
        error: `File not found: ${filePath}`,
      };
    }

    // Read file content
    const content = await readFileContent(resolvedPath);
    const stats = await vscode.workspace.fs.stat(vscode.Uri.file(resolvedPath));

    return {
      success: true,
      filePath,
      content,
      size: formatFileSize(stats.size),
    };
  } catch (error) {
    return {
      success: false,
      filePath,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Helper function to process multiple files
async function processMultipleFiles(filePaths: string[]): Promise<{
  successfulReads: Array<{ filePath: string; content: string; size: string }>;
  failedReads: Array<{ filePath: string; error: string }>;
  totalFiles: number;
}> {
  const results = await Promise.all(
    filePaths.map((filePath) => processFile(filePath))
  );

  const successfulReads = results
    .filter((result) => result.success)
    .map((result) => ({
      filePath: result.filePath,
      content: result.content!,
      size: result.size!,
    }));

  const failedReads = results
    .filter((result) => !result.success)
    .map((result) => ({
      filePath: result.filePath,
      error: result.error!,
    }));

  return {
    successfulReads,
    failedReads,
    totalFiles: filePaths.length,
  };
}

// Helper function to format file content for LLM
function formatFileContentForLLM(
  successfulReads: Array<{ filePath: string; content: string; size: string }>,
  failedReads: Array<{ filePath: string; error: string }>
): string {
  let formatted = "# File Contents\n\n";

  if (successfulReads.length > 0) {
    formatted += "## Successfully Read Files:\n\n";

    successfulReads.forEach((file, index) => {
      formatted += `### ${index + 1}. ${file.filePath}\n`;
      formatted += `**Size:** ${file.size}\n\n`;
      formatted += "```\n";
      formatted += file.content;
      formatted += "\n```\n\n";
    });
  }

  if (failedReads.length > 0) {
    formatted += "## Failed to Read:\n\n";
    failedReads.forEach((file) => {
      formatted += `- **${file.filePath}:** ${file.error}\n`;
    });
    formatted += "\n";
  }

  return formatted;
}

// Main tool function
export function createReadFileCodeTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "read_file_code",
    description: `
      Reads the actual content/code of specified files from the workspace. 
      Use this tool after identifying relevant files with read_file_structure tool.
      Provide file paths exactly as they appear in the file structure (relative paths).
    `,
    schema: z.object({
      filePaths: z
        .array(z.string())
        .describe(
          "Array of file paths to read (use relative paths from file structure)"
        ),
      maxFileSize: z
        .number()
        .optional()
        .describe("Maximum file size to read in KB (default: 100KB)"),
    }),
    func: async ({ filePaths, maxFileSize = 100 }) => {
      try {
        if (!filePaths || filePaths.length === 0) {
          return {
            success: false,
            error: "No file paths provided",
            message: "Please provide at least one file path to read",
          };
        }

        if (filePaths.length > 10) {
          return {
            success: false,
            error: "Too many files requested",
            message: `Requested ${filePaths.length} files, but maximum is 10 files per call`,
          };
        }

        console.log(`📖 Reading ${filePaths.length} files:`, filePaths);

        // Process multiple files
        const results = await processMultipleFiles(filePaths);

        // Check file sizes (optional filtering)
        const maxSizeBytes = maxFileSize * 1024;
        const filteredSuccessful = results.successfulReads.filter((file) => {
          const sizeBytes = Buffer.byteLength(file.content, "utf8");
          return sizeBytes <= maxSizeBytes;
        });

        const oversizedFiles =
          results.successfulReads.length - filteredSuccessful.length;

        // Format content for LLM
        const formattedContent = formatFileContentForLLM(
          filteredSuccessful,
          results.failedReads
        );

        return {
          success: true,
          filesRead: filteredSuccessful.length,
          filesFailed: results.failedReads.length,
          filesOversized: oversizedFiles,
          totalRequested: results.totalFiles,
          content: formattedContent,
          message: `Successfully read ${filteredSuccessful.length}/${results.totalFiles} files`,
        };
      } catch (error) {
        console.error("❌ Error in read_file_code tool:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
          message: "Failed to read file contents",
        };
      }
    },
  });
}
