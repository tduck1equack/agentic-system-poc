FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]
