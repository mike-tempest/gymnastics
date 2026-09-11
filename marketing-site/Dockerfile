FROM node:22-alpine AS build
RUN apk add --no-cache python3
WORKDIR /app/marketing-site
COPY marketing-site/package.json marketing-site/package-lock.json ./
RUN npm ci --ignore-scripts
COPY marketing-site/astro.config.mjs ./
COPY marketing-site/site ./site
COPY marketing-site/public-tumblebase ./public-tumblebase
COPY marketing-site/scripts/verify-tumblebase.py ./scripts/verify-tumblebase.py
COPY apps/web/src/lib/brand.ts /app/apps/web/src/lib/brand.ts
ARG PUBLIC_APP_URL=""
ARG PUBLIC_CONTACT_EMAIL="mike@tumblebase.com"
ARG PUBLIC_MONTHLY_PRICE_GBP=""
RUN npm run build && npm run verify:site
RUN find dist.nosync -type d -exec chmod 755 {} + && find dist.nosync -type f -exec chmod 644 {} +

FROM caddy:2-alpine
ENV PORT=8080
COPY marketing-site/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/marketing-site/dist.nosync /srv
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
