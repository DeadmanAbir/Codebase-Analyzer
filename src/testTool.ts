import * as vscode from 'vscode';
import { createReadFileTool } from './tools/readFileTool';

export async function testReadFileTool() {
  try {
    console.log('🧪 Testing readFileTool...');
    
    // Create the tool
    const tool = createReadFileTool();
    
    // Test the tool with default parameters
    console.log('📁 Reading workspace structure...');
    const result = await tool.invoke({ includeHidden: false, maxFiles: 50 });
    
    console.log('✅ Tool Result:', JSON.stringify(result, null, 2));
    
    // Show result in VS Code
    if (result.success) {
      const doc = await vscode.workspace.openTextDocument({
        content: `# Tool Test Results\n\n**Status:** ${result.success ? 'SUCCESS' : 'FAILED'}\n**File Count:** ${result.fileCount}\n**Message:** ${result.message}\n\n## Structure:\n\n${result.structure}`,
        language: 'markdown'
      });
      
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`✅ Tool test completed! Found ${result.fileCount} files.`);
    } else {
      vscode.window.showErrorMessage(`❌ Tool test failed: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Tool test error:', error);
    vscode.window.showErrorMessage(`Tool test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}