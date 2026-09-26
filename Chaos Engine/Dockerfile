# The Chaos Engine for the Umbrel: the built app plus its dependency-free server.
# Build the app first (npm run build); "Deploy to Umbrel.bat" does both.
FROM node:24-alpine

WORKDIR /app
COPY dist/chaos-engine/browser ./browser
COPY tools/serve.mjs ./serve.mjs

ENV APP_DIR=/app/browser \
    DATA_DIR=/data \
    HOST=0.0.0.0 \
    PORT=7400

# The autosave, turn snapshots and portraits live here: mount it from the Umbrel's disk.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 7400

HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:7400/api/health || exit 1
CMD ["node", "serve.mjs"]
