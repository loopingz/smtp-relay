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

/**
 * Define the default modules
 */
export function defaultModules() {
  /**
   * Whitelist based on "to", "from", "ips" or "domains" fields
   */
  SmtpFilter.register("whitelist", WhitelistFilter);
  /**
   * Use a statically defined user/password
   */
  SmtpFilter.register("static-auth", StaticAuthFilter);
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
}

// Cannot really test main module
/* c8 ignore start */
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  defaultModules();
  let conf = process.argv.pop();
  if (conf === __filename) {
    conf = undefined;
  }
  let smtp = new SmtpServer(conf);
  smtp.init();
}
/* c8 ignore stop */
