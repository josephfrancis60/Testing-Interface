#!/bin/bash

# Set the GitHub repo URL
GITHUB_REPO="https://github.com/josephfrancis60/Testing-Interface.git"

# Set the project folder name
PROJECT_FOLDER="Testing-Interface"

echo "🚀 Starting Full-Stack Project Setup..."

# ### 1️⃣ CHECK & INSTALL GIT ###
# if ! command -v git &> /dev/null; then
#     echo "📌 Git not found! Installing..."
#     sudo apt update && sudo apt install -y git
# else
#     echo "✅ Git is already installed."
# fi

### 2️⃣ CHECK & INSTALL NODE.JS + NPM (Latest) ###
if ! command -v node &> /dev/null; then
    echo "📌 Node.js not found! Installing the latest version..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js is already installed."
fi

### 3️⃣ CLONE THE REPOSITORY ###
if [ ! -d "$PROJECT_FOLDER" ]; then
    echo "📥 Cloning the repository..."
    git clone $GITHUB_REPO
else
    echo "✅ Repository already exists. Pulling latest changes..."
    cd $PROJECT_FOLDER && git pull origin main && cd ..
fi

# Navigate into the project directory
cd $PROJECT_FOLDER || { echo "❌ Failed to enter project directory!"; exit 1; }

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
