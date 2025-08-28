# MacroFlow

A powerful desktop application for creating, managing, and executing command macros with a beautiful GUI. MacroFlow supports both concurrent and sequential execution modes, parameter substitution, and provides a modern interface for developers.

## Features

- **Macro Management**: Create, edit, and organize command macros
- **Dual Execution Modes**: Choose between concurrent or sequential execution
- **Parameter Support**: Use placeholders like `{{filepath}}` for dynamic values
- **Persistent Storage**: Macros are saved locally and persist between sessions
- **Import/Export**: Share macro collections with JSON export/import
- **Beautiful UI**: Modern, responsive interface with smooth animations
- **Secure**: Built with Electron security best practices
- **Embedded Terminal**: Full interactive terminal with real command execution, command history, and macro support
- **Copy Commands**: Copy macro commands to clipboard for external use
- **Macro Copying**: Easily duplicate and modify existing macros with "Copy Values" button
- **Parameter Highlighting**: Parameters are displayed as highlighted blocks in commands
- **Duplicate Prevention**: Prevents creation of macros with duplicate aliases
- **Keyboard Shortcuts**: Easy access to all shortcuts via keyboard icon
- **Detailed Timestamps**: Shows creation and last run times with full timestamps

## Examples

### Simple Test Macro

Create a macro named "test" that runs:

```bash
NODE_ENV=test TS_NODE_COMPILER_OPTIONS='{ "strict": false }' npx mocha -r {{filepath}}
```

### Multiple File Testing

Create a macro named "testmultiple" with two commands:

1. `NODE_ENV=test TS_NODE_COMPILER_OPTIONS='{ "strict": false }' npx mocha -r {{filepath1}}`
2. `NODE_ENV=test TS_NODE_COMPILER_OPTIONS='{ "strict": false }' npx mocha -r {{filepath2}}`

Choose "concurrent" mode to run both tests simultaneously, or "sequential" to run them one after another.

### File Processing

Create a macro for processing files:

```bash
node process.js {{inputfile}}
gzip {{inputfile}}
mv {{inputfile}}.gz {{outputdir}}/
```

## Prerequisites

- Node.js (v16 or later)
- npm (v8 or later)

## Quick Start

### 1. Run the Setup Script

```bash
./setup.sh
```

This will:

- Check your Node.js and npm versions
- Install all project dependencies
- Set up the development environment

### 2. Start Development

```bash
npm run dev
```

This starts the webpack dev server and launches the Electron application.

### Alternative: Use the development script

```bash
./dev.sh
```

## Manual Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the application:**

   ```bash
   # Development mode
   npm run dev
   
   # Or build and run the Electron app
   npm run electron-pack
   ```

## Building Applications

### Build for macOS

```bash
# Build for macOS
npm run build:macos
```

This creates a standalone macOS application that can be distributed and run without development tools.

## Usage

### Creating Macros

1. Click "New Macro" or use `Cmd/Ctrl+N`
2. Enter a name and description
3. Choose execution mode:
   - **Sequential**: Commands run one after another
   - **Concurrent**: All commands run simultaneously
4. Add commands using parameter placeholders like `<filepath>`
5. Define parameters (without the `<>` brackets)
6. Save your macro

### Running Macros

1. **From GUI**:
   - Select a macro from the sidebar
   - Fill in parameter values if needed
   - Click "Run" to execute
   - View results in the embedded terminal

2. **From Embedded Terminal**:
   - Type `macro <alias> <parameters>` in the terminal
   - Example: `macro test /path/to/file.js`

3. **From System Terminal**:
   - Install aliases: `./scripts/install-alias.sh`
   - Use: `macro <alias> <parameters>`

### Parameter Substitution

Use placeholders in your commands:

- `{{filepath}}` → Replaced with the filepath parameter value
- `{{filename}}` → Replaced with the filename parameter value
- `{{directory}}` → Replaced with the directory parameter value

**Parameter Popup**: When typing `{{` in a command, a popup will appear showing all available parameters. Continue typing to filter the list, then click to select.

### Import/Export

- **Export**: File → Export Macros (saves as JSON)
- **Import**: File → Import Macros (loads from JSON file)

### Terminal Aliases

After building MacroFlow, you can install system-wide terminal aliases:

```bash
# Build MacroFlow first
npm run build:macos

# Install terminal aliases
./scripts/install-alias.sh
```

This creates a global `macro` command that you can use from any terminal:

```bash
# Run a macro
macro test /path/to/file.js

# Run a macro with multiple parameters
macro testmultiple file1.js file2.js

# List available macros
macro list
```

The alias works across all terminals (bash, zsh, fish) and persists between sessions.

## Available Scripts

- `npm run dev` - Start development server
- `npm run electron-pack` - Build Electron app for macOS
- `npm run build:macos` - Build standalone app for macOS
- `npm run webpack-dev` - Start webpack dev server only
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Architecture

MacroFlow is built with:

- **Electron**: Cross-platform desktop app framework
- **React**: UI framework with TypeScript
- **Webpack**: Module bundler and dev server
- **Local Storage**: Data persistence for macros

The application uses a secure architecture with:

- Context isolation enabled
- Node integration disabled
- Preload scripts for safe API exposure
- Content Security Policy (CSP)

## Security Features

- **Context Isolation**: Renderer process cannot access Node.js APIs directly
- **Preload Scripts**: Safe API exposure through contextBridge
- **Content Security Policy**: Prevents XSS and other attacks
- **Secure Defaults**: Electron security best practices implemented

## Troubleshooting

### Common Issues

1. **Build issues:**

   ```bash
   # Clean and rebuild
   npm run clean:dist
   npm install
   ```

2. **Electron issues:**

   ```bash
   # Clear Electron cache
   rm -rf node_modules/.cache
   npm install
   ```

3. **TypeScript errors:**
   - Ensure all dependencies are installed: `npm install`
   - Check TypeScript configuration in `tsconfig.json`

### Getting Help

- Check the troubleshooting section above
- Review the [Electron documentation](https://www.electronjs.org/docs)
- Create a new issue with detailed error information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the [Electron documentation](https://www.electronjs.org/docs)
3. Search existing GitHub issues
4. Create a new issue with detailed error information

## Next Steps

Once you have MacroFlow running:

1. Create your first macro
2. Test different execution modes
3. Experiment with parameter substitution
4. Export and share your macro collections
5. Build standalone applications for distribution

## Example Macros

### Development Workflow

```json
{
  "name": "Dev Setup",
  "description": "Setup development environment",
  "commands": [
    "npm install",
    "npm run build",
    "npm start"
  ],
  "executionMode": "sequential"
}
```

### Testing Suite

```json
{
  "name": "Test Suite",
  "description": "Run comprehensive tests",
  "commands": [
    "npm run test:unit",
    "npm run test:integration",
    "npm run test:e2e"
  ],
  "executionMode": "concurrent"
}
```

### File Processing and Automation

```json
{
  "name": "Process Files",
  "description": "Process multiple files",
  "commands": [
    "node process.js {{inputfile}}",
    "gzip {{inputfile}}",
    "mv {{inputfile}}.gz {{outputdir}}/"
  ],
  "executionMode": "sequential",
  "parameters": ["inputfile", "outputdir"]
}
```
