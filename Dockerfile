# Two stages: build the bundle with Node, serve it with nginx.
#
# The runtime image contains no Node, no npm and no source — just static files and nginx, which is both
# a much smaller image and a much smaller attack surface than shipping a dev server.

# ---- Stage 1: build -------------------------------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Dependencies are copied and installed before the source, so an edit to a component does not
# invalidate the layer that took two minutes to install.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig*.json eslint.config.mjs jest.config.mjs ./
COPY vite.config.ts ./
COPY vite-plugins ./vite-plugins
COPY config ./config
COPY public ./public
COPY index.html ./
COPY src ./src

# The lint and type-check gates run inside the build, so an image can never be produced from source
# that would fail CI. `npm run build` is `lint && typecheck && vite build`.
ARG BUILD_MODE=production
RUN npm run build -- --mode "${BUILD_MODE}"

# ---- Stage 2: serve -------------------------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime

# envsubst, used by the entrypoint to render the nginx template.
RUN apk add --no-cache gettext

# The default server block would otherwise shadow ours on port 80.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Non-root. nginx:alpine ships an `nginx` user; the directories it must write to are handed over
# explicitly, and the port is above 1024 so no capability to bind a privileged port is needed.
RUN mkdir -p /var/cache/nginx /var/run \
 && chown -R nginx:nginx /var/cache/nginx /var/run /usr/share/nginx/html /etc/nginx/conf.d

ENV SERVER_PORT=8080 \
    API_UPSTREAM=http://api:8080

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${SERVER_PORT}/healthz" || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
