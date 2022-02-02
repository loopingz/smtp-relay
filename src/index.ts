import { SmtpFilter } from "./filter";
import { WhitelistFilter } from "./filters/whitelist";
import { SmtpProcessor } from "./processor";
import { FileProcessor } from "./processors/file";
import { SmtpServer } from "./server";

export function defaultModules() {
  SmtpFilter.register("whitelist", WhitelistFilter);
  SmtpProcessor.register("file", FileProcessor);
}

if (module === require.main) {
  defaultModules();
  let smtp = new SmtpServer();
  smtp.init();
}
