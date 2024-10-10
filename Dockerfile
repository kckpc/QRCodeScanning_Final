# Stage 1: Build the React frontend
FROM node:14 as frontend-build

# Set environment variable
ENV REACT_APP_API_URL=https://192.168.0.119:3001/api

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Build the React app
RUN npm run build

# Stage 2: Create the final image
FROM node:14

WORKDIR /app

# Copy built frontend from stage 1
COPY --from=frontend-build /app/build ./frontend

# Copy backend files
COPY server.js ./
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy certificates
COPY cert.pem key.pem ./

# Copy data files
COPY participants_data.json current_activity.json ./

# Create uploads directory
RUN mkdir uploads

# Copy start script
COPY start.sh ./
RUN chmod +x start.sh

# Install serve to run the frontend
RUN npm install -g serve

# Expose ports for frontend and backend
EXPOSE 3000 3001

# Start both frontend and backend
CMD ["./start.sh"]