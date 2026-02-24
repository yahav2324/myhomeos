# שלב 1: התקנה ובנייה
FROM node:22-slim AS builder
WORKDIR /app

# התקנת ספריות מערכת עבור Prisma
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
COPY . .

# כאן השינוי: הוספת ה-Binary Targets בזמן ה-Generate
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

RUN ./node_modules/.bin/nx build api --configuration=production

# שלב 2: הרצה
FROM node:22-slim
WORKDIR /app

# חשוב: התקנת openssl גם כאן
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist/api ./dist/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma

# יצירת תיקיית ההעלאות בשלב ההרצה
RUN mkdir -p uploads/images && chmod -R 777 uploads

ENV PORT=3000
EXPOSE 3000

CMD npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/api/main.js