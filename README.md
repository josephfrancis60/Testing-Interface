# Testing-Interface

This repository contains a full-stack application with Node.js and React. 

## Project Setup

There are two ways to set up this project: automated setup using the provided script: **`setup.sh`** or manual installation.

### Option 1: Automated Setup (Recommended)

The repository includes a `setup.sh` script that automates the entire installation and startup process.

1. Clone the repository:
   ```bash
   git clone https://github.com/josephfrancis60/Testing-Interface.git
   ```
   or `Download ZIP file` and extract it.


2. Make the setup script executable:
   ```bash
   cd <Project-root-folder>
   chmod +x setup.sh
   ```

3. Run the setup script:
   ```bash
   ./setup.sh
   ```

The script will:
- Check and install Node.js (v18.x) if needed
- Clone the repository (or pull latest changes if already cloned)
- Install backend dependencies
- Install frontend dependencies
- Start both backend and frontend servers concurrently


### Option 2: Manual Setup

If you prefer to set up the project manually, follow these steps:

1. Prerequisites:
    - Git - `https://git-scm.com/downloads`
   - Node.js and npm -  `https://nodejs.org/en/download`

   To install these prerequisites on Ubuntu/Debian:
   ```bash
   sudo apt update
   sudo apt install -y git
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/josephfrancis60/Testing-Interface.git
   cd Testing-Interface
   ```

3. Set up the backend:
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. Set up the frontend:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. Start the backend server:
   ```bash
   cd backend
   node server.js
   ```

6. In a separate terminal, start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

## Project Structure

- `/backend` - Node.js backend server
- `/frontend` - React frontend application
- `/setup.sh` - Script for automated setup

## Development

After setup, the backend server should be running at http://localhost:3001 (or your configured port) and the frontend development server at http://localhost:5173 (default Vite port).

## Troubleshooting

If you encounter any issues during setup:

1. Make sure you have the correct permissions to execute the setup script
2. Verify that your system meets the prerequisites
3. Check for error messages in the console output
4. If the automated setup fails, try the manual setup steps

## Contributors

- Joseph Francis