# Oche dashboard: a static build served by nginx.
# Set API_URL at runtime (e.g. https://api.oche.example.com); no rebuild needed to change it.
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM nginx:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.d/40-oche-config.sh
RUN chmod +x /docker-entrypoint.d/40-oche-config.sh
EXPOSE 80
