#!/bin/bash

# MacroFlow Alias Uninstallation Script
# This script removes system-wide terminal aliases for MacroFlow

set -e

echo "🧹 Uninstalling MacroFlow terminal aliases..."

if [ -f "/usr/local/bin/macro" ]; then
    sudo rm -f "/usr/local/bin/macro"
    echo "✅ Removed global macro command"
else
    echo "⚠️  Global macro command not found"
fi

remove_alias_from_shell() {
    local shell_config="$1"
    
    if [ -f "$shell_config" ]; then
        if grep -q "alias macro=" "$shell_config"; then
            sed -i '' '/alias macro=/d' "$shell_config"
            echo "✅ Removed alias from $shell_config"
        else
            echo "⚠️  No alias found in $shell_config"
        fi
    fi
}

echo "📝 Removing macro alias from shell configurations..."

remove_alias_from_shell "$HOME/.bashrc"
remove_alias_from_shell "$HOME/.bash_profile"

remove_alias_from_shell "$HOME/.zshrc"

if [ -f "$HOME/.config/fish/config.fish" ]; then
    if grep -q "alias macro=" "$HOME/.config/fish/config.fish"; then
        sed -i '' '/alias macro=/d' "$HOME/.config/fish/config.fish"
        echo "✅ Removed alias from fish config"
    else
        echo "⚠️  No alias found in fish config"
    fi
fi

echo ""
echo "🎉 MacroFlow aliases uninstalled successfully!"
echo ""
echo "🔄 To apply changes in current terminal:"
echo "  source ~/.zshrc  # or ~/.bashrc"
