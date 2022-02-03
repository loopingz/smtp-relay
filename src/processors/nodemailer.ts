import { SmtpProcessor } from "../processor";
import { SmtpSession } from "../server";
import * as nodemailer from "nodemailer";
import { SmtpComponentConfig } from "../component";

export interface NodeMailerProcessorConfig extends SmtpComponentConfig {
  redirect: string;
  nodemailer: any;
}
export class NodeMailerProcessor<
  T extends NodeMailerProcessorConfig = NodeMailerProcessorConfig
> extends SmtpProcessor<T> {
  type: string = "nodemailer";
  transporter: any;

  init() {
    this.transporter = nodemailer.createTransport(this.config.nodemailer);
  }

  async onMail(session: SmtpSession): Promise<void> {
    return this.transporter.sendMail({});
  }
}
