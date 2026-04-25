# ─── Stage 1: Build frontend ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ─── Stage 2: Production backend + serve frontend dist ─────────────────────
FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ .

# Copy Vue build output into backend's public folder
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 3000

USER node

CMD ["node", "index.js"]