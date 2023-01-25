import { ConsoleLogger, FileLogger, WorkerLogLevel, WorkerOutput } from "@webda/workout";
import * as fs from "fs";
import * as http from "http";
import { AddressObject, ParsedMail, simpleParser } from "mailparser";
import * as path from "path";
import { collectDefaultMetrics, Counter, register } from "prom-client";
import {
  SMTPServer,
  SMTPServerAddress,
  SMTPServerAuthentication,
  SMTPServerDataStream,
  SMTPServerOptions,
  SMTPServerSession
} from "smtp-server";
import stripJsonComments from "strip-json-comments";
import { parse as YAMLParse } from "yaml";
import { SmtpFlow, SmtpFlowConfig } from "./flow";

export type SmtpCallback = (err?, result?) => void;
export type SmtpNext = () => void;

export interface LoggerOptions {
  level?: WorkerLogLevel;
  format?: string;
}
export interface ConsoleLoggerOptions extends LoggerOptions {
  type: "CONSOLE";
}

export interface FileLoggerOptions extends LoggerOptions {
  type: "FILE";
  filepath: string;
  sizeLimit: number;
}

export interface SmtpConfig {
  /**
   * @pattern https:\/\/raw\.githubusercontent\.com\/loopingz\/smtp-relay\/(main|v\d+\.\d+\.\d+)\/config\.schema\.json
   */
  $schema: string;
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
        options.closeTimeout how many milliseconds to wait before disconnecting pending connections once server.close() has been called (defaults to 30 seconds)
   */
  options: Pick<
    SMTPServerOptions,
    | "secure"
    | "name"
    | "banner"
    | "size"
    | "disabledCommands"
    | "hide8BITMIME"
    | "hidePIPELINING"
    | "hideSMTPUTF8"
    | "hideSTARTTLS"
    | "allowInsecureAuth"
    | "closeTimeout"
    | "socketTimeout"
    | "lmtp"
    | "useXForward"
    | "useXClient"
    | "useProxy"
    | "maxClients"
    | "maxVersion"
    | "authMethods"
    | "authOptional"
    | "disableReverseLookup"
  > & {
    loggers?: (ConsoleLoggerOptions | FileLoggerOptions)[];
  };
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
  /**
   * Configure prometheus metrics
   */
  prometheus?: {
    /**
     * Port to bind to serve prometheus metrics
     */
    portNumber: number;
    /**
     * Url to use
     * @default /metrics
     */
    url?: string;
    /**
     * Collect node metrics
     */
    nodeMetrics?: boolean;
    /**
     * Default labels to add to prometheus
     */
    defaultLabels?: { [key: string]: string };
    /**
     * Bind to a specific address
     */
    bind?: string;
  };
}

/**
 * Session object that is passed to the handler functions includes the following properties
 */
export interface SmtpSession extends SMTPServerSession {
  /**
   * Time when the session was established
   */
  time: Date;
  /**
   * Path to the email file
   * 
   * Parsed mail* object has the following properties

      headers – a Map object with lowercase header keys
      subject is the subject line (also available from the header mail.headers.get(‘subject’))
      from is an address object for the From: header
      to is an address object for the To: header
      cc is an address object for the Cc: header
      bcc is an address object for the Bcc: header (usually not present)
      date is a Date object for the Date: header
      messageId is the Message-ID value string
      inReplyTo is the In-Reply-To value string
      reply-to is an address object for the Cc: header
      references is an array of referenced Message-ID values
      html is the HTML body of the message. If the message included embedded images as cid: urls then these are all replaced with base64 formatted data: URIs
      text is the plaintext body of the message
      textAsHtml is the plaintext body of the message formatted as HTML
      attachments is an array of attachments
   */
  email?: ParsedMail;
  /**
   * Path of the email content
   */
  emailPath?: string;
  /**
   * Current flows status within the relay
   */
  flows: { [key: string]: "PENDING" | "ACCEPTED" };
}

export class SmtpServer {
  server: SMTPServer;
  config: SmtpConfig;
  flows: { [key: string]: SmtpFlow };
  logger: WorkerOutput;
  counter?: Counter;
  promServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;

