import React, { useState, useEffect } from "react";
import "./App.web.css";

interface Macro {
  id: string;
  name: string;
  description: string;
  commands: string[];
  executionMode: "concurrent" | "sequential";
  parameters: string[];
  createdAt: Date;
  lastRun?: Date;
}

interface ExecutionResult {
  command: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

const App: React.FC = () => {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [selectedMacro, setSelectedMacro] = useState<Macro | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [terminalHistoryIndex, setTerminalHistoryIndex] = useState(-1);
  const [parameterPopup, setParameterPopup] = useState<{
    show: boolean;
    x: number;
    y: number;
    commandIndex: number;
    cursorPosition: number;
    filter: string;
  } | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Check if macro command is installed
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.executeCommand("which macro").then((result: any) => {
        if (result.error || !result.stdout.trim()) {
          setShowInstallPrompt(true);
        }
      }).catch(() => {
        setShowInstallPrompt(true);
      });
    }
  }, []);

  // Load macros from localStorage on component mount
  useEffect(() => {
    const savedMacros = localStorage.getItem("macroflow-macros");
    if (savedMacros) {
      try {
        const parsedMacros = JSON.parse(savedMacros).map((macro: any) => ({
          ...macro,
          createdAt: new Date(macro.createdAt),
          lastRun: macro.lastRun ? new Date(macro.lastRun) : undefined,
        }));
        setMacros(parsedMacros);
      } catch (error) {
        console.error("Failed to load macros:", error);
      }
    }
  }, []);

  // Save macros to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("macroflow-macros", JSON.stringify(macros));

    // Also save to file system for CLI access (if in Electron)
    if (window.electronAPI) {
      // This will be handled by the main process
      window.electronAPI.saveMacros(macros);
    }
  }, [macros]);

  // Handle menu actions
  useEffect(() => {
    const handleMenuAction = (event: any, action: string) => {
      switch (action) {
        case "new-macro":
          handleNewMacro();
          break;
        case "import-macros":
          handleImportMacros();
          break;
        case "export-macros":
          handleExportMacros();
          break;
        case "about":
          alert("MacroFlow v1.0.0\nA powerful macro management tool for developers");
          break;
      }
    };

    if (window.electronAPI) {
      window.electronAPI.onMenuAction(handleMenuAction);
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeMenuActionListener();
      }
    };
  }, []);

  const handleNewMacro = () => {
    // Check if there are unsaved changes
    if (selectedMacro && (isCreating || isEditing)) {
      const hasChanges = (
        selectedMacro.name.trim() !== "" ||
        selectedMacro.description.trim() !== "" ||
        selectedMacro.commands.some(cmd => cmd.trim() !== "") ||
        selectedMacro.parameters.some(param => param.trim() !== "")
      );

      if (hasChanges && !confirm("You have unsaved changes. Do you want to discard them and create a new macro?")) {
        return;
      }
    }

    const newMacro: Macro = {
      id: Date.now().toString(),
      name: "",
      description: "",
      commands: [""],
      executionMode: "sequential",
      parameters: [],
      createdAt: new Date(),
    };
    setSelectedMacro(newMacro);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleCopyMacro = (macro: Macro) => {
    const copiedMacro: Macro = {
      id: Date.now().toString(), // Generate new unique ID
      name: `${macro.name} (Copy)`,
      description: macro.description,
      commands: [...macro.commands], // Deep copy arrays
      executionMode: macro.executionMode,
      parameters: [...macro.parameters], // Deep copy arrays
      createdAt: new Date(),
      lastRun: undefined
    };
    setSelectedMacro(copiedMacro);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleEditMacro = (macro: Macro) => {
    setSelectedMacro(macro);
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleSaveMacro = () => {
    if (!selectedMacro || !selectedMacro.name.trim()) {
      alert("Please enter a macro alias");
      return;
    }

    if (selectedMacro.commands.length === 0 || !selectedMacro.commands[0].trim()) {
      alert("Please add at least one command");
      return;
    }

    // Check for duplicate alias
    const existingMacro = macros.find(m =>
      m.name.toLowerCase() === selectedMacro.name.toLowerCase() &&
      m.id !== selectedMacro.id
    );

    if (existingMacro) {
      alert("A macro with this alias already exists. Please choose a different alias.");
      return;
    }

    // Filter out empty parameters
    const filteredMacro = {
      ...selectedMacro,
      parameters: selectedMacro.parameters.filter(param => param.trim() !== '')
    };

    if (isCreating) {
      setMacros(prev => [...prev, filteredMacro]);
    } else {
      setMacros(prev => prev.map(m => m.id === selectedMacro.id ? filteredMacro : m));
    }

    setSelectedMacro(null);
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleDeleteMacro = (macroId: string) => {
    if (confirm("Are you sure you want to delete this macro?")) {
      setMacros(prev => prev.filter(m => m.id !== macroId));
      if (selectedMacro?.id === macroId) {
        setSelectedMacro(null);
        setIsCreating(false);
        setIsEditing(false);
      }
    }
  };

  const handleExecuteMacro = async (macro: Macro) => {
    setIsExecuting(true);
    setShowTerminal(true);

    // Build the macro command
    const paramValues = macro.parameters.map(param => parameterValues[param] || `<${param}>`);
    const macroCommand = `macro ${macro.name} ${paramValues.join(' ')}`;

    // Add to terminal history
    setTerminalHistory(prev => [...prev, macroCommand]);

    // Execute the command in terminal (don't duplicate the command line)
    // setTerminalOutput(prev => [...prev, `$ ${macroCommand}`]);

    try {
      // Prepare parameter values
      const params: Record<string, string> = {};
      macro.parameters.forEach(param => {
        params[param] = parameterValues[param] || "";
      });

      const macroToExecute = {
        ...macro,
        parameters: params,
      };

      if (window.electronAPI) {
        const results = await window.electronAPI.executeMacro(macroToExecute);

        // Display results in terminal
        const output: string[] = [];
        results.forEach((result: any, index: number) => {
          // Show the command being executed
          output.push(result.command);
          if (result.error) {
            output.push(result.error);
          } else {
            if (result.stdout) {
              output.push(result.stdout);
            }
          }
        });

        setTerminalOutput(prev => [...prev, ...output]);

        // Update last run time
        setMacros(prev => prev.map(m =>
          m.id === macro.id ? { ...m, lastRun: new Date() } : m
        ));

        // Scroll to bottom after macro execution
        setTimeout(() => {
          const terminalOutput = document.querySelector('.terminal-output');
          if (terminalOutput) {
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
          }
          const terminalContent = document.querySelector('.terminal-content');
          if (terminalContent) {
            terminalContent.scrollTop = terminalContent.scrollHeight;
          }
        }, 0);
      } else {
        // Fallback for web version - simulate execution
        setTimeout(() => {
          setTerminalOutput(prev => [...prev, `✅ Macro executed successfully (web version)`]);
        }, 1000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTerminalOutput(prev => [...prev, `❌ Error: ${errorMessage}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTerminalInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const command = terminalInput.trim();

      // Always add to output, even if empty
      setTerminalOutput(prev => [...prev, `$ ${command || ''}`]);

      if (command) {
        setTerminalHistory(prev => [...prev, command]);
        setTerminalHistoryIndex(-1);

        // Handle macro commands
        if (command.startsWith('macro ')) {
          const parts = command.split(' ');
          const macroName = parts[1];
          const macro = macros.find(m => m.name === macroName);
          if (macro) {
            // Execute the macro
            handleExecuteMacro(macro);
          } else {
            setTerminalOutput(prev => [...prev, `Command failed: ${macroName}`]);
          }
        } else {
          // Regular command - execute via Electron
          if (window.electronAPI) {
            // Execute real command via Electron
            window.electronAPI.executeCommand(command).then((result: any) => {
              if (result.error) {
                setTerminalOutput(prev => [...prev, result.error]);
              } else {
                setTerminalOutput(prev => [...prev, result.stdout || '']);
              }
              // Scroll to bottom after output
              setTimeout(() => {
                const terminalOutput = document.querySelector('.terminal-output');
                if (terminalOutput) {
                  terminalOutput.scrollTop = terminalOutput.scrollHeight;
                }
              }, 0);
            }).catch((error: any) => {
              setTerminalOutput(prev => [...prev, `Command failed: ${command}`]);
            });
          } else {
            // Fallback for web version
            setTerminalOutput(prev => [...prev, `✅ Command executed: ${command}`]);
          }
        }
      }

      setTerminalInput("");
      // Scroll to bottom after command
      setTimeout(() => {
        const terminalOutput = document.querySelector('.terminal-output');
        if (terminalOutput) {
          terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
        // Also scroll the terminal content
        const terminalContent = document.querySelector('.terminal-content');
        if (terminalContent) {
          terminalContent.scrollTop = terminalContent.scrollHeight;
        }
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalHistoryIndex < terminalHistory.length - 1) {
        const newIndex = terminalHistoryIndex + 1;
        setTerminalHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (terminalHistoryIndex > 0) {
        const newIndex = terminalHistoryIndex - 1;
        setTerminalHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - newIndex]);
      } else if (terminalHistoryIndex === 0) {
        setTerminalHistoryIndex(-1);
        setTerminalInput("");
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      e.currentTarget.select();
    }
  };

  const handleImportMacros = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedMacros = JSON.parse(e.target?.result as string);
            setMacros(prev => [...prev, ...importedMacros]);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Invalid JSON file';
            alert(`Failed to import macros: ${errorMessage}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExportMacros = () => {
    const dataStr = JSON.stringify(macros, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "macroflow-macros.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const addCommand = () => {
    if (selectedMacro) {
      setSelectedMacro(prev => prev ? {
        ...prev,
        commands: [...prev.commands, ""]
      } : null);
    }
  };

  const removeCommand = (index: number) => {
    if (selectedMacro && selectedMacro.commands.length > 1) {
      setSelectedMacro(prev => prev ? {
        ...prev,
        commands: prev.commands.filter((_, i) => i !== index)
      } : null);
    }
  };

  const updateCommand = (index: number, value: string, event?: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedMacro) {
      setSelectedMacro(prev => prev ? {
        ...prev,
        commands: prev.commands.map((cmd, i) => i === index ? value : cmd)
      } : null);

      // Check for parameter popup trigger
      if (event) {
        const input = event.target;
        const cursorPosition = input.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPosition);

        // Check if we're typing {{ and need to show popup
        const match = textBeforeCursor.match(/\{\{([^}]*)$/);
        if (match) {
          const filter = match[1];
          const rect = input.getBoundingClientRect();
          const charWidth = 8; // Approximate character width
          const popupX = rect.left + Math.min(cursorPosition * charWidth, rect.width - 200);
          setParameterPopup({
            show: true,
            x: popupX,
            y: rect.bottom + 5,
            commandIndex: index,
            cursorPosition,
            filter
          });
        } else {
          setParameterPopup(null);
        }
      }
    }
  };

  const selectParameter = (parameter: string) => {
    if (parameterPopup && selectedMacro) {
      const { commandIndex, cursorPosition } = parameterPopup;
      const currentCommand = selectedMacro.commands[commandIndex];
      const beforeCursor = currentCommand.substring(0, cursorPosition - parameterPopup.filter.length - 2);
      const afterCursor = currentCommand.substring(cursorPosition);
      const newCommand = beforeCursor + `{{${parameter}}}` + afterCursor;

      setSelectedMacro(prev => prev ? {
        ...prev,
        commands: prev.commands.map((cmd, i) => i === commandIndex ? newCommand : cmd)
      } : null);

      setParameterPopup(null);

      // Focus back on the input and set cursor position after the parameter
      setTimeout(() => {
        const input = document.querySelector(`input[data-command-index="${commandIndex}"]`) as HTMLInputElement;
        if (input) {
          input.focus();
          const newPosition = beforeCursor.length + parameter.length + 4; // +4 for {{}}
          input.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    }
  };

  const addParameter = () => {
    if (selectedMacro) {
      setSelectedMacro(prev => prev ? {
        ...prev,
        parameters: [...prev.parameters, ""]
      } : null);
    }
  };

  const removeParameter = (index: number) => {
    if (selectedMacro) {
      setSelectedMacro(prev => prev ? {
        ...prev,
        parameters: prev.parameters.filter((_, i) => i !== index)
      } : null);
    }
  };

  const updateParameter = (index: number, value: string) => {
    if (selectedMacro) {
      setSelectedMacro(prev => prev ? {
        ...prev,
        parameters: prev.parameters.map((param, i) => i === index ? value : param)
      } : null);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>MacroFlow</h1>
        <span className="version">v1.0.0</span>
      </header>

      <div className="container">
        <nav className="sidebar">
          <div className="sidebar-header">
            <div className="header-top">
              <h3>Macros</h3>
              <div className="header-actions">
                <button
                  className="btn-keyboard-shortcuts"
                  onClick={() => setShowKeyboardShortcuts(true)}
                  title="Keyboard Shortcuts"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <line x1="6" y1="8" x2="6" y2="8" />
                    <line x1="10" y1="8" x2="10" y2="8" />
                    <line x1="14" y1="8" x2="14" y2="8" />
                    <line x1="18" y1="8" x2="18" y2="8" />
                    <line x1="6" y1="12" x2="6" y2="12" />
                    <line x1="10" y1="12" x2="10" y2="12" />
                    <line x1="14" y1="12" x2="14" y2="12" />
                    <line x1="18" y1="12" x2="18" y2="12" />
                    <line x1="6" y1="16" x2="6" y2="16" />
                    <line x1="10" y1="16" x2="10" y2="16" />
                    <line x1="14" y1="16" x2="14" y2="16" />
                    <line x1="18" y1="16" x2="18" y2="16" />
                  </svg>
                </button>
              </div>
            </div>
            <button className="btn-primary" onClick={handleNewMacro}>
              + New Macro
            </button>
          </div>

          <div className="macro-list">
            {macros.map(macro => (
              <div
                key={macro.id}
                className={`macro-item ${selectedMacro?.id === macro.id ? "selected" : ""}`}
                onClick={() => {
                  if (isCreating) {
                    // Check if there are actual changes (not just default values)
                    const hasChanges = selectedMacro && (
                      selectedMacro.name.trim() !== "" ||
                      selectedMacro.description.trim() !== "" ||
                      selectedMacro.commands.some(cmd => cmd.trim() !== "") ||
                      selectedMacro.parameters.some(param => param.trim() !== "")
                    );

                    if (hasChanges && confirm("You have unsaved changes. Do you want to discard them and view this macro?")) {
                      setSelectedMacro(macro);
                      setIsCreating(false);
                      setIsEditing(false);
                    } else if (!hasChanges) {
                      setSelectedMacro(macro);
                      setIsCreating(false);
                      setIsEditing(false);
                    }
                  } else {
                    // Toggle selection - unclick if already selected
                    if (selectedMacro?.id === macro.id) {
                      setSelectedMacro(null);
                    } else {
                      setSelectedMacro(macro);
                    }
                  }
                }}
              >
                <div className="macro-info">
                  <div className="macro-header-row">
                    <h4>{macro.name}</h4>
                    {isCreating && (
                      <button
                        className="btn-copy-values-text"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyMacro(macro);
                        }}
                        title="Copy macro values"
                      >
                        Copy Values
                      </button>
                    )}
                  </div>
                  <p>{macro.description}</p>
                  <div className="macro-meta">
                    <span className="execution-mode">{macro.executionMode}</span>
                    <div className="macro-dates">
                      {macro.createdAt && (
                        <span className="created-date">
                          Created: {macro.createdAt.toLocaleString()}
                        </span>
                      )}
                      {macro.lastRun && (
                        <span className="last-run">
                          Last run: {macro.lastRun.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="macro-actions">
                  <button
                    className="btn-copy-command"
                    onClick={(e) => {
                      e.stopPropagation();
                      const command = `macro ${macro.name} ${macro.parameters.map(p => `{{${p}}}`).join(' ')}`;
                      navigator.clipboard.writeText(command);
                    }}
                    title="Copy macro command"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    className="btn-run"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExecuteMacro(macro);
                    }}
                    disabled={isExecuting}
                  >
                    {isExecuting ? "Running..." : "Run"}
                  </button>
                  <button
                    className="btn-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditMacro(macro);
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </nav>

        <main className="content">
          {selectedMacro && (isCreating || isEditing) ? (
            <div className="macro-editor">
              <div className="editor-header">
                <h2>{isCreating ? "Create New Macro" : "Edit Macro"}</h2>
              </div>

              <div className="form-group">
                <label>Alias</label>
                <input
                  type="text"
                  value={selectedMacro.name}
                  onChange={(e) => setSelectedMacro(prev => prev ? { ...prev, name: e.target.value } : null)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                      e.preventDefault();
                      e.currentTarget.select();
                    }
                  }}
                  placeholder="Enter macro alias"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={selectedMacro.description}
                  onChange={(e) => setSelectedMacro(prev => prev ? { ...prev, description: e.target.value } : null)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                      e.preventDefault();
                      e.currentTarget.select();
                    }
                  }}
                  placeholder="Enter macro description"
                  rows={1}
                />
              </div>

              <div className="form-group">
                <label>Execution Mode</label>
                <select
                  value={selectedMacro.executionMode}
                  onChange={(e) => setSelectedMacro(prev => prev ? { ...prev, executionMode: e.target.value as "concurrent" | "sequential" } : null)}
                >
                  <option value="sequential">Sequential</option>
                  <option value="concurrent">Concurrent</option>
                </select>
              </div>

              <div className="form-group">
                <label>Commands</label>
                {selectedMacro.commands.map((command, index) => (
                  <div key={index} className="command-input">
                    <input
                      type="text"
                      value={command}
                      onChange={(e) => updateCommand(index, e.target.value, e)}
                      onKeyDown={(e) => {
                        // Allow Cmd+A for select all
                        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                          e.preventDefault();
                          e.currentTarget.select();
                        }
                      }}
                      placeholder="Enter command (use {{parameter}} for placeholders)"
                      className="form-input"
                    />
                    {selectedMacro.commands.length > 1 && (
                      <button
                        className="btn-remove"
                        onClick={() => removeCommand(index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button className="btn-secondary" onClick={addCommand}>
                  + Add Command
                </button>
              </div>

              <div className="form-group">
                <label>Parameters</label>
                {selectedMacro.parameters.map((parameter, index) => (
                  <div key={index} className="parameter-input">
                    <input
                      type="text"
                      value={parameter}
                      onChange={(e) => updateParameter(index, e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                          e.preventDefault();
                          e.currentTarget.select();
                        }
                      }}
                      placeholder="Parameter name"
                    />
                    <button
                      className="btn-remove"
                      onClick={() => removeParameter(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button className="btn-secondary" onClick={addParameter}>
                  + Add Parameter
                </button>
              </div>

              <div className="form-actions">
                <button className="btn-primary" onClick={handleSaveMacro}>
                  {isCreating ? "Create Macro" : "Save Changes"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedMacro(null);
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedMacro ? (
            <div className="macro-details">
              <div className="macro-header">
                <div className="header-top-row">
                  <button
                    className="btn-back"
                    onClick={() => {
                      setSelectedMacro(null);
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                  >
                    <svg className="back-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <div className="macro-actions">
                    <button
                      className="btn-copy-command"
                      onClick={() => {
                        const command = `macro ${selectedMacro.name} ${selectedMacro.parameters.map(p => `{{${p}}}`).join(' ')}`;
                        navigator.clipboard.writeText(command);
                      }}
                      title="Copy macro command"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                    <button
                      className="btn-run"
                      onClick={() => handleExecuteMacro(selectedMacro)}
                      disabled={isExecuting}
                    >
                      {isExecuting ? "Running..." : "Run Macro"}
                    </button>
                    <button
                      className="btn-edit"
                      onClick={() => handleEditMacro(selectedMacro)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteMacro(selectedMacro.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <h2 className="macro-title">{selectedMacro.name}</h2>
              </div>

              <p className="macro-description">{selectedMacro.description}</p>

              <div className="macro-info-grid">
                <div className="info-item">
                  <label>Execution Mode:</label>
                  <span className={`mode-badge ${selectedMacro.executionMode}`}>
                    {selectedMacro.executionMode}
                  </span>
                </div>
                <div className="info-item">
                  <label>Created:</label>
                  <span>{selectedMacro.createdAt.toLocaleString()}</span>
                </div>
                {selectedMacro.lastRun && (
                  <div className="info-item">
                    <label>Last Run:</label>
                    <span>{selectedMacro.lastRun.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="commands-section">
                <h3>Commands</h3>
                <div className="commands-list">
                  {selectedMacro.commands.map((command, index) => (
                    <div key={index} className="command-item">
                      <span className="command-number">{index + 1}</span>
                      <code className="command-text">{command}</code>
                    </div>
                  ))}
                </div>
              </div>

              {selectedMacro.parameters.length > 0 && (
                <div className="parameters-section">
                  <h3>Parameters</h3>
                  <div className="parameters-list">
                    {selectedMacro.parameters.map(parameter => (
                      <div key={parameter} className="parameter-item">
                        <span className="parameter-name">{parameter}</span>
                        <input
                          type="text"
                          value={parameterValues[parameter] || ""}
                          onChange={(e) => setParameterValues(prev => ({
                            ...prev,
                            [parameter]: e.target.value
                          }))}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                              e.preventDefault();
                              e.currentTarget.select();
                            }
                          }}
                          placeholder={`Enter value for ${parameter}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parameter popup */}
              {parameterPopup && parameterPopup.show && (
                <div
                  className="parameter-popup"
                  style={{
                    position: 'fixed',
                    left: parameterPopup.x,
                    top: parameterPopup.y,
                    zIndex: 1000
                  }}
                >
                  <div className="popup-header">
                    <span>Select Parameter</span>
                  </div>
                  <div className="popup-content">
                    {selectedMacro?.parameters
                      .filter(param => param.toLowerCase().includes(parameterPopup.filter.toLowerCase()))
                      .map(param => (
                        <div
                          key={param}
                          className="popup-item"
                          onClick={() => selectParameter(param)}
                        >
                          {param}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="welcome">
              <h2>Welcome to MacroFlow</h2>
              <p>Create and manage powerful command macros with ease.</p>
              <div className="welcome-features">
                <div className="feature">
                  <h3>Execute Commands</h3>
                  <p>Run multiple commands with a single click</p>
                </div>
                <div className="feature">
                  <h3>Concurrent & Sequential</h3>
                  <p>Choose how your commands execute</p>
                </div>
                <div className="feature">
                  <h3>Parameter Support</h3>
                  <p>Use placeholders for dynamic values</p>
                </div>
                <div className="feature">
                  <h3>Save & Share</h3>
                  <p>Export and import your macro collections</p>
                </div>
              </div>
              <button className="btn-primary" onClick={handleNewMacro}>
                Create Your First Macro
              </button>
            </div>
          )}
        </main>

        {/* Global Terminal */}
        {showTerminal && (
          <div className="global-terminal">
            <div className="terminal-header">
              <button
                className="btn-close"
                onClick={() => setShowTerminal(false)}
              >
                ×
              </button>
              <h3>Terminal</h3>
            </div>
            <div className="terminal-content" onClick={() => {
              const input = document.querySelector('.terminal-input') as HTMLInputElement;
              if (input) input.focus();
            }}>
              <div className="terminal-output">
                {terminalOutput.map((line, index) => (
                  <div key={index} className="terminal-line">
                    {line}
                  </div>
                ))}
              </div>
              <div className="terminal-input-line">
                <span className="terminal-prompt">$ </span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={handleTerminalInput}
                  className="terminal-input"
                  placeholder="Type commands here..."
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}

        {/* Install Prompt */}
        {showInstallPrompt && (
          <div className="install-prompt-overlay">
            <div className="install-prompt-popup">
              <div className="popup-header">
                <h3>Install MacroFlow Command</h3>
              </div>
              <div className="install-content">
                <p>MacroFlow needs to install a system-wide command to enable terminal access to your macros.</p>
                <p>This will allow you to run macros from any terminal using: <code>macro &lt;alias&gt; &lt;parameters&gt;</code></p>
                <div className="install-actions">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.executeCommand("cd " + process.cwd() + " && ./scripts/install-alias.sh").then((result: any) => {
                          if (!result.error) {
                            setShowInstallPrompt(false);
                            alert("✅ MacroFlow command installed successfully!\n\nYou can now use 'macro <alias> <parameters>' from any terminal.");
                          } else {
                            alert("❌ Installation failed. Please run './scripts/install-alias.sh' manually.");
                          }
                        });
                      }
                    }}
                  >
                    Install Now
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowInstallPrompt(false)}
                  >
                    Install Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Popup */}
        {showKeyboardShortcuts && (
          <div className="keyboard-shortcuts-overlay" onClick={() => setShowKeyboardShortcuts(false)}>
            <div className="keyboard-shortcuts-popup" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">
                <button className="btn-close" onClick={() => setShowKeyboardShortcuts(false)}>×</button>
                <h3>Keyboard Shortcuts</h3>
              </div>
              <div className="shortcuts-content">
                <div className="shortcut-group">
                  <h4>General</h4>
                  <div className="shortcut-item">
                    <span className="shortcut-key">Cmd/Ctrl + N</span>
                    <span className="shortcut-desc">Create new macro</span>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-key">Cmd/Ctrl + I</span>
                    <span className="shortcut-desc">Import macros</span>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-key">Cmd/Ctrl + E</span>
                    <span className="shortcut-desc">Export macros</span>
                  </div>
                </div>
                <div className="shortcut-group">
                  <h4>Editing</h4>
                  <div className="shortcut-item">
                    <span className="shortcut-key">Cmd/Ctrl + A</span>
                    <span className="shortcut-desc">Select all text</span>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-key">Cmd/Ctrl + Z</span>
                    <span className="shortcut-desc">Undo</span>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-key">Cmd/Ctrl + Y</span>
                    <span className="shortcut-desc">Redo</span>
                  </div>
                </div>
                <div className="shortcut-group">
                  <h4>Terminal</h4>
                  <div className="shortcut-item">
                    <span className="shortcut-key">↑/↓</span>
                    <span className="shortcut-desc">Navigate command history</span>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-key">Cmd/Ctrl + A</span>
                    <span className="shortcut-desc">Select all in terminal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
