# שלב 1: בנייה (Builder)
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
COPY . .

# יצירת הקבצים ובנייה
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN ./node_modules/.bin/nx build api --configuration=production

# שלב 2: הרצה (Runner)
FROM node:22-slim
WORKDIR /app

# התקנת ספריות קריטיות כפי שהוצע ב-Issue
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*
# ... הכל אותו דבר עד שלב ה-Runner ...

# העתקה מהשלב שקראנו לו builder
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/apps/api/prisma /app/prisma

# הסוד: מצביעים לבינארי שנמצא בתוך התיקייה החדשה שיצרנו ב-dist
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/dist/prisma-client/libquery_engine-debian-openssl-3.0.x.so.node

# פקודת ההרצה
CMD npx prisma generate --schema=/app/prisma/schema.prisma && \
    npx prisma migrate deploy --schema=/app/prisma/schema.prisma && \
    node dist/api/main.js