  constructor(configFile: string = undefined) {
    if (!configFile) {
      configFile = "./smtp-relay.json";
    }
    if (!fs.existsSync(configFile)) {
      throw new Error(`Configuration '${configFile}' not found`);
    }
    if (configFile.match(/\.jsonc?$/)) {
      this.config = JSON.parse(stripJsonComments(fs.readFileSync(configFile).toString())) || {};
    } else if (configFile.match(/\.ya?ml$/)) {
      this.config = YAMLParse(fs.readFileSync(configFile).toString()) || {};
    } else {
      throw new Error(`Configuration format not handled ${configFile}`);
    }
    this.config.port ??= 10025;
    this.config.bind ??= "localhost";
    this.config.cachePath ??= ".email_${iso8601}.eml";
    this.config.options ??= {};
    this.config.options.loggers ??= [];
    if (this.config.prometheus) {
      register.setDefaultLabels(this.config.prometheus.defaultLabels || {});
      if (this.config.prometheus.nodeMetrics) {
        collectDefaultMetrics();
      }
      this.config.prometheus.url ??= "/metrics";
      this.counter = new Counter({
        name: "smtp-relay-emails",
        labelNames: ["flow", "status", "output"],
        help: "Emails counter"
      });
      this.promServer = http
        .createServer(async (req, res) => {
          if (req.method === "GET" && req.url === this.config.prometheus.url) {
            res.writeHead(200, { "Content-Type": register.contentType });
            res.write(await register.metrics());
            res.end();
          }
          res.writeHead(404);
          res.end();
        })
        .listen(this.config.prometheus.portNumber, this.config.prometheus.bind);
    }
    this.logger = new WorkerOutput();
    fs.mkdirSync(path.dirname(this.config.cachePath), { recursive: true });
    this.flows = {};
    for (let i in this.config.flows) {
      this.flows[i] = new SmtpFlow(i, this.config.flows[i], this.logger);
    }
  }

  init() {
    this.config.options.loggers.forEach(logger => {
      if (logger.type === "CONSOLE") {
        new ConsoleLogger(this.logger, logger.level, logger.format);
      } else if (logger.type === "FILE") {
        new FileLogger(this.logger, logger.level, logger.filepath, logger.sizeLimit, logger.format);
      }
    });

    const logger = this.logger.getBunyanLogger();
    this.server = new SMTPServer({
      banner: "loopingz/smtp-relay",
      ...this.config.options,
      // We move SMTPServer log INFO level to DEBUG as it is very verbose
      logger: this.config.options.loggers.length > 0 ? { ...logger, info: logger.debug, level: () => {} } : false,
      onAuth: (auth: SMTPServerAuthentication, session: SmtpSession, callback: SmtpCallback) =>
        this.onAuth(auth, session, callback),
      onConnect: (session: SmtpSession, callback: SmtpCallback) => this.onConnect(session, callback),
      onMailFrom: (address: SMTPServerAddress, session: SmtpSession, callback: SmtpCallback) =>
        this.onEvent("MailFrom", address, session, callback),
      onRcptTo: (address: SMTPServerAddress, session: SmtpSession, callback: SmtpCallback) =>
        this.onEvent("RcptTo", address, session, callback),
      onData: (stream: SMTPServerDataStream, session: SmtpSession, callback: SmtpCallback) =>
        this.onData(stream, session, callback)
    });

    /* c8 ignore next 3 */
    this.server.on("error", err => {
      this.logger.log("ERROR", err.message);
    });
    this.server.listen(this.config.port);
  }

  /**
   * Add a flow to the server
   * @param flow
   */
  addFlow(flow: SmtpFlow) {
    this.flows[flow.name] = flow;
  }

  /**
   * Remove a flow from the server
   * @param flow
   */
  removeFlow(flow: SmtpFlow) {
    this.flows[flow.name] = undefined;
  }

