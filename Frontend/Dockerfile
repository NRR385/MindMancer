# ==========================================
# Mind-Mancer Frontend - Multi-Stage Dockerfile
# ==========================================

# Stage 1: Build static assets
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json vite.config.ts index.html ./
RUN npm ci

COPY src ./src
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
