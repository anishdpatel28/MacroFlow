declare global {
  interface Window {
    electronAPI?: {
      executeMacro: (macro: any) => Promise<any>;
      executeCommand: (command: string) => Promise<any>;
      saveMacros: (macros: any[]) => Promise<any>;
      onMenuAction: (callback: (event: any, action: string) => void) => void;
      removeMenuActionListener: () => void;
    };
  }
}

export {};
