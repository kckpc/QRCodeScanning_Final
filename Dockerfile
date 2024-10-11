# Stage 1: Build the React frontend
FROM node:14 AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Set up the production environment
FROM node:14-alpine
WORKDIR /app

# Copy built frontend from stage 1
COPY --from=frontend-build /app/build ./frontend

# Copy backend files
COPY server.js package*.json ./
COPY get-ip.js ./

# Install production dependencies
RUN npm install --only=production

# Copy certificates (make sure these are not sensitive production certs)
COPY cert.pem key.pem ./

# Create uploads directory
RUN mkdir uploads

# Install serve to run the frontend
RUN npm install -g serve

# Expose ports for frontend and backend
EXPOSE 3000 3001

# Start both frontend and backend
CMD ["sh", "-c", "node get-ip.js && npm run server & serve -s frontend -l 3000"]