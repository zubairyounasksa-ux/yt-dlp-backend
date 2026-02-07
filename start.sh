#!/usr/bin/env bash

echo "Installing Node dependencies..."
npm install

echo "Installing yt-dlp..."
pip install yt-dlp

echo "Starting server..."
node index.js
