# syntax=docker/dockerfile:1

FROM node:22-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm deploy --filter server --prod /out
RUN mkdir -p /out/web && cp -r apps/web/dist /out/web/dist
RUN cp -r packages/db/drizzle /out/node_modules/@jos/db/drizzle

FROM node:22-slim AS runtime
ENV DATA_DIR=/data \
  PORT=8080 \
  NODE_ENV=production \
  WEB_DIST=/out/web/dist
WORKDIR /out
COPY --from=build --chown=node:node /out /out
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
