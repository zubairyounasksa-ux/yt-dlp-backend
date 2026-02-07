#!/bin/bash

# Exit on errors
set -e

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Install yt-dlp via pip
echo "Installing yt-dlp..."
pip install yt-dlp

# Start the server
echo "Starting server..."
node index.js
