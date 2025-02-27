#!/bin/bash

# Set the project folder name
PROJECT_FOLDER="Testing-Interface-main"

echo "🚀 Starting Full-Stack Project Setup..."

### 2️⃣ CHECK & INSTALL NODE.JS + NPM (Latest) ###
if ! command -v node &> /dev/null; then
    echo "📌 Node.js not found! Installing the latest version..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js is already installed."
fi

# Navigate into the project directory
cd "$PROJECT_FOLDER" || { echo "❌ Failed to enter project directory!"; exit 1; }

### 4️⃣ INSTALL BACKEND DEPENDENCIES ###
if [ -d "backend" ]; then
    echo "📡 Setting up Backend..."
    cd backend
    if [ ! -d "node_modules" ]; then
        npm install
    else
        echo "✅ Backend dependencies already installed."
    fi
    cd ..
else
    echo "❌ Backend folder is missing!"
    exit 1
fi

### 5️⃣ INSTALL FRONTEND DEPENDENCIES ###
if [ -d "frontend" ]; then
    echo "🎨 Setting up Frontend..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        npm install
    else
        echo "✅ Frontend dependencies already installed."
    fi
    cd ..
else
    echo "❌ Frontend folder is missing!"
    exit 1
fi

### 6️⃣ START BACKEND & FRONTEND SERVERS ###
echo "🚀 Starting Backend and Frontend..."
npx concurrently "cd backend && node server.js" "cd frontend && npm run dev"

echo "✅ Project setup complete! Servers are running..."
