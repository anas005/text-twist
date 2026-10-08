# Text Twist server for Cloud Run. No build step — plain Node + static client.
# Runtime must contain everything index.js reads: game/, lib/, assets/,
# public/ (served same-origin: page + websocket on one URL).

# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# ---- runtime ----
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/index.js ./index.js
COPY --from=build /app/game ./game
COPY --from=build /app/lib ./lib
COPY --from=build /app/assets ./assets
COPY --from=build /app/public ./public
EXPOSE 8080
# Must listen on $PORT (Cloud Run injects it; app defaults to 8080):
CMD ["node", "index.js"]
