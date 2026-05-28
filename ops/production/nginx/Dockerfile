FROM node:22-bookworm AS frontend-builder

WORKDIR /app/frontend

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_NETUP_FACEBOOK_URL="https://www.facebook.com/netup.vn"
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_NETUP_FACEBOOK_URL=${NEXT_PUBLIC_NETUP_FACEBOOK_URL}

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN corepack enable \
  && corepack prepare pnpm@11.2.2 --activate \
  && pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

FROM nginx:1.27-alpine

COPY ops/production/nginx/netup-static.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/frontend/out /var/www/netup

EXPOSE 80
