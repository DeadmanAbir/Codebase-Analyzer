import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as vscode from "vscode";
import * as path from "path";

export interface FileInfo {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  extension?: string;
  size?: number;
}

let skipPatterns: string[] | null = null;

const getSkipPatterns = (): string[] => {
  if (skipPatterns) return skipPatterns;

  const predefinedPatterns = [
    "node_modules",
    ".git",
    ".vscode",
    "dist",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    "target",
    "bin",
    "obj",
    ".DS_Store",
    "Thumbs.db",
    ".env",
    "public",
    "*.log",
    "*.tmp",
    "*.temp",
    ".cache",
    ".parcel-cache",
    "vendor",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
  ];

  skipPatterns = predefinedPatterns;
  return predefinedPatterns;
};

const shouldSkipFile = (
  name: string,
  relativePath: string
): boolean => {
  const patterns = getSkipPatterns();

  return (
    patterns.some((pattern) => {
      if (pattern.includes("*")) {
        const regexPattern = pattern
          .replace(/\./g, "\\.")
          .replace(/\*/g, ".*");
        const regex = new RegExp(regexPattern);
        return regex.test(name) || regex.test(relativePath);
      }
      return name.includes(pattern) || relativePath.includes(pattern);
    }) ||
    (name.startsWith(".") &&
      !name.match(/^\.(env|gitignore|eslintrc|prettierrc|editorconfig)/))
  );
};

// Helper function to recursively scan directories
const scanDirectory = async (
  dirPath: string,
  rootPath: string,
  files: FileInfo[],
  maxFiles: number
): Promise<void> => {
  if (files.length >= maxFiles) return;

  try {
    const entries = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(dirPath)
    );

    for (const [name, type] of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = path.join(dirPath, name);
      const relativePath = path.relative(rootPath, fullPath);

      // Skip unwanted files/folders
      if (shouldSkipFile(name, relativePath)) {
        continue;
      }

      if (type === vscode.FileType.File) {
        const extension = path.extname(name);
        files.push({
          name,
          relativePath,
          type: "file",
          extension: extension || undefined,
        });
      } else if (type === vscode.FileType.Directory) {
        files.push({
          name,
          relativePath,
          type: "directory",
        });

        // Recursively scan subdirectories
        await scanDirectory(fullPath, rootPath, files, maxFiles);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
};

// Helper function to get workspace structure
const getWorkspaceStructure = async (
  maxFiles: number = 100
): Promise<FileInfo[]> => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder is open");
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files: FileInfo[] = [];

  await scanDirectory(rootPath, rootPath, files, maxFiles);

  // Sort files by type and name
  return files.slice(0, maxFiles).sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
};

// Helper function to format structure for LLM
const formatStructureForLLM = (files: FileInfo[]): string => {
  const directories = files.filter((f) => f.type === "directory");
  const codeFiles = files.filter((f) => f.type === "file");

  let structure = "# Workspace File Structure\n\n";
  structure += "ℹ️ *Using predefined patterns for file filtering*\n\n";

  if (directories.length > 0) {
    structure += "## Directories:\n";
    directories.forEach((dir) => {
      structure += `- ${dir.relativePath}/\n`;
    });
    structure += "\n";
  }

  structure += "## Files:\n";
  codeFiles.forEach((file) => {
    const ext = file.extension ? ` (${file.extension})` : "";
    structure += `- ${file.relativePath}${ext}\n`;
  });

  return structure;
};

// Main tool function
export const createReadFileTool = (): DynamicStructuredTool => {
  return new DynamicStructuredTool({
    name: "read_file_structure",
    description: `
      Reads the current VS Code workspace file structure and returns a formatted list 
      of all files and directories. Skips files and directories based on predefined 
      patterns (e.g., node_modules, build artifacts, cache).
    `,
    schema: z.object({
      includeHidden: z
        .boolean()
        .optional()
        .describe("Whether to include hidden files (default: false)"),
      maxFiles: z
        .number()
        .optional()
        .describe("Maximum number of files to return (default: 100)"),
    }),
    func: async ({ includeHidden = false, maxFiles = 100 }) => {
      try {
        const files = await getWorkspaceStructure(maxFiles);
        const formattedStructure = formatStructureForLLM(files);

        return {
          success: true,
          fileCount: files.length,
          structure: formattedStructure,
          usingGitignore: false,
          message: `Successfully scanned ${files.length} files and directories using predefined patterns`,
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
          message: "Failed to read workspace structure",
        };
      }
    },
  });
};
