import * as vscode from 'vscode';

const DEFAULT_API_KEY = process.env.OPENAI_API_KEY?.trim() || '';
const SECRET_KEY_NAME = 'aiCodebaseAnalyzer.openaiKey';

let _cachedApiKey: string | undefined = DEFAULT_API_KEY || undefined;

/**
 * Set cached key (call this once after reading/prompting).
 */
export const setCachedApiKey = (key?: string): void => {
  _cachedApiKey = key?.trim() || undefined;
};

/**
 * Synchronous cache getter (useable anywhere in extension host).
 * Returns empty string if not set.
 */
export const getCachedApiKeySync = (): string => {
  return _cachedApiKey ?? '';
};

/**
 * Async getter (preferred). Order:
 * 1) environment var
 * 2) cached value
 * 3) SecretStorage (requires context)
 * 4) prompt user (stores into SecretStorage)
 *
 * If it obtains a final key it will also update the cached value.
 */
export const getOpenAIApiKey = async (context?: vscode.ExtensionContext): Promise<string> => {
  // 1) env var
  if (DEFAULT_API_KEY) {
    setCachedApiKey(DEFAULT_API_KEY);
    return DEFAULT_API_KEY;
  }

  // 2) cached value
  if (_cachedApiKey && _cachedApiKey.trim() !== '') {
    return _cachedApiKey;
  }

  // Without context we cannot read SecretStorage or prompt
  if (!context) {
    return '';
  }

  // 3) try SecretStorage
  try {
    const stored = await context.secrets.get(SECRET_KEY_NAME);
    if (stored && stored.trim() !== '') {
      setCachedApiKey(stored.trim());
      return stored.trim();
    }
  } catch (err) {
    console.error('Error reading secret from SecretStorage:', err);
  }

  // 4) prompt user
  const input = await vscode.window.showInputBox({
    prompt: 'Enter your OpenAI API key (will be stored securely)',
    placeHolder: 'sk-...',
    ignoreFocusOut: true,
    password: true
  });

  if (input && input.trim() !== '') {
    const trimmed = input.trim();
    try {
      await context.secrets.store(SECRET_KEY_NAME, trimmed);
    } catch (err) {
      console.warn('Could not store API key in SecretStorage:', err);
    }
    setCachedApiKey(trimmed);
    return trimmed;
  }

  return '';
};

/**
 * Async validator that uses async getter and returns helpful message.
 */
export const validateApiKey = async (context?: vscode.ExtensionContext): Promise<{ valid: boolean; message: string }> => {
  const apiKey = await getOpenAIApiKey(context);
  if (!apiKey || apiKey.trim() === '') {
    return {
      valid: false,
      message:
        'No OpenAI API key configured. Please run the command "AI Codebase Analyzer: Set OpenAI API Key".'
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
