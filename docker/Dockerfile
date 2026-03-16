# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (layer caching)
COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci --include=dev

# Copy source and compile
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production Runtime ───────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Security: run as non-root user
RUN addgroup -S uwgroup && adduser -S uwuser -G uwgroup

# Only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Rules are mounted as a volume — copy defaults
COPY rules/ ./rules/

# Create log directory
RUN mkdir -p logs && chown -R uwuser:uwgroup /app

USER uwuser

EXPOSE 3000

# Graceful shutdown support
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/v1/health || exit 1

CMD ["node", "dist/index.js"]
