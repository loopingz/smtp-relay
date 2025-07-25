# Build from node
FROM node:22 AS builder

RUN mkdir /app
ADD src /app/src/
ADD package.json /app
ADD tsconfig.json /app
ADD package-lock.json /app
RUN cd /app && npm install && npm run build && npm prune --production

# Run it in distroless
FROM gcr.io/distroless/nodejs22-debian11:latest
# Copy default config
ADD configs /smtp-relay/configs
COPY --from=builder /app/lib /smtp-relay/lib
COPY --from=builder /app/node_modules /smtp-relay/node_modules
COPY --from=builder /app/package.json /smtp-relay/
WORKDIR /smtp-relay
ENTRYPOINT [ "/nodejs/bin/node", "--trace-deprecation", "lib/index.js" ]
