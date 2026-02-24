# שלב 1: בנייה
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
COPY . .

# יצירת הקבצים ובנייה
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN ./node_modules/.bin/nx build api --configuration=production

# שלב 2: הרצה
FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# העתקת כל מה שצריך
COPY --from=builder /app/dist/api ./dist/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma

# יצירת תיקיות
RUN mkdir -p uploads/images && chmod -R 777 uploads

ENV PORT=3000
EXPOSE 3000

# הסוד: הרצת generate נוסף בסביבת הריצה לפני ה-Migration
CMD npx prisma generate --schema=./prisma/schema.prisma && \
    npx prisma migrate deploy --schema=./prisma/schema.prisma && \
    node dist/api/main.js