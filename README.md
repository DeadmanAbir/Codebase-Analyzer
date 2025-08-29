# AI Codebase Analyzer

An AI-powered VS Code extension for intelligent codebase analysis and code review.

## Features
- 🤖 Interactive AI chat interface
- 📊 Comprehensive codebase analysis
- 💬 Natural language code queries
- 🔍 Smart code review suggestions

## Setup
1. Install the extension
2. Get OpenAI API key from [OpenAI](https://platform.openai.com/api-keys)
3. Configure API key: `Ctrl+,` → Extensions → AI Codebase Analyzer → OpenAI API Key

## Usage
1. Open the AI Assistant panel (left sidebar)
2. Ask questions about your codebase
3. Get intelligent analysis and suggestions

## Requirements
- OpenAI API key (required)
- VS Code 1.103.0 or higher

## File Structure

```
├── .env
├── .gitignore
├── .vscodeignore
├── CHANGELOG.md
├── eslint.config.mjs
├── LICENSE.md
├── package-lock.json
├── package.json
├── prompt.js
├── prompt.js.map
├── README.md
├── src/
│   ├── agent/
│   │   ├── codeBaseAgent.ts
│   │   └── test/
│   ├── tools/
│   │   ├── readFileCodeTool.ts
│   │   └── readFileTool.ts
│   ├── ui/
│   │   └── ChatBotViewProvider.ts
│   ├── config.ts
│   └── extension.ts
├── tsconfig.json
├── vsc-extension-quickstart.md
├── vscode-test.mjs
└── webpack.config.js

```

The main entry point for this extension is `src/extension.ts`.
