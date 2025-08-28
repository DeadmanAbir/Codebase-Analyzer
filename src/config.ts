import * as vscode from 'vscode';

const DEFAULT_API_KEY = process.env.OPENAI_API_KEY?.trim() || '';

let sessionApiKey: string = '';

/**
 * Set the session API key (called once during activation)
 */
export const setSessionApiKey = (key: string): void => {
  sessionApiKey = key.trim();
};

/**
 * Get the session API key (used by other files)
 */
export const getSessionApiKey = (): string => {
  return sessionApiKey;
};

/**
 * Prompt user for API key during activation
 */
export const promptForApiKey = async (): Promise<string> => {
  // 1) Check environment variable first
  if (DEFAULT_API_KEY) {
    return DEFAULT_API_KEY;
  }

  // 2) Prompt user for API key
  const input = await vscode.window.showInputBox({
    prompt: 'Enter your OpenAI API key for this session',
    placeHolder: 'sk-...',
    ignoreFocusOut: true,
    password: true
  });

  if (input && input.trim() !== '') {
    return input.trim();
  }

  return '';
};

/**
 * Validate if session has API key
 */
export const validateApiKey = (): { valid: boolean; message: string } => {
  const apiKey = getSessionApiKey();
  if (!apiKey || apiKey.trim() === '') {
    return {
      valid: false,
      message: 'No OpenAI API key available for this session.'
    };
  }
  return { valid: true, message: 'API key is present' };
};

/* rest of your config */
export const getOpenAIModel = (): string => {
  return "gpt-5-mini-2025-08-07";
};

export const APP_CONFIG = {
  name: 'AI Codebase Analyzer',
  version: '1.0.0',
  maxTokens: 4000,
  temperature: 0.7,
  defaultModel: getOpenAIModel()
} as const;