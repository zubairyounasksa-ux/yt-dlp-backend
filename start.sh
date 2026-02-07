#!/bin/bash

# Make script executable
chmod +x start.sh

# Install yt-dlp
echo "Installing yt-dlp..."
pip install yt-dlp

# Start Node.js server
echo "Starting server..."
node index.js
