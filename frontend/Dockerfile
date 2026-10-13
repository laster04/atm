FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# server.mjs is `serve -s dist` plus a proxy for the data sitemap; these are the
# two libraries `serve` itself is built on.
RUN npm install --no-save --no-package-lock serve-handler@6 compression@1
COPY --from=build /app/dist ./dist
COPY server.mjs ./
ARG VITE_API_URL
ENV API_URL=$VITE_API_URL
EXPOSE 3000
CMD ["node", "server.mjs"]
