# השתמש ב-Image שכולל את כל מה שצריך ל-Build
FROM node:22-slim AS builder
WORKDIR /app

# התקנת תלויות למערכת עבור Prisma
RUN apt-get update && apt-get install -y openssl

# העתקת קבצי הגדרות
COPY package*.json ./
COPY prisma ./prisma/ 
# אם הפריזמה בתוך apps/api, שנה ל: COPY apps/api/prisma ./prisma/

RUN npm install

# העתקת כל שאר הקוד
COPY . .

# הרצת ה-Build דרך ה-NX המקומי בתוך ה-Image
RUN npx nx build api --configuration=production

# שלב הריצה (Runner) - כדי שה-Image יהיה קטן ומהיר
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl
COPY --from=builder /app/dist/api ./dist/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma

# פקודת ההרצה
CMD npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/api/main.js