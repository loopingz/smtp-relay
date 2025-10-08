import * as url from "node:url";
import { SmtpFilter } from "./filter";
import { StaticAuthFilter } from "./filters/static-auth";
import { WhitelistFilter } from "./filters/whitelist";
import { SmtpProcessor } from "./processor";
import { AWSProcessor } from "./processors/aws";
import { FileProcessor } from "./processors/file";
import { GCPProcessor } from "./processors/gcp";
import { NodeMailerProcessor } from "./processors/nodemailer";
import { SmtpServer } from "./server";
import { HttpAuthFilter } from "./filters/http-auth";
import { HttpFilter } from "./filters/http-filter";
import { LogProcessor } from "./processors/log";
import { MailAuthFilter } from "./filters/mail-auth";
export * from "./cloudevent";
import { generateKeyPairSync } from "node:crypto";

/**
 * Define the default modules
 */
export function defaultModules() {
  /**
   * Ensure SPF, DKIM, DMARC, ARC, BIMI and Received headers are valid
   */
  SmtpFilter.register("mail-auth", MailAuthFilter);
  /**
   * Whitelist based on "to", "from", "ips" or "domains" fields
   */
  SmtpFilter.register("whitelist", WhitelistFilter);
  /**
   * Use a statically defined user/password
   */
  SmtpFilter.register("static-auth", StaticAuthFilter);
  /**
   * Use to call a url for authentication
   */
  SmtpFilter.register("http-auth", HttpAuthFilter);
  /**
   * Use to call a url for filtering on mail data
   */
  SmtpFilter.register("http-filter", HttpFilter);
  /**
   * Store an email flow into a file
   */
  SmtpProcessor.register("file", FileProcessor);
  /**
   * Send the email using the nodemailer library
   */
  SmtpProcessor.register("nodemailer", NodeMailerProcessor);
  /**
   * Send the email using AWS SES api, or store it to S3 bucket or send it to SQS Queue
   */
  SmtpProcessor.register("aws", AWSProcessor);
  /**
   * Send the email using PubSub or store it in a Bucket
   */
  SmtpProcessor.register("gcp", GCPProcessor);
  /**
   * Log the email
   */
  SmtpProcessor.register("log", LogProcessor);
}

// Cannot really test main module
/* c8 ignore start */
// url.pathToFileURL(__filename).href for CJS
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.on("SIGINT", () => {
    console.log("Exiting server");
    process.exit(0);
  });

  defaultModules();
  const args = process.argv.slice(2);
  if (args.length > 0 && args[0] === "dkim-generate") {
    if (process.argv.length < 4) {
      console.log("Generate DKIM keys");
      console.log("Usage: smtp-relay dkim-generate <domain> <selector>");
      console.log("Example: smtp-relay dkim-generate example.com default");
      process.exit(1);
    }
    const selector = process.argv.pop();
    const domain = process.argv.pop();
    if (/[a-z0-9]+/.test(selector) === false) {
      console.log("Selector must be alphanumeric");
      process.exit(1);
    }
    if (domain.indexOf(".") === -1) {
      console.log("Domain must be a valid domain");
      process.exit(1);
    }
    console.log("Generating DKIM keys for domain", domain, "and selector", selector);
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem"
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem"
      }
    });
    console.log("Create a DNS TXT record with the following value:");
    console.log(
      `${selector}._domainkey.${domain}\tv=DKIM1; k=rsa; p=${publicKey
        .split("\n")
        .filter(p => !p.startsWith("----"))
        .join("")}`
    );
    console.log("You can use the private key in your config like this:");
    console.log(
      JSON.stringify(
        {
          nodemailer: {
            dkim: {
              domain: domain,
              keySelector: selector,
              privateKey
            }
          }
        },
        undefined,
        2
      )
    );
    console.log("You can also use the private key in a file like this to define multiple keys based on domains:");
    console.log(
      JSON.stringify(
        {
          nodemailer: {
            dkims: {
              [domain]: {
                keySelector: selector,
                privateKey
              }
            }
          }
        },
        undefined,
        2
      )
    );
    process.exit(0);
  }
  let smtp = new SmtpServer(args[0]);
  smtp.init();
}
/* c8 ignore stop */
