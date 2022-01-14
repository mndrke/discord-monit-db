FROM node:16.13.2-slim

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node package*.json ./

COPY --chown=node:node main.js main.js

RUN npm install

CMD [ "node", "main.js" ]