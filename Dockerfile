FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY rules ./rules
COPY demo ./demo
ENV NODE_ENV=production
# HUBSPOT_ACCESS_TOKEN is optional; without it the server starts and tools work in demo mode.
CMD ["node", "dist/main.js"]
