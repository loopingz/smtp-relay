# smtp-relay

This project replace a previous project `aws-smtp-relay` 

The goal is to have a dynamic SMTP server that can either be used to run a debug SMTP locally that just store received email in a folder
Or relay a SMTP protocol to an SES API call (goal of `aws-smtp-relay`)
Or simulate some Incoming capabilities of AWS SES, like `mail2s3` or `mail2sqs` and similar `mail2gcpstorage` and `mail2gcppubsub`

## Concepts

The smtp server is subdivided with:

 - Filters
 - Core
 - Outputs
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