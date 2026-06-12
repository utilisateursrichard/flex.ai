FROM node:20-slim

WORKDIR /app

COPY package*.json ./
<<<<<<< HEAD
RUN npm ci --only=production
=======
RUN npm install --omit=dev
>>>>>>> 6397836 (correction fo dockerfile, changement of the deployement from npm ci to npm install)

COPY . .

# Expose server port
EXPOSE 3000

ENV PORT=3000
ENV SURREAL_EXTERNAL=true
ENV SURREAL_HOST=surrealdb
ENV SURREAL_PORT=8000

CMD ["node", "server.js"]
