FROM node:22-bullseye

# Install python + pip, then install yt-dlp via pip (works on Debian bullseye)
RUN apt-get update \
  && apt-get install -y python3 python3-pip ca-certificates \
  && pip3 install --no-cache-dir -U yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=10000
EXPOSE 10000

CMD ["node", "index.js"]
