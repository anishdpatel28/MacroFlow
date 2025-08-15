#!/bin/bash

# MacroFlow Alias Installation Script
# This script installs system-wide terminal aliases for MacroFlow

set -e

echo "🔧 Installing MacroFlow terminal aliases..."

# Get the directory where MacroFlow is installed
MACROFLOW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Try to find the MacroFlow app (prefer arm64 on Apple Silicon)
if [[ $(uname -m) == "arm64" ]] && [ -f "$MACROFLOW_DIR/dist/mac-arm64/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/dist/mac-arm64/MacroFlow.app/Contents/MacOS/MacroFlow"
elif [ -f "$MACROFLOW_DIR/dist/mac/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/dist/mac/MacroFlow.app/Contents/MacOS/MacroFlow"
else
    MACROFLOW_APP="$MACROFLOW_DIR/dist/macos/MacroFlow.app/Contents/MacOS/MacroFlow"
fi

# Check if MacroFlow app exists
if [ ! -f "$MACROFLOW_APP" ]; then
    echo "❌ MacroFlow app not found at $MACROFLOW_APP"
    echo "Please build MacroFlow first: npm run build:macos"
    exit 1
fi

# Function to add alias to shell config
add_alias_to_shell() {
    local shell_config="$1"
    local alias_line="$2"
    
    if [ -f "$shell_config" ]; then
        # Check if alias already exists
        if ! grep -q "alias macro=" "$shell_config"; then
            echo "$alias_line" >> "$shell_config"
            echo "✅ Added alias to $shell_config"
        else
            echo "⚠️  Alias already exists in $shell_config"
        fi
    fi
}

# Create the alias command
ALIAS_CMD="alias macro='$MACROFLOW_APP run-macro'"

# Add to different shell configurations
echo "📝 Adding macro alias to shell configurations..."

# Bash
if [ -f "$HOME/.bashrc" ]; then
    add_alias_to_shell "$HOME/.bashrc" "$ALIAS_CMD"
fi

if [ -f "$HOME/.bash_profile" ]; then
    add_alias_to_shell "$HOME/.bash_profile" "$ALIAS_CMD"
fi

# Zsh
if [ -f "$HOME/.zshrc" ]; then
    add_alias_to_shell "$HOME/.zshrc" "$ALIAS_CMD"
fi

# Fish
if [ -f "$HOME/.config/fish/config.fish" ]; then
    if ! grep -q "alias macro=" "$HOME/.config/fish/config.fish"; then
        echo "alias macro '$MACROFLOW_APP run-macro'" >> "$HOME/.config/fish/config.fish"
        echo "✅ Added alias to fish config"
    else
        echo "⚠️  Alias already exists in fish config"
    fi
fi

# Create a global alias script
GLOBAL_SCRIPT="/usr/local/bin/macro"
echo "🔗 Creating global macro command..."

sudo tee "$GLOBAL_SCRIPT" > /dev/null << EOF
#!/bin/bash
# MacroFlow Global Command
# Usage: macro <macro-name> [parameters...]

MACROFLOW_APP="$MACROFLOW_APP"

if [ ! -f "\$MACROFLOW_APP" ]; then
    echo "❌ MacroFlow not found. Please install MacroFlow first."
    exit 1
fi

if [ \$# -eq 0 ]; then
    echo "Usage: macro <macro-name> [parameters...]"
    echo "Example: macro test /path/to/file.js"
    echo "Example: macro testmultiple file1.js file2.js"
    exit 1
fi

MACRO_NAME="\$1"
shift
PARAMS="\$@"

# Execute the macro through MacroFlow
"\$MACROFLOW_APP" run-macro "\$MACRO_NAME" \$PARAMS
EOF

# Make the global script executable
sudo chmod +x "$GLOBAL_SCRIPT"

echo ""
echo "🎉 MacroFlow aliases installed successfully!"
echo ""
echo "📋 Usage examples:"
echo "  macro test /path/to/file.js"
echo "  macro testmultiple file1.js file2.js"
echo "  macro dev-setup"
echo ""
echo "🔄 To use the aliases in current terminal:"
echo "  source ~/.zshrc  # or ~/.bashrc"
echo ""
echo "🌐 The 'macro' command is now available globally!"
echo "   You can use it from any terminal or script."
