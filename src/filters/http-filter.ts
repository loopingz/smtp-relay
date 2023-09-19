import { SMTPServerAddress, SMTPServerAuthentication } from "smtp-server";
import { SmtpComponentConfig } from "../component";
import { SmtpFilter } from "../filter";
import { SmtpSession } from "../server";
import { request } from "./http-auth";

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
  sessions: WeakMap<
    SmtpSession,
    {
      remoteAddress: string;
      clientHostname: string;
      localPort: number;
      remotePort: number;
      username: string;
      rcpts: string[];
      from: string;
    }
  > = new WeakMap();

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

  /**
   * Collect data
   * @param address
   * @param session
   * @returns
   */
  async onMailFrom(address: SMTPServerAddress, session: SmtpSession): Promise<boolean | undefined> {
    this.sessions.get(session).from = address.address.toString();
    return undefined;
  }

  /**
   * Collect data
   * @param address
   * @param session
   * @returns
   */
  async onRcptTo(address: SMTPServerAddress, session: SmtpSession): Promise<boolean | undefined> {
    this.sessions.get(session).rcpts ??= [];
    this.sessions.get(session).rcpts.push(address.address);
    return undefined;
  }

  async onData(session: SmtpSession): Promise<boolean> {
    let res = await request({
      ...this.config,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...this.sessions.get(session),
        secure: session.secure,
        anonymous: session.user === undefined
      })
    });
    this.sessions.delete(session);
    return res.ok;
  }

  /**
   * Based on config allow any user
   *
   * @returns
   */
  async onAuth(auth: SMTPServerAuthentication, session: SmtpSession): Promise<boolean | undefined> {
    this.sessions.get(session).username = auth.username;
    return this.config.allowAnyUser || undefined;
  }

  async onConnect(session: SmtpSession): Promise<boolean | undefined> {
    let info = {
      remoteAddress: session.remoteAddress,
      remotePort: session.remotePort,
      clientHostname: session.clientHostname,
      localAddress: session.localAddress,
      localPort: session.localPort
    };
    this.sessions.set(session, <any>info);
    return undefined;
  }
}
