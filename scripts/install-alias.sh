#!/bin/bash

# MacroFlow Alias Installation Script
# This script installs system-wide terminal aliases for MacroFlow

set -e

echo "🔧 Installing MacroFlow terminal aliases..."

if [ ! -f "package.json" ] || [ ! -d "electron" ]; then
    echo "❌ Please run this script from the MacroFlow project root directory"
    exit 1
fi

MACROFLOW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$MACROFLOW_DIR/node_modules/.bin/electron" ]; then
    MACROFLOW_APP="NODE_ENV=development $MACROFLOW_DIR/node_modules/.bin/electron $MACROFLOW_DIR/electron/main.js"
elif [[ $(uname -m) == "arm64" ]] && [ -f "$MACROFLOW_DIR/dist/mac-arm64/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/dist/mac-arm64/MacroFlow.app/Contents/MacOS/MacroFlow"
elif [ -f "$MACROFLOW_DIR/dist/mac/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/dist/mac/MacroFlow.app/Contents/MacOS/MacroFlow"
elif [ -f "$MACROFLOW_DIR/dist/macos/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/dist/macos/MacroFlow.app/Contents/MacOS/MacroFlow"
else
    echo "❌ MacroFlow app not found. Please build the application first."
    echo "Available build commands:"
    echo "  npm run build:macos"
    echo "  npm run build:mac-arm64"
    exit 1
fi

# Skip validation for development version (contains NODE_ENV=development)
if [[ "$MACROFLOW_APP" != *"NODE_ENV=development"* ]] && [ ! -f "$MACROFLOW_APP" ]; then
    echo "❌ MacroFlow app not found at $MACROFLOW_APP"
    echo "Please build MacroFlow first: npm run build:macos"
    exit 1
fi

add_function_to_shell() {
    local shell_config="$1"
    local function_cmd="$2"
    
    if [ -f "$shell_config" ]; then
        # Remove existing macro alias or function
        if grep -q "alias macro=" "$shell_config" || grep -q "macro()" "$shell_config"; then
            # Remove old alias/function
            sed -i.bak '/alias macro=/d; /macro()/,/^}/d' "$shell_config"
            echo "🔄 Removed existing macro alias/function from $shell_config"
        fi
        
        echo "$function_cmd" >> "$shell_config"
        echo "✅ Added macro function to $shell_config"
    fi
}

# Create a shell function instead of simple alias to handle CLI flags
if [[ "$MACROFLOW_APP" == *"NODE_ENV=development"* ]]; then
    FUNCTION_CMD='macro() {
    case "$1" in
        --v|--version|-v|-version)
            cd "'$MACROFLOW_DIR'" && NODE_ENV=development "'$MACROFLOW_DIR'/node_modules/.bin/electron" "'$MACROFLOW_DIR'/electron/main.js" "--version"
            ;;
        --help|-help|-h)
            cd "'$MACROFLOW_DIR'" && NODE_ENV=development "'$MACROFLOW_DIR'/node_modules/.bin/electron" "'$MACROFLOW_DIR'/electron/main.js" "--help"
            ;;
        --list|-l)
            cd "'$MACROFLOW_DIR'" && NODE_ENV=development "'$MACROFLOW_DIR'/node_modules/.bin/electron" "'$MACROFLOW_DIR'/electron/main.js" "--list"
            ;;
        "")
            echo "Usage: macro <macro-name> [parameters...]"
            echo "       macro --v, --version, -v, -version   Show version"
            echo "       macro --help, -help, -h              Show help"
            echo "       macro --list, -l                     List all available macros"
            echo ""
            echo "Examples:"
            echo "  macro test               Run macro named '\''test'\''"
            echo "  macro deploy staging     Run macro with parameters"
            ;;
        *)
            cd "'$MACROFLOW_DIR'" && NODE_ENV=development "'$MACROFLOW_DIR'/node_modules/.bin/electron" "'$MACROFLOW_DIR'/electron/main.js" run-macro "$@"
            ;;
    esac
}'
else
    FUNCTION_CMD='macro() {
    case "$1" in
        --v|--version|-v|-version)
            "'$MACROFLOW_APP'" "--version"
            ;;
        --help|-help|-h)
            "'$MACROFLOW_APP'" "--help"
            ;;
        --list|-l)
            "'$MACROFLOW_APP'" "--list"
            ;;
        "")
            echo "Usage: macro <macro-name> [parameters...]"
            echo "       macro --v, --version, -v, -version   Show version"
            echo "       macro --help, -help, -h              Show help"
            echo "       macro --list, -l                     List all available macros"
            echo ""
            echo "Examples:"
            echo "  macro test               Run macro named '\''test'\''"
            echo "  macro deploy staging     Run macro with parameters"
            ;;
        *)
            "'$MACROFLOW_APP'" run-macro "$@"
            ;;
    esac
}'
fi

echo "📝 Adding macro function to shell configurations..."

if [ -f "$HOME/.bashrc" ]; then
    add_function_to_shell "$HOME/.bashrc" "$FUNCTION_CMD"
fi

if [ -f "$HOME/.bash_profile" ]; then
    add_function_to_shell "$HOME/.bash_profile" "$FUNCTION_CMD"
fi

if [ -f "$HOME/.zshrc" ]; then
    add_function_to_shell "$HOME/.zshrc" "$FUNCTION_CMD"
