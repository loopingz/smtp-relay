# smtp-relay

![logo](https://raw.githubusercontent.com/loopingz/aws-smtp-relay/master/docs/aws-smtp-relay-logo.png)

![CI](https://github.com/loopingz/smtp-relay/workflows/CI/badge.svg)

[![codecov](https://codecov.io/gh/loopingz/smtp-relay/branch/main/graph/badge.svg?token=8BR86VbkKf)](https://codecov.io/gh/loopingz/smtp-relay)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=loopingz_smtp-relay&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=loopingz_smtp-relay)
![CodeQL](https://github.com/loopingz/smtp-relay/workflows/CodeQL/badge.svg)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

This project replace a previous project `aws-smtp-relay`

The goal is to have a dynamic SMTP server that can either be used to run a debug SMTP locally that just store received email in a folder
Or relay a SMTP protocol to an SES API call (goal of `aws-smtp-relay`)
Or simulate some Incoming capabilities of AWS SES, like `mail2s3` or `mail2sqs` and similar `mail2gcpstorage` and `mail2gcppubsub`

## Quick Start

### Replace aws-smtp-relay

Docker command

```
docker run -p 10025:10025 loopingz/smtp-relay:latest configs/aws-smtp-relay.jsonc
```

**Configuration file can leverage the published schema**

```
{
  "$schema": "https://raw.githubusercontent.com/loopingz/smtp-relay/main/config.schema.json"
}
```

Replace `main` in url by the tag version to get the configuration format of a specific version

Run with a configuration file:

```
// Replace my previous project aws-smtp-relay
{
  "$schema": "https://raw.githubusercontent.com/loopingz/smtp-relay/main/config.schema.json",
  "flows": {
    "localhost": {
      "filters": [
        // Allow any ip to use the SMTP
        {
          "type": "whitelist",
          "ips": ["regexp:.*"]
        }
      ],
      "outputs": [
        {
          "type": "aws",
          // Send it to SES
          "ses": {}
        }
      ]
    }
  },
  "options": {
    "disableReverseLookup": false,
    // Do not require auth
    "authOptional": true,
    "loggers": [
      {
        "level": "INFO",
        "type": "CONSOLE"
      },
      {
        "level": "INFO",
        "type": "FILE",
        "filepath": "./smtp.log"
      }
    ]
  }
}
```

### SMTP 2 GCP Storage

```
{
  "flows": {
    "localhost": {
      "filters": [
        // Allow any ip to use the SMTP
        {
          "type": "whitelist",
          "to": ["regexp:.*@mydomain.com"]
        }
      ],
      "outputs": [
        {
          "type": "gcp",
          // Store it in the bucket
          "path": "gs://myemail/",
          // Send a message to the queue containing the bucket url if exist and the metadata of the email
          "pubsub": ""
        }
      ]
    }
  },
  "options": {
    "disableReverseLookup": false,
    // Do not require auth
    "authOptional": true
  }
}
```

### Run it locally for dev

You can just leverage the Docker image:

```
docker run -p 10025:10025 -v `pwd`/emails:/smtp-relay/received_emails loopingz/smtp-relay:latest ./configs/fake-smtp.jsonc
# With auth
docker run -e SMTP_USERNAME=test -e SMTP_PASSWORD=plain:test -p 10025:10025 -v `pwd`/emails:/smtp-relay/received-emails loopingz/smtp-relay:latest configs/fake-smtp-with-auth.jsonc
```

## Concepts

The smtp server is subdivided with:

- Filters
- Core
- Processors
- Flows

### Filters

These components decide to accept or refuse an email.

At each SMTP command step, they can make a decision to refuse or accept an email or not make a decision `boolean|undefined`

By default, 3 filters exist:

- whitelist: allow emails based on regexp or exact values
- http-auth: proxy the decision on the email to an HTTP endpoint
- static-auth: staticly defined user/password for authentication

### Processors

These components receive the email sent after it was accepted by the filters.

There is 4 types:

- aws:
- gcp:
- file:
- mailer:

### Flows

A flow is defined within the configuration, it defines the filters and the outputs to apply if the message match the filters

You can have as many flow as you desire within the SMTP server

### Core

Manage the coordination of different component and is in charge of capturing the mail stream

### Common variables available for replacements

_iso8601_: date and time in YYYYmmddHHiiss format

_timestamp_: UNIX timestamp

_id_: Session id

The following variables are not always available but should be within processors

_from_: Email of the sender

_messageId_: Message id

_subject_: subject of the email

_to_: list of recipient comma separated

## Logs

You can define log configuration with the loggers definition.

We currently support "CONSOLE" or "FILE"

```
"loggers": [
  {
    "level": "INFO",
    "type": "CONSOLE"
  },
  {
    "level": "INFO",
    "type": "FILE",
    "filepath": "./smtp.log",
    "sizeLimit": 50000000
  }
]
```

From the library `@webda/workout`, the loglevel if not defined fallback to the `LOG_LEVEL` environment variable and then fallback again to `INFO`

The `FILE` type have a size limit defined and will increment a number at the end of the filepath if needed. It has a default sizeLimit define by the library.

A `format` can be defined too

By default the loggers are defined as a single `CONSOLE` logger. You can disable completely by adding a `loggers: []` property

## Basic Auth

To enable basic auth for the smtp relay you need to set the static-auth filter, add the AND filters operator, set the authMethods and ensure secure is set to true as in the config example below.

Set the SMTP_USERNAME, SMTP_PASSWORD as env variables. 
Note that the password will need to be passed in with the below "plain:" prepended to your password. 
I set them like this in the Dockerfile. Later you can set them in your helmfile if your using k8s.

Dockerfile example:
```
ENV SMTP_USERNAME: yourusername
ENV SMTP_PASSWORD: plain:yourpassword
```

Helmfile example:

```
env: 
  - name: SMTP_USERNAME
    value: "username"
  - name: SMTP_PASSWORD
    value: "sha256:yourpassword"
```

For manual testing you will need to pass the username and password to the smtp-relay base64 encoded. If you use the SMTP auth method LOGIN you will encode and pass in the username and password seperately.

Example smtp test:

1. Port forward your container to your localhost.

```
 docker run -p 10025:10025 loopingz/smtp-relay:latest
 ```


2. Connect to smtp-relay
```
openssl s_client -connect localhost:10025
```
```
S: 220 smtp.server.com Simple Mail Transfer Service Ready
C: EHLO client.example.com
S: 250-smtp.server.com Hello client.example.com
S: 250-SIZE 1000000
S: 250 AUTH LOGIN PLAIN CRAM-MD5
C: AUTH LOGIN
S: 334 VXNlcm5hbWU6
C: adlxdkej
S: 334 UGFzc3dvcmQ6
C: lkujsefxlj
S: 235 2.7.0 Authentication successful
```


Examples of ways to base64 encode your credentials:

```
base64 <<< password
```

Gotcha: make sure to use a base64 encoder that encodes with Destination character set utf8 and Destination new line seperator LF(Unix), this online one does that, the MAC cml one is poop
https://www.base64encode.org/

Example Schema used to add basic auth to an aws-ses smtp-relay running in k8s:

```
{
  "$schema": "https://raw.githubusercontent.com/loopingz/smtp-relay/main/config.schema.json",
  "flows": {
    "localhost": {
      "filters": [
        {
          "type": "whitelist",
          "ips": [
            "regexp:.*"
          ]
        },
        {
          "type": "static-auth"
        }
      ],
      "filtersOperator": "AND",
      "outputs": [
        {
          "type": "aws",
          "ses": {}
        }
      ]
    }
  },
  "cachePath": "/tmp/.email_${iso8601}.eml",
  "options": {
    "authMethods": [
      "PLAIN",
      "LOGIN"
    ],
    "secure": true,
    "disableReverseLookup": true,
    "authOptional": true,
    "loggers": [
      {
        "level": "INFO",
        "type": "CONSOLE"
      }
    ]
  }
}
```
Note: Change your loggers level to DEBUG for help troubleshooting.
## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://www.loopingz.com/"><img src="https://avatars.githubusercontent.com/u/3437026?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Remi Cattiau</b></sub></a><br /><a href="https://github.com/loopingz/loopingz/smtp-relay/commits?author=loopingz" title="Documentation">📖</a> <a href="https://github.com/loopingz/loopingz/smtp-relay/commits?author=loopingz" title="Code">💻</a> <a href="#infra-loopingz" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
