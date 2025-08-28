declare global {
  interface Window {
    electronAPI?: {
      executeMacro: (macro: any) => Promise<any>;
      executeCommand: (command: string) => Promise<any>;
      saveMacros: (macros: any[]) => Promise<any>;
      checkMacroCommand: () => Promise<{ installed: boolean; path?: string }>;
      installMacroflowCommand: () => Promise<{ success?: boolean; error?: string; stderr?: string; stdout?: string }>;
      getVersion: () => Promise<string>;
      onMenuAction: (callback: (event: any, action: string) => void) => void;
      removeMenuActionListener: () => void;
    };
  }
}

export {};
