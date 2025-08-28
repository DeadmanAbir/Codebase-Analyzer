import * as vscode from "vscode";
import { createReadFileTool } from "./tools/readFileTool";
import { createReadFileCodeTool } from "./tools/readFileCodeTool";

export async function testReadFileTool() {
  try {
    console.log("🧪 Testing readFileTool...");

    // Create the tool
    const tool = createReadFileTool();

    // Test the tool with default parameters
    console.log("📁 Reading workspace structure...");
    const result = await tool.invoke({ includeHidden: false, maxFiles: 50 });

    console.log("✅ Tool Result:", JSON.stringify(result, null, 2));

    // Show result in VS Code
    if (result.success) {
      const doc = await vscode.workspace.openTextDocument({
        content: `# Tool Test Results\n\n**Status:** ${
          result.success ? "SUCCESS" : "FAILED"
        }\n**File Count:** ${result.fileCount}\n**Message:** ${
          result.message
        }\n\n## Structure:\n\n${result.structure}`,
        language: "markdown",
      });

      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(
        `✅ Tool test completed! Found ${result.fileCount} files.`
      );
    } else {
      vscode.window.showErrorMessage(`❌ Tool test failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error("❌ Tool test error:", error);
    vscode.window.showErrorMessage(
      `Tool test error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    throw error;
  }
}

// Test the new readFileCode tool
export async function testReadFileCodeTool() {
  try {
    console.log("🧪 Testing readFileCodeTool...");

    const tool = createReadFileCodeTool();

    // Get some sample files from the workspace to test with
    const structureTool = createReadFileTool();
    const structureResult = await structureTool.invoke({ maxFiles: 20 });

    if (!structureResult.success) {
      throw new Error("Could not get file structure for testing");
    }

    // Extract some file paths from the structure (look for common entry files)
    const files = structureResult.structure.match(
      /- (.+\.(ts|js|rs|py|java|cpp|c))/g
    );
    const testFiles = files
      ? files.slice(0, 3).map((f : any) => f.replace("- ", "").split(" ")[0])
      : [];

    if (testFiles.length === 0) {
      vscode.window.showWarningMessage(
        "⚠️ No suitable test files found in workspace"
      );
      return { success: false, message: "No test files found" };
    }

    console.log("📖 Testing with files:", testFiles);

    // Test reading the files
    const result = await tool.invoke({ filePaths: testFiles });

    console.log("✅ File Code Tool Result:", {
      success: result.success,
      filesRead: result.filesRead,
      filesFailed: result.filesFailed,
      message: result.message,
    });

    // Show result in VS Code
    const content =
      `# File Code Tool Test Results\n\n` +
      `**Status:** ${result.success ? "SUCCESS" : "FAILED"}\n` +
      `**Files Read:** ${result.filesRead}\n` +
      `**Files Failed:** ${result.filesFailed}\n` +
      `**Files Oversized:** ${result.filesOversized}\n` +
      `**Total Requested:** ${result.totalRequested}\n` +
      `**Message:** ${result.message}\n\n` +
      `## File Contents:\n\n${result.content || "No content available"}`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "markdown",
    });

    await vscode.window.showTextDocument(doc);

    if (result.success) {
      vscode.window.showInformationMessage(
        `✅ File code tool test completed! Read ${result.filesRead} files.`
      );
    } else {
      vscode.window.showErrorMessage(
        `❌ File code tool test failed: ${result.error}`
      );
    }

    return result;
  } catch (error) {
    console.error("❌ File code tool test error:", error);
    vscode.window.showErrorMessage(
      `File code tool test error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    throw error;
  }
}

// Alternative: Test with different parameters
export async function testReadFileToolWithOptions() {
  const tool = createReadFileTool();

  console.log("🧪 Testing with different options...");

  // Test 1: Limited files
  console.log("📋 Test 1: Limited to 20 files");
  const result1 = await tool.invoke({ maxFiles: 20 });
  console.log(`Result 1: ${result1.fileCount} files found`);

  // Test 2: More files
  console.log("📋 Test 2: Up to 100 files");
  const result2 = await tool.invoke({ maxFiles: 100 });
  console.log(`Result 2: ${result2.fileCount} files found`);

  // Test 3: Include hidden (if implemented)
  console.log("📋 Test 3: Include hidden files");
  const result3 = await tool.invoke({ includeHidden: true, maxFiles: 50 });
  console.log(`Result 3: ${result3.fileCount} files found`);

  return { result1, result2, result3 };
}

// Test both tools in sequence (simulating agent workflow)
export async function testToolsSequence() {
  try {
    console.log("🔄 Testing tools in sequence...");

    // Step 1: Get file structure
    const structureTool = createReadFileTool();
    console.log("📁 Step 1: Getting file structure...");
    const structureResult = await structureTool.invoke({ maxFiles: 30 });

    if (!structureResult.success) {
      throw new Error(`File structure failed: ${structureResult.error}`);
    }

    // Step 2: Extract some files and read their content
    const files = structureResult.structure.match(
      /- (.+\.(ts|js|rs|py|java|cpp|c|json))/g
    );
    const targetFiles = files
      ? files.slice(0, 2).map((f : any) => f.replace("- ", "").split(" ")[0])
      : [];

    if (targetFiles.length === 0) {
      throw new Error("No suitable files found for content reading test");
    }

    const codeTool = createReadFileCodeTool();
    console.log("📖 Step 2: Reading file contents for:", targetFiles);
    const codeResult = await codeTool.invoke({ filePaths: targetFiles });

    // Show combined results
    const combinedContent =
      `# Sequential Tool Test Results\n\n` +
      `## Step 1: File Structure\n` +
      `**Status:** ${structureResult.success}\n` +
      `**Files Found:** ${structureResult.fileCount}\n\n` +
      `## Step 2: File Contents\n` +
      `**Status:** ${codeResult.success}\n` +
      `**Files Read:** ${codeResult.filesRead}\n` +
      `**Target Files:** ${targetFiles.join(", ")}\n\n` +
      `## Results:\n\n${codeResult.content}`;

    const doc = await vscode.workspace.openTextDocument({
      content: combinedContent,
      language: "markdown",
    });

    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(
      `✅ Sequential test completed! Structure: ${structureResult.fileCount} files, Content: ${codeResult.filesRead} files read.`
    );

    return { structureResult, codeResult, targetFiles };
  } catch (error) {
    console.error("❌ Sequential tool test error:", error);
    vscode.window.showErrorMessage(
      `Sequential test failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    throw error;
  }
}
