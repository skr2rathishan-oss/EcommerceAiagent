# Step 1: Use a lightweight, production-ready base image (Node 20 Alpine)
FROM node:20-alpine AS base

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy only package.json and package-lock.json to leverage Docker layer caching
COPY package*.json ./

# Step 4: Install production dependencies only to optimize build time and image size
RUN npm ci --omit=dev

# Step 5: Copy the rest of the application source files
COPY . .

# Step 6: Define environment variables at runtime (loaded dynamically)
ENV NODE_ENV=production
ENV PORT=5000

# Step 7: Expose the backend port
EXPOSE 5000

# Step 8: Set the default command to start the application using the production script
CMD ["npm", "start"]
