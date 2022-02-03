import { SMTPServer } from "smtp-server";
import * as fs from "fs";
import { SmtpFlow, SmtpFlowConfig } from "./flow";
import * as path from "path";

export type SmtpCallback = (err?, result?) => void;
export type SmtpNext = () => void;
export interface SmtpAuth {
  /**
   *  indicates the authentication method used, ‘PLAIN’, ‘LOGIN’ or ‘XOAUTH2’
   */
  method: string;
  /**
   * is the username of the user
   */
  username: string;
  /**
   *  is the password if LOGIN or PLAIN was used
   */
  password: string;
  /**
   * is the OAuth2 bearer access token if ‘XOAUTH2’ was used as the authentication method
   */
  accessToken: string;
  /**
   * is a function for validating CRAM-MD5 challenge responses. Takes the password of the user as an argument and returns true if the response matches the password
   */
  validatePassword: (password: string) => boolean;
}

export interface SmtpConfig {
  /**
   * Define email flows
   */
  flows: { [key: string]: SmtpFlowConfig };
  /**
   * options defines the behavior of the server
        options.secure if true, the connection will use TLS. The default is false. If the server doesn’t start in TLS mode, it is still possible to upgrade clear text socket to TLS socket with the STARTTLS command (unless you disable support for it). If secure is true, additional tls options for tls.createServer can be added directly onto this options object.
        options.name optional hostname of the server, used for identifying to the client (defaults to os.hostname())
        options.banner optional greeting message. This message is appended to the default ESMTP response.
        options.size optional maximum allowed message size in bytes, see details here
        options.hideSize if set to true then does not expose the max allowed size to the client but keeps size related values like stream.sizeExceeded
        options.authMethods optional array of allowed authentication methods, defaults to [‘PLAIN’, ‘LOGIN’]. Only the methods listed in this array are allowed, so if you set it to [‘XOAUTH2’] then PLAIN and LOGIN are not available. Use [‘PLAIN’, ‘LOGIN’, ‘XOAUTH2’] to allow all three. Authentication is only allowed in secure mode (either the server is started with secure:true option or STARTTLS command is used)
        options.authOptional allow authentication, but do not require it
        options.disabledCommands optional array of disabled commands (see all supported commands here). For example if you want to disable authentication, use [‘AUTH’] as this value. If you want to allow authentication in clear text, set it to [‘STARTTLS’].
        options.hideSTARTTLS optional boolean, if set to true then allow using STARTTLS but do not advertise or require it. It only makes sense when creating integration test servers for testing the scenario where you want to try STARTTLS even when it is not advertised
        options.hidePIPELINING optional boolean, if set to true then does not show PIPELINING in feature list
        options.hide8BITMIME optional boolean, if set to true then does not show 8BITMIME in features list
        options.hideSMTPUTF8 optional boolean, if set to true then does not show SMTPUTF8 in features list
        options.allowInsecureAuth optional boolean, if set to true allows authentication even if connection is not secured first
        options.disableReverseLookup optional boolean, if set to true then does not try to reverse resolve client hostname
        options.sniOptions optional Map or an object of TLS options for SNI where servername is the key. Overrided by SNICallback.
        options.logger optional bunyan compatible logger instance. If set to true then logs to console. If value is not set or is false then nothing is logged
        options.maxClients sets the maximum number of concurrently connected clients, defaults to Infinity
        options.useProxy boolean, if set to true expects to be behind a proxy that emits a PROXY header (version 1 only)
        options.useXClient boolean, if set to true, enables usage of XCLIENT extension to override connection properties. See session.xClient (Map object) for the details provided by the client
        options.useXForward boolean, if set to true, enables usage of XFORWARD extension. See session.xForward (Map object) for the details provided by the client
        options.lmtp boolean, if set to true use LMTP protocol instead of SMTP
        options.socketTimeout how many milliseconds of inactivity to allow before disconnecting the client (defaults to 1 minute)
        options.closeTimeout how many millisceonds to wait before disconnecting pending connections once server.close() has been called (defaults to 30 seconds)
   */
  options: any;
  /**
   * @default 10025
   */
  port?: number;
  /**
   * @default localhost
   */
  bind?: string;
  /**
   * @default `.email_${iso8601}.eml`
   */
  cachePath?: string;
  /**
   * @default false
   */
  keepCache?: boolean;
}

/**
 * Address object in the mailFrom and rcptTo values include the following properties
 */
export interface SmtpAddress {
  /**
   * is the address provided with the MAIL FROM or RCPT TO command
   */
  address: string;
  /**
   * is an object with additional arguments (all key names are uppercase)
   */
  args: string;
}
/**
 * Session object that is passed to the handler functions includes the following properties
 */
export interface SmtpSession {
  /**
   * Path to the email file
   */
  email?: string;
  /**
   * random string identificator generated when the client connected
   */
  id: string;
  /**
   * the IP address for the connected client
   */
  remoteAddress: string;
  /**
   * reverse resolved hostname for remoteAddress
   */
  clientHostname: string;
  /**
   * the opening SMTP command (HELO/EHLO/LHLO)
   */
  openingCommand: string;
  /**
   * hostname the client provided with HELO/EHLO call
   */
  hostNameAppearsAs: string;
  /**
   * includes envelope data
   */
  envelope: {
    /**
     * includes an address object or is set to false
     */
    mailFrom: SmtpAddress | false;
    /**
     *  includes an array of address objects
     */
    rcptTo: SmtpAddress[];
  };
  /**
   * includes the user value returned with the authentication handler
   */
  user: any;
  /**
   * number of the current transaction. 1 is for the first message, 2 is for the 2nd message etc.
   */
  transaction: number;
  /**
   * indicates the current protocol type for the received header (SMTP, ESMTP, ESMTPA etc.)
   */
  transmissionType: string;
  /**
   * Current flows status within the relay
   */
  flows: { [key: string]: "PENDING" | "ACCEPTED" };
}

