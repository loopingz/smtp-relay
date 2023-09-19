import { CloudEvent } from "cloudevents";
import { SmtpSession } from "./server";
import { AddressObject } from "mailparser";
import { SMTPServerAddress } from "smtp-server";

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

export function getCloudEvent<T extends SmtpCloudEvent = SmtpCloudEvent>(
  session: SmtpSession,
  truncation: number = 8192
): CloudEvent<T> {
  const getAddressObject = (arg: SMTPServerAddress | false) : AddressObject => {
    if (!arg) {
      return undefined;
    }
    return {
      value: [
        {
          address: arg.address,
          name: arg.address
        }
      ],
      html: arg.address,
      text: arg.address
    }
  }
  session.email.from ??= getAddressObject(session.envelope.mailFrom);
  session.email.to ??= session.envelope.rcptTo?.map(a => getAddressObject(a));
  return new CloudEvent<T>({
    type: "com.loopingz.smtp-relay.v2",
    source: session.localAddress,
    time: session.time.toISOString(),
    subject: session.email?.messageId,
    data: <T>{
      email: (email => ({
        from: email.from,
        attachments: email.attachments.map(a => ({
          filename: a.filename?.substring(0, truncation),
          size: a.size
        })),
        subject: email.subject?.substring(0, truncation),
        priority: email.priority,
        cc: email.cc,
        to: email.to,
        bcc: email.bcc,
        text: email.text?.substring(0, truncation),
        html: email.html ? email.html.substring(0, truncation) : undefined
      }))(session.email),
      server: {
        clientHostname: session.clientHostname.substring(0, truncation),
        remoteAddress: session.remoteAddress,
        remotePort: session.remotePort,
        hostNameAppearAs: session.hostNameAppearsAs,
        id: session.id,
        secure: session.secure,
        transmissionType: session.transmissionType,
        username: session.user
      }
    }
  });
}
