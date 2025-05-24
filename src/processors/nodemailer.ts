import { AddressObject } from "mailparser";
import * as nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import AddressParser from "nodemailer/lib/addressparser/index";
import { SmtpComponentConfig } from "../component";
import { SmtpProcessor } from "../processor";
import { mapAddressObjects, SmtpSession } from "../server";
import { SingleKeyOptions } from "nodemailer/lib/dkim";

export interface NodeMailerProcessorConfig extends SmtpComponentConfig {
  type: "nodemailer";
  override?: Mail.Options;
  /**
   * You can define the nodemailer transport options here
   * @see https://nodemailer.com/usage/
   */
  nodemailer?: string | any;
  /**
   * Configuration DKIM per sender domain
   */
  dkims?: {
    [domain: string]: Omit<SingleKeyOptions, "domainName">;
  };
}

export class NodeMailerProcessor<
  T extends NodeMailerProcessorConfig = NodeMailerProcessorConfig
> extends SmtpProcessor<T> {
  type: string = "nodemailer";
  transporter: nodemailer.Transporter;

  /**
   * @override
   */
  init() {
    this.config.dkims ??= {};
    this.transporter = nodemailer.createTransport(this.config.nodemailer);
  }

  /**
   * Transform received email into a mail option for NodeMailer
   * @param email
   * @returns
   */
  static transformEmail(session: SmtpSession): Mail.Options {
    const email = session.email;
    const addressTransformer = a => {
      return a.value.map(ad => ad.address);
    };
    // If no headers we do not fill the bcc as we have no to,cc headers
    if (session.email.headerLines?.length && !session.email.bcc) {
      const noBcc = [session.email.cc, session.email.to].flat().filter(a => a);
      const bcc: AddressObject[] = session.envelope.rcptTo
        .filter(a => {
          // Find address that are not included in the to/cc headers
          return !noBcc.find(b => b.value.find(v => v.address === a.address));
        })
        .map(a => ({ value: AddressParser(a.address), text: a.address, html: a.address }));
      if (bcc.length) {
        session.email.bcc = bcc.length === 1 ? bcc.pop() : bcc;
      }
    }
    return {
      from: email.from.text,
      to: mapAddressObjects<string[]>(email.to, addressTransformer)?.flat(),
      cc: mapAddressObjects<string[]>(email.cc, addressTransformer)?.flat(),
      text: email.text,
      html: email.html === false ? undefined : email.html,
      subject: email.subject,
      attachments: email.attachments.map(a => ({
        ...a,
        contentDisposition: a.contentDisposition === "inline" ? "inline" : "attachment",
        headers: (headers => {
          let res = {};
          [...headers.keys()].forEach(k => {
            res[k] = headers.get(k);
          });
          return res;
        })(a.headers)
      }))
    };
  }

  /**
   * Get the DKIM configuration for the specific domain
   * @param domain
   * @returns
   */
  getDkimForDomain(domain: string): SingleKeyOptions | undefined {
    for (const d in this.config.dkims) {
      if (d === domain) {
        return { ...this.config.dkims[d], domainName: d };
      }
    }
  }

  /**
   * Send with current NodeMailer transporter
   * @param session
   * @returns
   */
  async onMail(session: SmtpSession): Promise<void> {
    const domain = (<any>session.envelope.mailFrom.valueOf()).address.split("@").pop();
    return this.transporter.sendMail({
      ...NodeMailerProcessor.transformEmail(session),
      ...this.config.override,
      dkim: this.getDkimForDomain(domain)
    });
  }
}
