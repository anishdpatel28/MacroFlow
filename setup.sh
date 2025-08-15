#!/bin/bash

# MacroFlow Setup Script
# This script helps set up the MacroFlow Electron project

set -e

echo "🚀 Setting up MacroFlow..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first:"
    echo "   brew install node"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi
echo "✅ npm version: $(npm -v)"

# Install project dependencies
echo "📦 Installing project dependencies..."
if npm install; then
    echo "✅ Project dependencies installed"
else
    echo "❌ Failed to install project dependencies"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🚀 To run the application:"
echo "   1. Start the development server: npm run dev"
echo "   2. Or build the Electron app: npm run electron-pack"
echo ""
echo "📖 For more information, see README.md"
