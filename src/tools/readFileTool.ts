import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as vscode from 'vscode';
import * as path from 'path';

export interface FileInfo {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  extension?: string;
  size?: number;
}

// Helper function to check if a file/directory should be skipped
function shouldSkipFile(name: string): boolean {
  const skipPatterns = [
    'node_modules',
    '.git',
    '.vscode',
    'dist',
    'build',
    'coverage',
    '.next',
    '.nuxt',
    'target',
    'bin',
    'obj',
    '.DS_Store',
    'Thumbs.db',
    ".env",
    "public"
  ];
  
  return skipPatterns.some(pattern => name.includes(pattern)) || 
         name.startsWith('.') && !name.match(/^\.(env|gitignore|eslintrc|prettierrc)/);
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
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
    
    for (const [name, type] of entries) {
      if (files.length >= maxFiles) break;
      
      // Skip common directories that are usually not relevant
      if (shouldSkipFile(name)) continue;

      const fullPath = path.join(dirPath, name);
      const relativePath = path.relative(rootPath, fullPath);
      
      if (type === vscode.FileType.File) {
        const extension = path.extname(name);
        files.push({
          name,
          relativePath,
          type: 'file',
          extension: extension || undefined
        });
      } else if (type === vscode.FileType.Directory) {
        files.push({
          name,
          relativePath,
          type: 'directory'
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
async function getWorkspaceStructure(maxFiles: number = 100): Promise<FileInfo[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder is open');
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files: FileInfo[] = [];
  
  await scanDirectory(rootPath, rootPath, files, maxFiles);
  
  // Sort files by type and name
  return files
    .slice(0, maxFiles)
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}

// Helper function to format structure for LLM
function formatStructureForLLM(files: FileInfo[]): string {
  const directories = files.filter(f => f.type === 'directory');
  const codeFiles = files.filter(f => f.type === 'file');
  
  let structure = "# Workspace File Structure\n\n";
  
  if (directories.length > 0) {
    structure += "## Directories:\n";
    directories.forEach(dir => {
      structure += `- ${dir.relativePath}/\n`;
    });
    structure += "\n";
  }
  
  structure += "## Files:\n";
  codeFiles.forEach(file => {
    const ext = file.extension ? ` (${file.extension})` : '';
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
      of all files and directories. This helps understand the codebase organization 
      before planning task execution.
    `,
    schema: z.object({
      includeHidden: z.boolean().optional().describe("Whether to include hidden files (default: false)"),
      maxFiles: z.number().optional().describe("Maximum number of files to return (default: 100)")
    }),
    func: async ({ includeHidden = false, maxFiles = 100 }) => {
      try {
        const files = await getWorkspaceStructure(maxFiles);
        const formattedStructure = formatStructureForLLM(files);
        
        return {
          success: true,
          fileCount: files.length,
          structure: formattedStructure,
          message: `Successfully scanned ${files.length} files and directories`
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          message: 'Failed to read workspace structure'
        };
      }
    }
  });
}