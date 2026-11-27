FROM node:22-alpine

WORKDIR /app

COPY admin/package.json ./admin/package.json
COPY admin/index.html ./admin/index.html
COPY admin/architecture.gif ./admin/architecture.gif
COPY admin/src ./admin/src
COPY simulateur/package.json ./simulateur/package.json
COPY simulateur/src ./simulateur/src

WORKDIR /app/admin

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]
