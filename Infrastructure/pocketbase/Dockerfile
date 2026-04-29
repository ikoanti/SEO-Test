FROM alpine:3.20

ARG PB_VERSION=0.37.3

RUN apk add --no-cache unzip ca-certificates

ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pocketbase.zip

RUN unzip /tmp/pocketbase.zip -d /pb/ \
    && rm /tmp/pocketbase.zip \
    && mkdir -p /pb/pb_data /pb/pb_migrations /pb/pb_hooks

COPY Infrastructure/pocketbase/pb_migrations /pb/pb_migrations
COPY Infrastructure/pocketbase/pb_hooks /pb/pb_hooks

WORKDIR /pb

EXPOSE 8090

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
