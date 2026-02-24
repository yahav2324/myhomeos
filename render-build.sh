#!/usr/bin/env bash
# exit on error
set -o errexit

echo "--- Running NPM Install ---"
npm install --ignore-scripts

echo "--- Building API ---"
# הרצה מתוך התיקייה המקומית של המודולים כדי למנוע בלבול של NX
./node_modules/.bin/nx build api --configuration=production

echo "--- Generating Prisma Client ---"
./node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma

echo "--- Build Finished Successfully ---"