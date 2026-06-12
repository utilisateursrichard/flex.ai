FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Expose server port
EXPOSE 3000

ENV PORT=3000
ENV SURREAL_EXTERNAL=true
ENV SURREAL_HOST=surrealdb
ENV SURREAL_PORT=8000

CMD ["node", "server.js"]
