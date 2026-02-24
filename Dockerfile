# שלב 2: הרצה
FROM node:22-slim
WORKDIR /app

# התקנת ספריות קריטיות כפי שהוצע ב-Issue
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# העתקת התוצרים מה-builder
COPY --from=builder /app/dist/api ./dist/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma

# הגדרת נתיב מפורש למנוע של פריזמה (זה פותר את בעיית ה-Unknown Binary)
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node

# יצירת תיקיית העלאות
RUN mkdir -p uploads/images && chmod -R 777 uploads

ENV PORT=3000
EXPOSE 3000

# הרצה: יצירת ה-Client בסביבה הסופית והפעלה
CMD npx prisma generate --schema=./prisma/schema.prisma && \
    npx prisma migrate deploy --schema=./prisma/schema.prisma && \
    node dist/api/main.js