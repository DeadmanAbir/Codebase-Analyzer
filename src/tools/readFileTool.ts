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

// Global variables to cache gitignore patterns
let gitignorePatterns: string[] | null = null;
let useGitignore = false;

// Helper function to parse .gitignore file
async function parseGitignoreFile(workspaceRoot: string): Promise<string[]> {
  try {
    const gitignorePath = path.join(workspaceRoot, ".gitignore");
    const gitignoreUri = vscode.Uri.file(gitignorePath);

    const content = await vscode.workspace.fs.readFile(gitignoreUri);
    const gitignoreContent = Buffer.from(content).toString("utf8");

    const patterns = gitignoreContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")) // Remove empty lines and comments
      .map((pattern) => {
        // Handle negation patterns (patterns starting with !)
        if (pattern.startsWith("!")) {
          return pattern; // Keep negation patterns as is for now
        }

        // Convert gitignore patterns to more standard glob patterns
        if (pattern.endsWith("/")) {
          // Directory patterns
          return pattern;
        }

        return pattern;
      });

    console.log("📝 Parsed .gitignore patterns:", patterns);
    return patterns;
  } catch (error) {
    console.log("⚠️ No .gitignore file found or error reading it:", error);
    return [];
  }
}

// Helper function to check if a path matches gitignore patterns
function matchesGitignorePattern(
  filePath: string,
  fileName: string,
  patterns: string[]
): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/"); // Normalize path separators

  for (const pattern of patterns) {
    if (!pattern) continue;

    // Handle negation patterns
    if (pattern.startsWith("!")) {
      // If it's a negation pattern and matches, don't skip this file
      const negPattern = pattern.slice(1);
      if (matchSinglePattern(normalizedPath, fileName, negPattern)) {
        return false; // Don't skip this file
      }
      continue;
    }

    if (matchSinglePattern(normalizedPath, fileName, pattern)) {
      return true; // Skip this file
    }
  }

  return false;
}

// Helper function to match a single pattern
function matchSinglePattern(
  filePath: string,
  fileName: string,
  pattern: string
): boolean {
  // Remove leading slash if present
  pattern = pattern.replace(/^\//, "");

  // Handle directory patterns (ending with /)
  if (pattern.endsWith("/")) {
    const dirPattern = pattern.slice(0, -1);
    return (
      filePath.includes(dirPattern + "/") ||
      filePath === dirPattern ||
      fileName === dirPattern
    );
  }

  // Handle wildcard patterns
  if (pattern.includes("*")) {
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    const regex = new RegExp(`(^|/)${regexPattern}($|/)`);
    return regex.test(filePath) || regex.test(fileName);
  }

  // Handle exact matches and path segments
  return (
    filePath.includes(pattern) ||
    fileName === pattern ||
    filePath.endsWith("/" + pattern) ||
    filePath.startsWith(pattern + "/")
  );
}

// Helper function to get skip patterns (either from .gitignore or predefined)
async function getSkipPatterns(
  workspaceRoot: string
): Promise<{ patterns: string[]; useGitignore: boolean }> {
  // Cache the patterns to avoid reading .gitignore multiple times
  if (gitignorePatterns !== null) {
    return { patterns: gitignorePatterns, useGitignore };
  }

  // Try to read .gitignore first
  const parsedGitignorePatterns = await parseGitignoreFile(workspaceRoot);

  if (parsedGitignorePatterns.length > 0) {
    console.log("✅ Using .gitignore patterns for filtering");
    useGitignore = true;
    gitignorePatterns = parsedGitignorePatterns;
    return { patterns: parsedGitignorePatterns, useGitignore: true };
  } else {
    console.log("📋 Using predefined patterns for filtering");
    useGitignore = false;
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

    gitignorePatterns = predefinedPatterns;
    return { patterns: predefinedPatterns, useGitignore: false };
  }
}

// Updated function to check if a file/directory should be skipped
async function shouldSkipFile(
  name: string,
  relativePath: string,
  workspaceRoot: string
): Promise<boolean> {
  const { patterns, useGitignore: usingGitignore } = await getSkipPatterns(
    workspaceRoot
  );

  if (usingGitignore) {
    return matchesGitignorePattern(relativePath, name, patterns);
  } else {
    // Use the old logic for predefined patterns
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
  }
}

// Helper function to recursively scan directories
async function scanDirectory(
  dirPath: string,
  rootPath: string,
  files: FileInfo[],
  maxFiles: number
): Promise<void> {
  if (files.length >= maxFiles) return;

  try {
    const entries = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(dirPath)
    );

    for (const [name, type] of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = path.join(dirPath, name);
      const relativePath = path.relative(rootPath, fullPath);

      // Check if file should be skipped using either .gitignore or predefined patterns
      if (await shouldSkipFile(name, relativePath, rootPath)) {
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
}

// Helper function to get workspace structure
async function getWorkspaceStructure(
  maxFiles: number = 100
): Promise<FileInfo[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder is open");
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files: FileInfo[] = [];

  // Reset cached patterns when getting new workspace structure
  gitignorePatterns = null;

  await scanDirectory(rootPath, rootPath, files, maxFiles);

  // Sort files by type and name
  return files.slice(0, maxFiles).sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// Helper function to format structure for LLM
function formatStructureForLLM(
  files: FileInfo[],
  usingGitignore: boolean
): string {
  const directories = files.filter((f) => f.type === "directory");
  const codeFiles = files.filter((f) => f.type === "file");

  let structure = "# Workspace File Structure\n\n";

  if (usingGitignore) {
    structure += "ℹ️ *Using .gitignore patterns for file filtering*\n\n";
  } else {
    structure +=
      "ℹ️ *Using predefined patterns for file filtering (no .gitignore found)*\n\n";
  }

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
}

// Main tool function
export function createReadFileTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "read_file_structure",
    description: `
      Reads the current VS Code workspace file structure and returns a formatted list 
      of all files and directories. Automatically uses .gitignore patterns if available,
      otherwise falls back to predefined skip patterns. This helps understand the 
      codebase organization before planning task execution.
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
        const formattedStructure = formatStructureForLLM(files, useGitignore);

        return {
          success: true,
          fileCount: files.length,
          structure: formattedStructure,
          usingGitignore: useGitignore,
          message: `Successfully scanned ${
            files.length
          } files and directories ${
            useGitignore
              ? "using .gitignore patterns"
              : "using predefined patterns"
          }`,
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
}
