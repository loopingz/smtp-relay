# Build from node
FROM node:18 as builder

RUN mkdir /app
ADD src /app/src/
ADD package.json /app
ADD tsconfig.json /app
ADD yarn.lock /app
RUN cd /app && yarn --frozen-lockfile --network-timeout 600000 && yarn build && npm prune --production

# Run it in distroless
FROM gcr.io/distroless/nodejs18-debian11:latest
# Copy default config
ADD configs /smtp-relay/configs
COPY --from=builder /app/lib /smtp-relay/lib
COPY --from=builder /app/node_modules /smtp-relay/node_modules
COPY --from=builder /app/package.json /smtp-relay/
WORKDIR /smtp-relay
ENTRYPOINT [ "/nodejs/bin/node", "lib/index.js" ]