fi

if [ -f "$HOME/.config/fish/config.fish" ]; then
    # Remove existing macro alias from fish config
    if grep -q "alias macro=" "$HOME/.config/fish/config.fish"; then
        sed -i.bak '/alias macro=/d' "$HOME/.config/fish/config.fish"
        echo "🔄 Removed existing macro alias from fish config"
    fi
    
    # Add simple alias for fish (fish doesn't support bash-style functions)
    if [[ "$MACROFLOW_APP" == *"NODE_ENV=development"* ]]; then
        echo "alias macro='cd \"$MACROFLOW_DIR\" && NODE_ENV=development \"$MACROFLOW_DIR/node_modules/.bin/electron\" \"$MACROFLOW_DIR/electron/main.js\" run-macro'" >> "$HOME/.config/fish/config.fish"
    else
        echo "alias macro='$MACROFLOW_APP run-macro'" >> "$HOME/.config/fish/config.fish"
    fi
    echo "✅ Added macro alias to fish config"
fi

GLOBAL_SCRIPT="/usr/local/bin/macro"
echo "🔗 Creating global macro command..."

sudo tee "$GLOBAL_SCRIPT" > /dev/null << EOF
#!/bin/bash
# MacroFlow Global Command
# Usage: macro <macro-name> [parameters...]

MACROFLOW_DIR="$MACROFLOW_DIR"

if [ -f "\$MACROFLOW_DIR/node_modules/.bin/electron" ]; then
    case "\$1" in
        --v|--version|-v|-version)
            cd "\$MACROFLOW_DIR" && NODE_ENV=development "\$MACROFLOW_DIR/node_modules/.bin/electron" "\$MACROFLOW_DIR/electron/main.js" "--version"
            exit \$?
            ;;
        --help|-help|-h)
            cd "\$MACROFLOW_DIR" && NODE_ENV=development "\$MACROFLOW_DIR/node_modules/.bin/electron" "\$MACROFLOW_DIR/electron/main.js" "--help"
            exit \$?
            ;;
        "")
            echo "Usage: macro <macro-name> [parameters...]"
            echo "       macro --v, --version, -v, -version   Show version"
            echo "       macro --help, -help, -h              Show help"
            echo ""
            echo "Examples:"
            echo "  macro test               Run macro named 'test'"
            echo "  macro deploy staging     Run macro with parameters"
            exit 1
            ;;
        *)
            cd "\$MACROFLOW_DIR" && NODE_ENV=development "\$MACROFLOW_DIR/node_modules/.bin/electron" "\$MACROFLOW_DIR/electron/main.js" run-macro "\$@"
            exit \$?
            ;;
    esac
elif [[ \$(uname -m) == "arm64" ]] && [ -f "\$MACROFLOW_DIR/dist/mac-arm64/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="\$MACROFLOW_DIR/dist/mac-arm64/MacroFlow.app/Contents/MacOS/MacroFlow"
elif [ -f "\$MACROFLOW_DIR/dist/mac/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="\$MACROFLOW_DIR/dist/mac/MacroFlow.app/Contents/MacOS/MacroFlow"
elif [ -f "\$MACROFLOW_DIR/dist/macos/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="\$MACROFLOW_DIR/dist/macos/MacroFlow.app/Contents/MacOS/MacroFlow"
else
    echo "❌ MacroFlow not found. Please install MacroFlow first."
    exit 1
fi

if [ ! -f "\$MACROFLOW_APP" ]; then
    echo "❌ MacroFlow not found. Please install MacroFlow first."
    exit 1
fi

case "\$1" in
    --v|--version|-v|-version)
        "\$MACROFLOW_APP" "--version"
        exit \$?
        ;;
    --help|-help|-h)
        "\$MACROFLOW_APP" "--help"
        exit \$?
        ;;
    "")
        echo "Usage: macro <macro-name> [parameters...]"
        echo "       macro --v, --version, -v, -version   Show version"
        echo "       macro --help, -help, -h              Show help"
        echo ""
        echo "Examples:"
        echo "  macro test               Run macro named 'test'"
        echo "  macro deploy staging     Run macro with parameters"
        exit 1
        ;;
    *)
        MACRO_NAME="\$1"
        shift
        PARAMS="\$@"
        "\$MACROFLOW_APP" run-macro "\$MACRO_NAME" \$PARAMS
        ;;
esac
EOF

sudo chmod +x "$GLOBAL_SCRIPT"

echo "📚 Installing man page..."
MAN_DIR="/usr/local/share/man/man1"
sudo mkdir -p "$MAN_DIR"
sudo cp "$MACROFLOW_DIR/scripts/macro.1" "$MAN_DIR/"
sudo chmod 644 "$MAN_DIR/macro.1"
echo "✅ Man page installed to $MAN_DIR/macro.1"

echo ""
echo "🎉 MacroFlow aliases installed successfully!"
echo ""
echo "📋 Usage examples:"
echo "  macro test /path/to/file.js"
echo "  macro testmultiple file1.js file2.js"
echo "  macro dev-setup"
echo "  macro --help
echo "  macro -v
echo "  man macro
echo ""
echo "🔄 To use the aliases in current terminal:"
echo "  source ~/.zshrc  # or ~/.bashrc"
echo ""
echo "🌐 The 'macro' command is now available globally!"
echo "   You can use it from any terminal or script."
