# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build || true

# Production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps
COPY package*.json ./
RUN npm ci --production

# Copy source
COPY --from=builder /app .

# Create uploads dir
RUN mkdir -p uploads

EXPOSE 5001
CMD ["node", "src/index.js"]
