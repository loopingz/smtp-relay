# smtp-relay

![logo](https://raw.githubusercontent.com/loopingz/aws-smtp-relay/master/docs/aws-smtp-relay-logo.png)

![CI](https://github.com/loopingz/smtp-relay/workflows/CI/badge.svg)

[![codecov](https://codecov.io/gh/loopingz/smtp-relay/branch/main/graph/badge.svg?token=8BR86VbkKf)](https://codecov.io/gh/loopingz/smtp-relay)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=loopingz_smtp-relay&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=loopingz_smtp-relay)
![CodeQL](https://github.com/loopingz/smtp-relay/workflows/CodeQL/badge.svg)

This project replace a previous project `aws-smtp-relay`

The goal is to have a dynamic SMTP server that can either be used to run a debug SMTP locally that just store received email in a folder
Or relay a SMTP protocol to an SES API call (goal of `aws-smtp-relay`)
Or simulate some Incoming capabilities of AWS SES, like `mail2s3` or `mail2sqs` and similar `mail2gcpstorage` and `mail2gcppubsub`

## Quick Start

### Replace aws-smtp-relay

Run with a configuration file:

```
// Replace my previous project aws-smtp-relay
{
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
    "logger": true
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
    "authOptional": true,
    "logger": true
  }
}
```

### Run it locally for dev

You can just leveraging the Docker image

```
docker run -p 10025:10025 -v `pwd`/emails:/smtp-relay/received_emails ./configs/fake-smtp.jsonc
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

By default, two filters exist:

- whitelist: allow emails based on regexp or exact values
- http-auth: proxy the decision on the email to an HTTP endpoint

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