export class SmtpServer {
  server: SMTPServer;
  config: SmtpConfig;
  flows: { [key: string]: SmtpFlow };

  constructor(configFile: string = undefined) {
    if (!configFile) {
      configFile = "./smtp-relay.json";
    }
    if (!fs.existsSync(configFile)) {
      throw new Error("Configuration not found");
    }
    this.config = JSON.parse(fs.readFileSync(configFile).toString()) || {};
    this.config.port ??= 10025;
    this.config.bind ??= "localhost";
    this.config.cachePath ??= ".email_${iso8601}.eml";
    fs.mkdirSync(path.dirname(this.config.cachePath), { recursive: true });
    this.flows = {};
    for (let i in this.config.flows) {
      this.flows[i] = new SmtpFlow(i, this.config.flows[i]);
    }
  }

  init() {
    this.server = new SMTPServer({
      banner: "loopingz/smtp-relay",
      ...this.config.options,
      onAuth: (auth: SmtpAuth, session: SmtpSession, callback: SmtpCallback) =>
        this.onEvent("Auth", auth, session, callback),
      onConnect: (session: SmtpSession, callback: SmtpCallback) => this.onConnect(session, callback),
      onMailFrom: (address: SmtpAddress, session: SmtpSession, callback: SmtpCallback) =>
        this.onEvent("MailFrom", address, session, callback),
      onRcptTo: (address: SmtpAddress, session: SmtpSession, callback: SmtpCallback) =>
        this.onEvent("RcptTo", address, session, callback),
      onData: (stream: ReadableStream, session: SmtpSession, callback: SmtpCallback) =>
        this.onData(stream, session, callback)
    });

    this.server.on("error", err => {
      console.log("Error %s", err.message);
    });
    this.server.listen(this.config.port);
  }

  addFlow(flow: SmtpFlow) {
    this.flows[flow.name] = flow;
  }

  removeFlow(flow: SmtpFlow) {
    this.flows[flow.name] = undefined;
  }

  async filter(
    evt: "Auth" | "MailFrom" | "RcptTo" | "Data" | "Connect" | "Close",
    session: SmtpSession,
    args: any[],
    flows: any = session.flows
  ) {
    for (let name in this.flows) {
      let flow = this.flows[name];
      if (session.flows[name] === "ACCEPTED" && flow.config.filtersOperator === "OR") {
        continue;
      }
      for (let filter of flow.filters) {
        if (!filter[`on${evt}`]) {
          continue;
        }
        // @ts-ignore
        let res = await filter[`on${evt}`](...args);
        console.log(`${filter.name}.on${evt}() = `, res);
        // If undefined the filter is not giving an answer so skipping
        if (res === undefined) {
          continue;
        }
        if (flow.config.filtersOperator === "OR") {
          if (res) {
            session.flows[name] = "ACCEPTED";
          }
        } else if (!res) {
          delete session.flows[name];
          break;
        } else {
          session.flows[name] = "ACCEPTED";
        }
      }
    }
  }

  async onConnect(session: SmtpSession, callback: SmtpCallback) {
    console.log("onConnect");
    try {
      session.flows = {};
      Object.keys(this.flows).forEach(n => (session.flows[n] = "PENDING"));
      await this.filter("Connect", session, [session], this.flows);
      this.manageCallback(session, callback);
    } catch (err) {
      callback(err);
    }
  }

  static replaceVariables(value: string, replacements: { [key: string]: any } = {}): string {
    let now = new Date();
    replacements.timestamp = now.getTime().toString();
    replacements.iso8601 = now.toISOString().replace(/[-:\.]/g, "");
    for (let i in replacements) {
      value = value.replace(new RegExp("\\$\\{" + i + "\\}", "g"), replacements[i].toString());
    }
    return value;
  }

  async onData(stream: ReadableStream, session: SmtpSession, callback: SmtpCallback) {
    session.email = SmtpServer.replaceVariables(this.config.cachePath, { ...session });

    // @ts-ignore
    stream.pipe(fs.createWriteStream(session.email));
    // @ts-ignore
    stream.on("end", async () => {
      await this.filter("Data", session, [session]);
      await this.onDataRead(session);
      if (!this.config.keepCache) {
        fs.unlinkSync(session.email);
      }
      callback();
    });

    // @ts-ignore
    stream.on("error", err => callback(`error converting stream - ${err}`));
  }

  async onEvent(
    evt: "Auth" | "MailFrom" | "RcptTo",
    param: SmtpAddress | SmtpAuth,
    session: SmtpSession,
    callback: SmtpCallback
  ) {
    try {
      await this.filter(evt, session, [param, session]);
      // If no decision made after RCPT TO we consider refused
      if (evt === "RcptTo") {
        for (let name in session.flows) {
          // Skip any flow that was not accepted explicitely
          if (session.flows[name] === "PENDING") {
            delete session.flows[name];
          }
        }
      }
      // Send an error if no more flows are active
      this.manageCallback(session, callback);
    } catch (err) {
      callback(err);
    }
  }

  async onDataRead(session: SmtpSession) {
    try {
      for (let name in session.flows) {
        let flow = this.flows[name];
        console.log("Call outputs", flow.outputs);
        for (let output of flow.outputs) {
          await output.onMail(session);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  manageCallback(session: SmtpSession, callback: SmtpCallback) {
    if (Object.keys(session.flows).length === 0) {
      callback(new Error("Message refused"));
    } else {
      callback();
    }
  }

  close() {
    this.server.close();
  }
}
