# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY tsconfig.base.json ./

WORKDIR /app/apps/api
COPY apps/api/prisma ./prisma
RUN npm install

COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./

RUN npx prisma generate
RUN npx tsc

# Stage 2: Production
FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY apps/api/package*.json ./

RUN npm install --production
RUN npx prisma generate

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
