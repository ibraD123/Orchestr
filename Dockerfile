# Basira server. The Playwright image ships Chromium for slide rendering and photo checks;
# its version must match playwright-core in package.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
ENV NODE_ENV=production PORT=8787 BASIRA_DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN node scripts/build.mjs && mkdir -p /data && chown -R pwuser /data

USER pwuser
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
