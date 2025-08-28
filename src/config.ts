import * as vscode from 'vscode';


let sessionApiKey: string = '';


export const setSessionApiKey = (key: string): void => {
  sessionApiKey = key.trim();
};


export const getSessionApiKey = (): string => {
  return sessionApiKey;
};


export const promptForApiKey = async (): Promise<string> => {

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




