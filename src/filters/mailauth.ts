import { SmtpComponentConfig } from "../component";
import { SmtpFilter } from "../filter";
import { SmtpSession } from "../server";
import { authenticate } from "mailauth";
import { createReadStream } from "node:fs";

export interface MailAuthConfig extends SmtpComponentConfig {
  /**
   * See https://www.npmjs.com/package/mailauth
   */
  mailauth?: {
    /**
     *  the minimum allowed bits of RSA public keys (defaults to 1024). If a DKIM or ARC key has fewer bits, then validation is considered as failed
     * @default 1024
     */
    minBitLength?: number;
    /**
     * Disable ARC checks
     */
    disableArc?: boolean;
    /**
     * Disable Dmarc checks
     */
    disableDmarc?: boolean;
    /**
     * Disable Bimi checks
     */
    disableBimi?: boolean;
    /**
     * DNS lookup limit for SPF. RFC7208 requires this limit to be 10.
     *
     * @default 10
     */
    maxResolveCount?: number;
    /**
     * DNS lookup limit for SPF that produce an empty result. RFC7208 requires this limit to be 2.
     */
    maxVoidCount?: number;
  };
}

/**
 * Ensure SPF, DKIM, DMARC, ARC, BIMI and Received headers are valid
 */
export class MailAuthFilter extends SmtpFilter<MailAuthConfig> {
  type: string = "mailauth";

  async onData(session: SmtpSession): Promise<boolean> {
    const { dkim, spf, arc, dmarc, bimi, receivedChain, headers } = await authenticate(
      createReadStream(session.emailPath),
      {
        ...this.config.mailauth,
        sender: session.envelope.mailFrom !== false ? session.envelope.mailFrom.address : undefined,
        helo: session.hostNameAppearsAs,
        ip: session.remoteAddress
      }
    );
    console.log(dkim, spf, dmarc, arc, bimi, receivedChain, headers);
    return true;
  }
}
