import { SmtpFilter } from "./filter";
import { WhitelistFilter } from "./filters/whitelist";
import { SmtpProcessor } from "./processor";
import { AWSProcessor } from "./processors/aws";
import { FileProcessor } from "./processors/file";
import { GCPProcessor } from "./processors/gcp";
import { NodeMailerProcessor } from "./processors/nodemailer";
import { SmtpServer } from "./server";

export function defaultModules() {
  SmtpFilter.register("whitelist", WhitelistFilter);
  SmtpProcessor.register("file", FileProcessor);
  SmtpProcessor.register("nodemailer", NodeMailerProcessor);
  SmtpProcessor.register("aws", AWSProcessor);
  SmtpProcessor.register("gcp", GCPProcessor);
}

// Cannot really test main module
/* istanbul ignore if */
if (module === require.main) {
  defaultModules();
  let conf = process.argv.pop();
  if (conf === __filename) {
    conf = undefined;
  }
  let smtp = new SmtpServer(conf);
  smtp.init();
}
