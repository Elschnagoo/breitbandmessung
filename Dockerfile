FROM ubuntu:20.04

ARG S6_OVERLAY_VERSION=3.1.2.1
ENV DEBIAN_FRONTEND noninteractive

CMD mkdir /app

COPY ./package.json /app/
COPY ./package-lock.json /app/
COPY ./tsconfig.json /app/
COPY ./dist /app/dist
COPY ./docker/run.sh /app/run.sh
COPY ./node_modules /app/node_modules



RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y curl gconf-service libgbm-dev libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxss1 libxtst6 libappindicator1 libnss3 libasound2 libatk1.0-0 libc6 ca-certificates fonts-liberation
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs




ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-x86_64.tar.xz


ENTRYPOINT ["/init"]
WORKDIR /app

ENV IS_DOCKER=true

RUN node /app/node_modules/puppeteer/install.js

CMD ["/app/run.sh"]
