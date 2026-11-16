FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source (exclude node_modules via .dockerignore)
COPY . .

EXPOSE 3000

# Use 0.0.0.0 so the container is reachable from host
ENV HOSTNAME=0.0.0.0
CMD ["npm", "run", "dev"]
