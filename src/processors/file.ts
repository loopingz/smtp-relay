import * as fs from "fs";
import * as path from "path";
import { SmtpComponentConfig } from "../component";
import { SmtpProcessor } from "../processor";
import { SmtpServer, SmtpSession } from "../server";

export interface FileProcessorConfig extends SmtpComponentConfig {
  /**
   * Where to store the files
   */
  path: string;
  /**
   * @default `${iso8601}.eml`
   */
  filename?: string;
}
export class FileProcessor<T extends FileProcessorConfig = FileProcessorConfig> extends SmtpProcessor<T> {
  type: string = "file";

  /**
   * @override
   */
  init() {
    this.config.filename ??= "${iso8601}.eml";
    if (!this.config.path) {
      throw new Error("Need to specify a path");
    }
    fs.mkdirSync(this.config.path, { recursive: true });
  }

  /**
   * Copy the known file in a folder
   * @param session
   * @returns
   */
  async onMail(session: SmtpSession): Promise<void> {
    return new Promise((resolve, reject) => {
      let read = fs.createReadStream(session.emailPath);
      read.pipe(
        fs.createWriteStream(path.join(this.config.path, SmtpServer.replaceVariables(this.config.filename, session)))
      );
      read.on("close", resolve);
      read.on("error", reject);
    });
  }
}
