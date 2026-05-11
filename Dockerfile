# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm install --production

# Stage 2: Production
FROM node:20-slim
WORKDIR /app

# Create a non-root user for security
RUN groupadd -r clouduser && useradd -r -g clouduser clouduser

# Copy only necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY app/ .

# Set permissions
RUN chown -R clouduser:clouduser /app

# Use non-root user
USER clouduser

EXPOSE 3000
CMD ["node", "server.js"]
