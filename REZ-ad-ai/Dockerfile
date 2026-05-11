FROM node:24-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm install -D typescript ts-node @types/express @types/node @types/compression && npx tsc

EXPOSE 4023

CMD ["npx", "ts-node", "src/index.ts"]
