# smtp-relay

![logo](https://raw.githubusercontent.com/loopingz/aws-smtp-relay/master/docs/aws-smtp-relay-logo.png)

![CI](https://github.com/loopingz/smtp-relay/workflows/CI/badge.svg)

[![codecov](https://codecov.io/gh/loopingz/smtp-relay/branch/main/graph/badge.svg?token=8BR86VbkKf)](https://codecov.io/gh/loopingz/smtp-relay)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=loopingz_smtp-relay&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=loopingz_smtp-relay)
![CodeQL](https://github.com/loopingz/smtp-relay/workflows/CodeQL/badge.svg)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

> This project replaces a previous project: `aws-smtp-relay`.

The goal is to have a dynamic SMTP server that can either be:
- Used to run a debug SMTP locally that just stores received email in a folder.
- Used to relay SMTP protocol to an SES API call (original goal of `aws-smtp-relay`).
- Used to simulate some Incoming capabilities of AWS SES, like `mail2s3` or `mail2sqs`, and similar `mail2gcpstorage` and `mail2gcppubsub`.

## Quick Start

### Replace `aws-smtp-relay`

**Docker command:**
```bash
docker run -p 10025:10025 loopingz/smtp-relay:latest configs/aws-smtp-relay.jsonc
```

**Configuration file can leverage the published schema:**
```json
{
  "$schema": "https://raw.githubusercontent.com/loopingz/smtp-relay/main/config.schema.json"
}
```

[!NOTE]
Replace `main` in the URL with a tag version to get the configuration format of a specific version.

**Run with a configuration file:**
```jsonc
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
        // Send it to SES
        {
          "type": "aws",
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
```jsonc
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
        // Store it in the bucket
        {
          "type": "gcp",
          // Send a message to the queue containing the bucket url if exist and the metadata of the email
          "path": "gs://myemail/",
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
```bash
docker run -p 10025:10025 -v `pwd`/emails:/smtp-relay/received_emails loopingz/smtp-relay:latest ./configs/fake-smtp-docker.jsonc
# With auth
docker run -e SMTP_USERNAME=test -e SMTP_PASSWORD=plain:test -p 10025:10025 -v `pwd`/emails:/smtp-relay/received-emails loopingz/smtp-relay:latest configs/fake-smtp-with-auth.jsonc
```

## Concepts

The SMTP server is subdivided into the following components:
- Filters
- Core
- Processors
- Flows

### Filters

These components decide to accept or refuse an email. At each SMTP command step, they can make a decision to refuse or accept an email, or not make a decision (`boolean|undefined`).

By default, the following filters exist:
- `whitelist`: allow emails based on regexp or exact values.
- `http-auth`: proxy the authentication to an HTTP endpoint.
- `http-filter`: proxy the decision on the email to an HTTP endpoint.
- `static-auth`: statically defined user/password for authentication.
- `mail-auth`: validates incoming emails using SPF, DKIM, DMARC, ARC, and BIMI.

### `mail-auth`

The `mail-auth` filter validates incoming emails using a suite of authentication mechanisms: SPF (Sender Policy Framework), DKIM (DomainKeys Identified Mail), DMARC (Domain-based Message Authentication, Reporting & Conformance), ARC (Authenticated Received Chain), and BIMI (Brand Indicators for Message Identification). It helps in verifying the authenticity and integrity of emails, reducing spam and phishing attempts.

Example Configuration:

```json
{
  "type": "mail-auth",
  "mailauth": {
    "minBitLength": 1024,
    "disableArc": false,
    "disableDmarc": false,
    "disableBimi": true,
    "maxResolveCount": 10,
    "maxVoidCount": 2
  },
  "enforceDmarc": "v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com"
}
```

**Configuration Options:**

*   `type`: (string) Must be `"mail-auth"`.
*   `mailauth`: (object, optional) Configuration options for the underlying `mailauth` library.
    *   `minBitLength`: (number, optional) The minimum allowed bits for RSA public keys (defaults to 1024). If a DKIM or ARC key has fewer bits, then validation is considered as failed.
    *   `disableArc`: (boolean, optional) Disable ARC checks. Defaults to `false`.
    *   `disableDmarc`: (boolean, optional) Disable DMARC checks. Defaults to `false`.
    *   `disableBimi`: (boolean, optional) Disable BIMI checks. Defaults to `false`.
    *   `maxResolveCount`: (number, optional) DNS lookup limit for SPF. RFC7208 requires this limit to be 10. Defaults to `10`.
    *   `maxVoidCount`: (number, optional) DNS lookup limit for SPF that produce an empty result. RFC7208 requires this limit to be 2. Defaults to `2`.
*   `enforceDmarc`: (string, optional) Enforce a specific DMARC policy. If set, all `_dmarc` records are replaced with the policy specified here. For example, `"v=DMARC1; p=reject;"`.

## DKIM Key Generation

This utility command helps you generate a new DKIM (DomainKeys Identified Mail) RSA key pair. It will output the public key formatted as a DNS TXT record that you need to add to your domain's DNS settings, and the private key along with example configuration snippets for use with the Nodemailer processor in this SMTP relay.

### Usage

You can run the command using `npx` (even without installing the package globally):
```bash
npx smtp-relay dkim-generate <your-domain.com> <selector>
```

-   `<your-domain.com>`: Replace this with the domain for which you are generating the DKIM key (e.g., `example.com`).
-   `<selector>`: Replace this with a DKIM selector. This is a name you choose, often `default` or a date (e.g., `jan2024`). It must be alphanumeric.

For example:
```bash
npx smtp-relay dkim-generate example.com default
```

### Expected Output

After running the command, you will see output similar to the following:

1.  **DNS TXT Record:**
    The command will print the DNS TXT record that you need to create for your domain. It will look something like this:
    ```text
    <selector>._domainkey.<your-domain.com>    v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...your...public...key...data...AQAB
    ```
    -   Replace `<selector>` and `<your-domain.com>` with the actual values you used.
    -   The long string starting with `p=` is your public key. Ensure you copy the entire value for your DNS record.

2.  **Configuration Snippets for `smtp-relay`:**
    The command will also provide JSON snippets that you can adapt for your `smtp-relay` configuration, specifically for use with the `nodemailer` processor. This allows `smtp-relay` to sign outgoing emails using the generated private key.

    **Option 1: Single DKIM key configuration**
    If you are configuring a single DKIM key directly in your `nodemailer` processor options:
    ```json
    {
      "outputs": [
        {
          "type": "nodemailer",
          "dkim": {
            "domainName": "<your-domain.com>",
            "keySelector": "<selector>",
            "privateKey": "-----BEGIN PRIVATE KEY-----\n...your...private...key...data...\n-----END PRIVATE KEY-----\n"
          }
          // ... other nodemailer options
        }
      ]
    }
    ```

    **Option 2: Multiple DKIM keys using the `dkims` object**
    If you prefer to manage multiple DKIM keys, potentially for different domains:
    ```json
    {
      "outputs": [
        {
          "type": "nodemailer",
          "dkims": {
            "<your-domain.com>": {
              "keySelector": "<selector>",
              "privateKey": "-----BEGIN PRIVATE KEY-----\n...your...private...key...data...\n-----END PRIVATE KEY-----\n"
            }
            // ... potentially other domains
          }
          // ... other nodemailer options
        }
      ]
    }
    ```
    **Important:**
    - The `privateKey` value will be the actual multi-line PEM formatted private key. Ensure it is correctly formatted in your JSON configuration (e.g., with `\n` for newlines if storing as a single string, or loaded from a file/environment variable in production). The example output from the tool will show the private key directly.
    - Store your private key securely. Do not commit it directly into your version control if your configuration file is tracked.

### Processors

These components receive the email sent after it was accepted by the filters.

There are 4 types:
- `aws`
- `gcp`
- `file`
- `mailer`

### Flows

A flow is defined within the configuration. It defines the filters and the outputs to apply if the message matches the filters. You can have as many flows as you desire within the SMTP server.

### Core

The Core manages the coordination of different components and is in charge of capturing the mail stream.

### Common variables available for replacements

- `_iso8601_`: date and time in `YYYYmmddHHiiss` format
- `_timestamp_`: UNIX timestamp
- `_id_`: Session id

The following variables are not always available but should be within processors:
- `_from_`: Email of the sender
- `_messageId_`: Message ID
- `_subject_`: Subject of the email
- `_to_`: List of recipients, comma-separated

## Logs

You can define log configuration with the `loggers` definition.

We currently support two types:
- `"CONSOLE"`
- `"FILE"`

```json
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

From the library `@webda/workout`, the log level, if not defined, falls back to the `LOG_LEVEL` environment variable and then falls back again to `INFO`.

The `FILE` type has a size limit defined and will increment a number at the end of the filepath if needed. It has a default `sizeLimit` defined by the library.

A `format` can be defined too.

By default, the loggers are defined as a single `CONSOLE` logger.
[!NOTE]
You can disable logging completely by adding a `loggers: []` property.

## CloudEvent

The CloudEvent representation of an email is:

```typescript
/**
 * CloudEvent Data representation for smtp-relay
 */
export interface SmtpCloudEvent {
  email: {
    from?: AddressObject;
    attachments: {
      filename: string;
      size: number;
    }[];
    subject?: string;
    priority?: string;
    to?: AddressObject[];
    cc?: AddressObject[];
    bcc?: AddressObject[];
    replyTo?: string;
    date?: Date;
    text?: string;
    html?: string;
  };
  server: {
    clientHostname: string;
    remoteAddress: string;
    remotePort: number;
    hostNameAppearAs: string;
    id: string;
    secure: boolean;
    transmissionType: string;
    username: string;
  };
}
```

## HTTP Auth

You can enable HTTP authentication for the SMTP relay. It will then relay the username/password verification to an HTTP endpoint.

Use the `http-auth` filter. It supports the following methods for passing credentials:
-   **BASIC_AUTH**: Sends an `Authorization` header with Basic Auth (see [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization)).
-   **FORM_URLENCODED**: Sends a request to the URL with `x-www-form-urlencoded` data containing the username and password.
-   **JSON**: Sends a JSON body to the URL with the username and password.

**Configuration Interface:**
```typescript
interface HttpAuthConfiguration {
  /**
   * URL to call
   */
  url: string;
  /**
   * Method to use
   */
  method?: "PUT" | "POST" | "GET";
  /**
   * If not define the HTTP code is used:
   * < 300: Allowed
   * >= 300: Refused
   *
   * If defined the response is read as JSON and test for value
   */
  json_result?: {
    /**
     * Json path to read from the response
     */
    path: string,
    /**
     * Value to compare to, if equal then authentication is accepted
     */
    value: string
  };
  /**
   * Http method to use to pass credentials
   *
   * BasicAuth: Will use the Authorization field
   * Json: Will post/put a JSON body with the user/password
   * FormData: Will post/put a Form body with the user/password
   */
  credentialsMethod: "BASIC_AUTH" | "JSON" | "FORM_URLENCODED";
  /**
   * Name of the field for FormData
   * Jsonpath for Json
   */
  userField?: string;
  /**
   * Name of the field for FormData
   * Jsonpath for Json
   */
  passwordField?: string;
  /**
   * Used to sign request
   */
  hmac?: {
    /**
     * Secret to use
     */
    secret: string;
    /**
     * @default sha256
     */
    algo?: string;
    /**
     * @default X-SMTP-RELAY
     */
    header?: string;
  }
}
```

**Sample:**
```json
{
  "type": "http-auth",
  "url": "http://localhost:16662/smtp/filter",
  "credentialsMethod": "BASIC_AUTH"
}
```

## HTTP Filter

The `http-filter` sends the CloudEvent related to the email to an HTTP endpoint to accept or refuse the email.
- If the HTTP request returns a status code `< 300`, the email is accepted.
- Otherwise, it is refused.

See the `tests/http-filter-with-auth.json` and `test/http-filter.json` configuration examples.

It can also be configured to sign requests with HMAC.

```typescript
export interface HttpFilterConfig extends HttpConfig {
  /**
   * URL to call
   */
  url: string;
  /**
   * Method to use
   */
  method?: "PUT" | "POST";
  /**
   * Accept any form of authentication to rely solely on username
   * and filter on the http endpoint
   *
   * @default false
   */
  allowAnyUser?: boolean;
}
```

## Static Basic Auth

To enable basic auth for the SMTP relay, you need to set the `static-auth` filter, add the `AND` filters operator, set the `authMethods`, and ensure one of `secure` or `allowInsecureAuth` is set as `true` in the configuration (see [Example](https://github.com/loopingz/smtp-relay/blob/main/tests/auth.json)).

The password and username are passed either in the configuration with the fields `username` and `password` or as environment variables `SMTP_USERNAME` and `SMTP_PASSWORD`.

The password is prefixed by `${hashAlgorithm}:` where `hashAlgorithm` is one of `plain`, `sha256`, `sha512`, or `md5`. You can get the full list of hash algorithms supported by Node with this command:
`node -e "console.log(require('crypto').getHashes())"`

[!WARNING]
`plain` can be used to not hash the password, but it is not recommended for security reasons.

A `salt` parameter can be added in the configuration with the `salt` field, or via the environment variable `SMTP_PASSWORD_SALT`.

### Encrypt your password to use

You can encrypt the password to use with this command:
```bash
HASH="sha256" PASSWORD="TEST" node -e 'console.log(`${process.env.HASH}:${require("crypto").createHash(process.env.HASH).update(process.env.PASSWORD).digest("hex")}`)'
```

### Raw testing with OpenSSL and pure SMTP protocol

For manual testing, you will need to pass the username and password to the SMTP relay, Base64 encoded. If you use the SMTP `AUTH LOGIN` method, you will encode and pass the username and password separately.

**Example SMTP test:**

1.  Port forward your container to your localhost:
    ```bash
    docker run -p 10025:10025 loopingz/smtp-relay:latest
    ```
2.  Connect to `smtp-relay`:
    ```bash
    openssl s_client -connect localhost:10025
    ```
    Example SMTP conversation:
    ```text
    S: 220 smtp.server.com Simple Mail Transfer Service Ready
    C: EHLO client.example.com
    S: 250-smtp.server.com Hello client.example.com
    S: 250-SIZE 1000000
    S: 250 AUTH LOGIN PLAIN CRAM-MD5
    C: AUTH LOGIN
    S: 334 VXNlcm5hbWU6
    C: dXNlcm5hbWU=
    S: 334 UGFzc3dvcmQ6
    C: cGFzc3dvcmQ=
    S: 235 2.7.0 Authentication successful
    ```

**Examples of ways to Base64 encode your credentials:**
```bash
base64 <<< "password"
```

[!IMPORTANT]
Make sure to use a Base64 encoder that encodes with Destination character set UTF-8 and Destination new line separator LF (Unix). [This online one](https://www.base64encode.org/) does that. The macOS command-line `base64` tool might behave differently.

**Example Schema for AWS SES with Basic Auth in K8s:**
```json
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

[!NOTE]
Change your logger level to `DEBUG` for help troubleshooting.
