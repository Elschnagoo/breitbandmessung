# Breitbandmessung.de automated

A script to enable customers of lazy ISPs to perform measurement campaigns of the connection speed as described [here](https://breitbandmessung.de/desktop-app) in an automated way.

# Usage - Native

1. Install deps
   1. (Dev) `npm install `
   2. (Prod) `npm install --omit=dev && npm run installBrowser`
2. Build `npm run build` 
3. Run `npm run start` 

# Usage - Docker
```shell
   docker-compose up -d 
```

> Uncomment the cron value in compose file to use cron mode
