FROM node:10.16-alpine

WORKDIR /app

COPY . .

RUN yarn

EXPOSE 3000

CMD ["yarn", "start"]
