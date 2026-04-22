FROM node:20-alpine

# better-sqlite3 needs python + build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p data

EXPOSE 4000

CMD ["node", "server.js"]
