import { CloudEvent } from "cloudevents";
import { AddressObject } from "mailparser";
import { mapAddressObjects, SmtpSession } from "./server";

/**
 * CloudEvent Data representation for smtp-relay
 */
export interface SmtpCloudEvent {
  email: {
    from?: string;
    attachments: {
      filename: string;
      size: number;
    }[];
    subject?: string;
    priority?: string;
    to?: string;
    cc?: string;
    bcc?: string;
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
  };
}

export function getCloudEvent<T extends SmtpCloudEvent = SmtpCloudEvent>(
  session: SmtpSession,
  truncation: number = 8192
): CloudEvent<T> {
  const addressTransformer = a => {
    return a.value.map(ad => ad.address).join(",");
  };
  return new CloudEvent<T>({
    type: "com.loopingz.smtp-relay",
    source: session.localAddress,
    time: session.time.toISOString(),
    subject: session.email?.messageId,
    data: <T>{
      email: (email => ({
        from: email.from.value.shift()?.address.substr(0, truncation),
        attachments: email.attachments.map(a => ({
          filename: a.filename?.substr(0, truncation),
          size: a.size
        })),
        subject: email.subject?.substr(0, truncation),
        priority: email.priority,
        cc: mapAddressObjects(email.cc, addressTransformer)?.join(",").substr(0, truncation),
        to: mapAddressObjects(email.to, addressTransformer)?.join(",").substr(0, truncation),
        bcc: mapAddressObjects(email.bcc, addressTransformer)?.join(",").substr(0, truncation),
        text: email.text?.substr(0, truncation),
        html: email.html ? email.html.substr(0, truncation) : undefined
      }))(session.email),
      server: {
        clientHostname: session.clientHostname.substr(0, truncation),
        remoteAddress: session.remoteAddress,
        remotePort: session.remotePort,
        hostNameAppearAs: session.hostNameAppearsAs,
        id: session.id,
        secure: session.secure,
        transmissionType: session.transmissionType
      }
    }
  });
}
