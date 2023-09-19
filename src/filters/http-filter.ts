import { SMTPServerAuthentication } from "smtp-server";
import { SmtpComponentConfig } from "../component";
import { SmtpFilter } from "../filter";
import { SmtpSession } from "../server";
import { request } from "./http-auth";
import { getCloudEvent } from "../cloudevent";

export interface HttpConfig extends SmtpComponentConfig {
  /**
   * Url to request
   */
  url: string;
  /**
   * Used to sign request
   */
  hmac?: {
    /**
     * Secret to use
     */
    secret: string;
    /**
     * @default sha256
     */
    algo?: string;
    /**
     * @default X-SMTP-RELAY
     */
    header?: string;
  };
}

export interface HttpFilterConfig extends HttpConfig {
  method?: "PUT" | "POST";
  /**
   * Accept any form of authentication to rely solely on username
   *
   * @default false
   */
  allowAnyUser?: boolean;
}

/**
 *
 */
export class HttpFilter extends SmtpFilter<HttpFilterConfig> {
  type: string = "http-filter";

  /**
   * @override
   */
  init() {
    if (this.config.url === undefined) {
      throw new Error("http-auth filter requires an url");
    }
    this.config.allowAnyUser ??= false;
    this.config.method ??= "POST";
  }

  async onData(session: SmtpSession): Promise<boolean> {
    let res = await request({
      ...this.config,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(getCloudEvent(session))
    });
    console.log("onData result", res, res.ok);
    return res.ok;
  }

  /**
   * Based on config allow any user
   *
   * @returns
   */
  async onAuth(auth: SMTPServerAuthentication, session: SmtpSession): Promise<boolean | undefined> {
    return this.config.allowAnyUser || undefined;
  }
}
