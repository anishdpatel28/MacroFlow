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

if [[ $(uname -m) == "arm64" ]] && [ -f "$MACROFLOW_DIR/dist/mac-arm64/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/dist/mac-arm64/MacroFlow.app/Contents/MacOS/MacroFlow"
elif [ -f "$MACROFLOW_DIR/dist/mac/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/dist/mac/MacroFlow.app/Contents/MacOS/MacroFlow"
elif [ -f "$MACROFLOW_DIR/dist/macos/MacroFlow.app/Contents/MacOS/MacroFlow" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/dist/macos/MacroFlow.app/Contents/MacOS/MacroFlow"
elif [ -f "$MACROFLOW_DIR/node_modules/.bin/electron" ]; then
    MACROFLOW_APP="$MACROFLOW_DIR/node_modules/.bin/electron $MACROFLOW_DIR/electron/main.js"
else
    echo "❌ MacroFlow app not found. Please build the application first."
    echo "Available build commands:"
    echo "  npm run build:macos"
    echo "  npm run build:mac-arm64"
    exit 1
fi

if [ ! -f "$MACROFLOW_APP" ]; then
    echo "❌ MacroFlow app not found at $MACROFLOW_APP"
    echo "Please build MacroFlow first: npm run build:macos"
    exit 1
fi

add_alias_to_shell() {
    local shell_config="$1"
    local alias_line="$2"
    
    if [ -f "$shell_config" ]; then
        if ! grep -q "alias macro=" "$shell_config"; then
            echo "$alias_line" >> "$shell_config"
            echo "✅ Added alias to $shell_config"
        else
            echo "⚠️  Alias already exists in $shell_config"
        fi
    fi
}

ALIAS_CMD="alias macro='$MACROFLOW_APP run-macro'"

echo "📝 Adding macro alias to shell configurations..."

if [ -f "$HOME/.bashrc" ]; then
    add_alias_to_shell "$HOME/.bashrc" "$ALIAS_CMD"
fi

if [ -f "$HOME/.bash_profile" ]; then
    add_alias_to_shell "$HOME/.bash_profile" "$ALIAS_CMD"
fi

if [ -f "$HOME/.zshrc" ]; then
    add_alias_to_shell "$HOME/.zshrc" "$ALIAS_CMD"
fi

if [ -f "$HOME/.config/fish/config.fish" ]; then
    if ! grep -q "alias macro=" "$HOME/.config/fish/config.fish"; then
        echo "alias macro '$MACROFLOW_APP run-macro'" >> "$HOME/.config/fish/config.fish"
        echo "✅ Added alias to fish config"
    else
        echo "⚠️  Alias already exists in fish config"
    fi
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
        --v|--version)
            cd "\$MACROFLOW_DIR" && NODE_ENV=development "\$MACROFLOW_DIR/node_modules/.bin/electron" "\$MACROFLOW_DIR/electron/main.js" "\$1"
            exit \$?
            ;;
        --help)
            cd "\$MACROFLOW_DIR" && NODE_ENV=development "\$MACROFLOW_DIR/node_modules/.bin/electron" "\$MACROFLOW_DIR/electron/main.js" "\$1"
            exit \$?
            ;;
        "")
            echo "Usage: macro <macro-name> [parameters...]"
            echo "       macro --v, --version   Show version"
            echo "       macro --help           Show help"
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
    --v|--version)
        "\$MACROFLOW_APP" "\$1"
        exit \$?
        ;;
    --help)
        "\$MACROFLOW_APP" "\$1"
        exit \$?
        ;;
    "")
        echo "Usage: macro <macro-name> [parameters...]"
        echo "       macro --v, --version   Show version"
        echo "       macro --help           Show help"
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
