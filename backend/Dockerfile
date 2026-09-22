FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p uploads tours
EXPOSE 3001
CMD ["node", "server.js"]
