# Stage 1: Build the React frontend
FROM node:14 AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Set up the production environment
FROM arm64v8/node:14-alpine
WORKDIR /app

# Install necessary system dependencies
RUN apk add --no-cache openssl

# Copy built frontend from stage 1
COPY --from=frontend-build /app/build ./frontend

# Copy backend files
COPY server.js package*.json ./
COPY get-ip.js ./

# Install production dependencies
RUN npm install --only=production

# Generate SSL certificates
RUN openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# Create uploads directory
RUN mkdir uploads

# Install serve to run the frontend
RUN npm install -g serve

# Expose ports for frontend and backend
EXPOSE 3000 3001

# Start both frontend and backend
CMD ["sh", "-c", "node get-ip.js && npm run server & serve -s frontend -l 3000 --ssl-cert cert.pem --ssl-key key.pem"]