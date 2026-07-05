# ---- build stage: compile TS -> dist/ ----
FROM node:22-slim AS build
WORKDIR /app

# Install all deps (incl. devDeps like typescript/tsc) using the lockfile.
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: prod deps + compiled output only ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Cloud Run injects PORT (8080); server.ts already reads it.
EXPOSE 8080
CMD ["node", "dist/server.js"]
