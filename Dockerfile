ARG SERVICE=api

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

FROM base AS deps
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/python-service/ apps/python-service/
RUN npm ci --ignore-scripts

FROM deps AS api-build
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run prisma:generate -w @vylix/api
RUN npm run build -w @vylix/api
RUN npm prune --omit=dev

FROM api-build AS web-build
RUN npm run build -w @vylix/web

FROM node:20-alpine AS api-run
WORKDIR /app
COPY --from=api-build /app/node_modules node_modules
COPY --from=api-build /app/apps/api/dist apps/api/dist
COPY --from=api-build /app/apps/api/prisma apps/api/prisma
COPY --from=api-build /app/apps/api/package.json apps/api/
COPY --from=api-build /app/apps/api/scripts apps/api/scripts
COPY --from=api-build /app/package.json ./
EXPOSE 4000
CMD ["node", "apps/api/dist/main"]

FROM node:20-alpine AS web-run
WORKDIR /app
COPY --from=web-build /app/apps/web/.next apps/web/.next
COPY --from=web-build /app/apps/web/public apps/web/public
COPY --from=web-build /app/apps/web/package.json apps/web/
COPY --from=web-build /app/apps/web/next.config.mjs apps/web/
COPY --from=web-build /app/node_modules node_modules
COPY --from=web-build /app/package.json ./
EXPOSE 3000
CMD ["npx", "-w", "@vylix/web", "next", "start"]
