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
export * from "./cloudevent";

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
  let conf;
  if (process.argv.length > 2) {
    conf = process.argv.pop();
  }
  let smtp = new SmtpServer(conf);
  smtp.init();
}
/* c8 ignore stop */
