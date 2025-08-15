#!/bin/bash

# MacroFlow Alias Uninstallation Script
# This script removes system-wide terminal aliases for MacroFlow

set -e

echo "🧹 Uninstalling MacroFlow terminal aliases..."

# Function to remove alias from shell config
remove_alias_from_shell() {
    local shell_config="$1"
    
    if [ -f "$shell_config" ]; then
        # Remove alias line if it exists
        if grep -q "alias macro=" "$shell_config"; then
            sed -i '' '/alias macro=/d' "$shell_config"
            echo "✅ Removed alias from $shell_config"
        else
            echo "⚠️  No alias found in $shell_config"
        fi
    fi
}

# Remove from different shell configurations
echo "📝 Removing macro alias from shell configurations..."

# Bash
if [ -f "$HOME/.bashrc" ]; then
    remove_alias_from_shell "$HOME/.bashrc"
fi

if [ -f "$HOME/.bash_profile" ]; then
    remove_alias_from_shell "$HOME/.bash_profile"
fi

# Zsh
if [ -f "$HOME/.zshrc" ]; then
    remove_alias_from_shell "$HOME/.zshrc"
fi

# Fish
if [ -f "$HOME/.config/fish/config.fish" ]; then
    if grep -q "alias macro=" "$HOME/.config/fish/config.fish"; then
        sed -i '' '/alias macro=/d' "$HOME/.config/fish/config.fish"
        echo "✅ Removed alias from fish config"
    else
        echo "⚠️  No alias found in fish config"
    fi
fi

# Remove global macro command
GLOBAL_SCRIPT="/usr/local/bin/macro"
if [ -f "$GLOBAL_SCRIPT" ]; then
    sudo rm "$GLOBAL_SCRIPT"
    echo "✅ Removed global macro command"
else
    echo "⚠️  Global macro command not found"
fi

echo ""
echo "🎉 MacroFlow aliases uninstalled successfully!"
echo ""
echo "🔄 To apply changes in current terminal:"
echo "  source ~/.zshrc  # or ~/.bashrc"
echo ""
echo "📝 You can reinstall the aliases anytime by running:"
echo "  ./scripts/install-alias.sh"