  async filter(evt: "Auth" | "MailFrom" | "RcptTo" | "Data" | "Connect" | "Close", session: SmtpSession, args: any[]) {
    for (let name in this.flows) {
      let flow = this.flows[name];
      if (session.flows[name] === "ACCEPTED" && flow.config.filtersOperator === "OR") {
        continue;
      }
      for (let filter of flow.filters) {
        // @ts-ignore
        let res = await filter[`on${evt}`](...args);
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

  /**
   * Manage connection filters
   * @param session
   * @param callback
   */
  async onConnect(session: SmtpSession, callback: SmtpCallback) {
    try {
      session.time = new Date();
      session.flows = {};
      Object.keys(this.flows).forEach(n => (session.flows[n] = "PENDING"));
      await this.filter("Connect", session, [session]);
      this.manageCallback(session, callback);
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Replace variables so they can be used to define storage path or other
   *
   * @param value
   * @param session
   * @param replacements
   * @returns
   */
  static replaceVariables(value: string, session: SmtpSession, replacements: { [key: string]: any } = {}): string {
    replacements.timestamp = session.time.getTime().toString();
    replacements.iso8601 = session.time.toISOString().replace(/[-:\.]/g, "");
    replacements.id = session.id;
    replacements.messageId = session.email?.messageId || "";
    replacements.from = session.envelope.mailFrom ? session.envelope.mailFrom.address : "";
    replacements.subject = session.email?.subject || "";
    replacements.to = session.envelope.rcptTo.map(a => a.address).join(",") || "";

    for (let i in replacements) {
      value = value.replace(new RegExp("\\$\\{" + i + "\\}", "g"), replacements[i]?.toString());
    }
    return value;
  }

  /**
   * Manage the Data filter
   * @param stream
   * @param session
   * @param callback
   */
  async onData(stream: SMTPServerDataStream, session: SmtpSession, callback: SmtpCallback) {
    session.emailPath = SmtpServer.replaceVariables(this.config.cachePath, { ...session });

    // @ts-ignore
    stream.pipe(fs.createWriteStream(session.emailPath));
    // @ts-ignore
    stream.on("end", async () => {
      await this.filter("Data", session, [session]);
      session.email = await simpleParser(fs.createReadStream(session.emailPath));
      await this.onDataRead(session);
      if (!this.config.keepCache) {
        fs.unlinkSync(session.emailPath);
      }
      callback();
    });

    /* istanbul ignore next */
    stream.on("error", err => callback(`error converting stream - ${err}`));
  }

  /**
   * Manage the authentication filter
   * @param auth
   * @param session
   * @param callback
   */
  async onAuth(auth: SMTPServerAuthentication, session: SmtpSession, callback: SmtpCallback) {
    try {
      await this.filter("Auth", session, [auth, session]);
      // No filter have approved the auth
      if (Object.keys(session.flows).length === 0) {
        throw new Error("Invalid authentication");
      }
      // Return user as valid
      callback(null, { user: auth.username });
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Manage RcptTo and MailFrom filtering
   * @param evt
   * @param param
   * @param session
   * @param callback
   */
  async onEvent(evt: "MailFrom" | "RcptTo", param: SMTPServerAddress, session: SmtpSession, callback: SmtpCallback) {
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

  /**
   *
   * @param session
   */
  async onDataRead(session: SmtpSession) {
    for (let name in session.flows) {
      let flow = this.flows[name];
      this.counter.inc({ status: "accepted", flow: name });
      for (let output of flow.outputs) {
        console.log(`Output[${output.name}] triggered`);
        try {
          await output.onMail(session);
        } catch (err) {
          flow.logger.log("ERROR", err);
          this.counter.inc({ status: "error", flow: name, output: output.name });
        }
      }
    }
  }

  manageCallback(session: SmtpSession, callback: SmtpCallback) {
    if (Object.keys(session.flows).length === 0) {
      this.counter.inc({ status: "rejected" });
      callback(new Error("Message refused"));
    } else {
      callback();
    }
  }

  /**
   * Close current server
   */
  close() {
    this.server.close();
  }
}

export function mapAddressObjects<T = any>(
  obj: AddressObject | AddressObject[] | undefined,
  transform: (obj: AddressObject) => T
): T[] | undefined {
  if (!obj) {
    return undefined;
  }
  if (Array.isArray(obj)) {
    return obj.map(transform);
  }
  return [transform(obj)];
}
