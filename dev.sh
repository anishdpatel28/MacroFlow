#!/bin/bash

# MacroFlow Development Script
# This script starts the development environment

set -e

echo "🚀 Starting MacroFlow development environment..."

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "webpack" 2>/dev/null || true
pkill -f "electron" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start the development environment
echo "📦 Starting webpack and Electron..."
npm run webpack-dev & sleep 3 && npm run electron-dev
