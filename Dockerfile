# שלב 1: התקנה ובנייה
FROM node:22-slim AS builder
WORKDIR /app

# התקנת ספריות מערכת עבור Prisma
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# העתקת קבצי הגדרות מהשורש
COPY package*.json ./

# התקנת כל ה-Dependencies
RUN npm install

# העתקת כל שאר הקוד
COPY . .

# יצירת ה-Client של Prisma (מתוך הנתיב ב-Monorepo)
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# הרצת ה-Build של ה-API דרך ה-NX המקומי
RUN ./node_modules/.bin/nx build api --configuration=production

# שלב 2: הרצה
FROM node:22-slim
WORKDIR /app

# התקנת openssl בסביבת ההרצה
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# העתקת הקוד המקומפל והמודולים מהשלב הקודם
COPY --from=builder /app/dist/api ./dist/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma

# הגדרת משתנה סביבה לפורט
ENV PORT=3000
EXPOSE 3000

# פקודת ההרצה: עדכון ה-DB והפעלת השרת
CMD npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/api/main.js