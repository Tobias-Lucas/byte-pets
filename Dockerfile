# BytePets API + responsive web (single image, no Windows .bat dependency).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pil ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
# pg is the only runtime npm dependency; resolve it during Docker build.
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node server/ ./server/
COPY --chown=node:node scripts/ ./scripts/
COPY --chown=node:node web/ ./web/
COPY --chown=node:node content/ ./content/
COPY --chown=node:node infra/normalize_media.py ./infra/normalize_media.py
RUN mkdir -p /app/data/media && chown -R node:node /app/data
USER node
ENV PORT=4173 DB_ENGINE=postgres DATA_DIR=/app/data PYTHON_BIN=python3 NODE_ENV=production
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=8s --start-period=60s --retries=3 CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.mjs"]
