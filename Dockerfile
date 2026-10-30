FROM node:22-alpine

ENV HOST=0.0.0.0 \
    PORT=8080 \
    TRUST_PROXY=false

WORKDIR /app

COPY index.js .

USER node

# EXPOSE 8080

CMD ["node", "index.js"]