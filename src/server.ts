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
import { HeadersTransform, HeadersTransformConfig } from "./headers_transformer";

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
   * Manipulate headers
   *
   * @default {"x-smtp-relay": "current-version"}
   */
  mailHeaders?: HeadersTransformConfig;
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
    console.log(`[SmtpServer CONSTRUCTOR] Received configFile: ${configFile}`);
    const effectiveConfigFile = configFile || "./smtp-relay.json";
    console.log(`[SmtpServer CONSTRUCTOR] Effective configFile: ${effectiveConfigFile}`);
    
    // Resolve the configuration file path relative to the current working directory
    const resolvedConfigFile = path.resolve(process.cwd(), effectiveConfigFile);
    console.log(`[SmtpServer CONSTRUCTOR] Resolved configFile: ${resolvedConfigFile}, CWD: ${process.cwd()}`);

    if (!fs.existsSync(resolvedConfigFile)) {
      console.error(`[SmtpServer CONSTRUCTOR] ERROR: File not found at resolved path: ${resolvedConfigFile}`);
      throw new Error(`Configuration '${resolvedConfigFile}' (resolved from '${effectiveConfigFile}') not found. CWD: ${process.cwd()}`);
    }
    
    console.log(`[SmtpServer CONSTRUCTOR] Loading config from: ${resolvedConfigFile}`);
    if (resolvedConfigFile.match(/\.jsonc?$/)) {
      this.config = JSON.parse(stripJsonComments(fs.readFileSync(resolvedConfigFile).toString())) || {};
    } else if (resolvedConfigFile.match(/\.ya?ml$/)) {
      this.config = YAMLParse(fs.readFileSync(resolvedConfigFile).toString()) || {};
    } else {
      throw new Error(`Configuration format not handled ${resolvedConfigFile}`);
    }

    this.config.port ??= 10025;
    this.config.bind ??= "localhost";
    this.config.cachePath ??= ".email_${iso8601}.eml";
    this.config.options ??= {};
    if (!this.config.mailHeaders) {
      const packageDesc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "package.json")).toString());
      this.config.mailHeaders ??= {
        "x-smtp-relay": packageDesc.version
      };
    }
    // Default to console
    this.config.options.loggers ??= [{ type: "CONSOLE" }];
    if (this.config.prometheus) {
      register.setDefaultLabels(this.config.prometheus.defaultLabels || {});
      if (this.config.prometheus.nodeMetrics) {
        collectDefaultMetrics();
      }
      this.config.prometheus.url ??= "/metrics";
      this.counter = new Counter({
        name: "smtp_relay_emails_total",
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
      this.logger.log("ERROR", `SMTPServer internal error: ${err.message}`, err);
      // If init is part of a promise, this error should cause it to reject.
    });
    // this.server.listen(this.config.port); // Will be part of the promise
    return new Promise<void>((resolve, reject) => {
      this.server.on('error', (err) => { // Listen for errors specifically during listen
        this.logger.log("ERROR", `Failed to start SMTPServer: ${err.message}`);
        reject(err);
      });
      this.server.listen(this.config.port, this.config.bind, () => {
        this.logger.log("INFO", `SMTP Server listening on ${this.config.bind}:${this.config.port}`);
        resolve();
      });
    });
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
    this.logger.log("DEBUG", `onData called for session ${session.id}. Client: ${session.clientHostname}[${session.remoteAddress}]`);
    session.emailPath = SmtpServer.replaceVariables(this.config.cachePath, { ...session });

    // Separate "pre-stream" filters (like AuthFilter) from "post-stream" filters
    const preStreamFilters: any[] = []; // Using 'any' for now, should be SmtpFilter if possible
    const postStreamFilters: any[] = [];

    for (const flowName in this.flows) {
      const flow = this.flows[flowName];
      if (session.flows[flowName] === "ACCEPTED" && flow.config.filtersOperator === "OR") {
        // If flow already accepted by OR operator, might skip some filters based on logic
        // For now, we'll collect all and let filter logic decide
      }
      flow.filters.forEach(filter => {
        // TODO: Find a better way to distinguish these filters.
        // For now, assuming 'auth' type filters are pre-stream.
        // A more robust way would be a property on the filter class or a separate registry.
        if (filter.config.type === "auth") { // Example: AuthFilter
          if (!preStreamFilters.find(f => f === filter)) preStreamFilters.push(filter);
        } else {
          // Assuming other 'Data' filters operate on parsed email (post-stream)
          // Or filters that don't have an onData method specific to the stream
          if (typeof filter.onData === 'function' && filter.onData.length <= 1) { // onData(session)
             if (!postStreamFilters.find(f => f === filter)) postStreamFilters.push(filter);
          }
        }
      });
    }
    
    let currentFilterIndex = 0;
    this.logger.log("DEBUG", `Session ${session.id}: Starting pre-stream filter processing. Found ${preStreamFilters.length} pre-stream filters.`);

    const processNextPreStreamFilter = async () => {
      if (currentFilterIndex >= preStreamFilters.length) {
        this.logger.log("DEBUG", `Session ${session.id}: All pre-stream filters passed. Proceeding to save and process email content.`);
        pipeStreamAndProcessPostStreamFilters();
        return;
      }

      const filter = preStreamFilters[currentFilterIndex];
      currentFilterIndex++;
      this.logger.log("DEBUG", `Session ${session.id}: Calling pre-stream filter: ${filter.name} (type: ${filter.config.type})`);

      try {
        // AuthFilter's onData expects (stream, session, callback)
        // Need to handle the stream carefully if multiple pre-stream filters consume it.
        // For now, AuthFilter is the primary one, and it consumes the stream.
        // This logic assumes AuthFilter is the only one, or subsequent ones get an empty stream.
        // This needs refinement if multiple pre-stream filters need the *same* stream content.
        if (filter.config.type === 'auth') { // Specifically AuthFilter
          // Promisify the call to filter.onDataStream
          await new Promise<void>((resolve, reject) => {
            filter.onDataStream(stream, session, (err?: Error | null, code?: string) => {
              if (err) {
                this.logger.log("WARN", `Pre-stream filter ${filter.name} (${filter.type}) rejected email for session ${session.id}: ${err.message}`);
                // @ts-ignore - SmtpCallback can take a code
                callback(err, code); // Reject the email via SmtpServer's main callback
                return reject(err); // Reject the promise to stop this filter chain
              }
              resolve(); // Resolve the promise to continue to the next filter
            });
          }).then(async () => { // if onDataStream's callback was called without error
            await processNextPreStreamFilter(); // Process next pre-stream filter
          }).catch((filterRejectionError) => {
            // If filter.onDataStream's callback resulted in rejection (passed error to SmtpServer's callback, which then rejected this promise)
            // We don't want to proceed to pipeStreamAndProcessPostStreamFilters if an error was already sent.
            // The main SmtpServer callback has already been called with an error by this point.
            this.logger.log("DEBUG", `Filter ${filter.name} rejected, preventing further pre-stream processing. Error: ${filterRejectionError?.message}`);
          });
        } else {
          // If other pre-stream filters exist with different signatures, handle here
          this.logger.log("WARN", `Unsupported pre-stream filter type or signature for ${filter.name} (${filter.type})`);
          await processNextPreStreamFilter(); // Continue with next filter
        }
      } catch (filterError: any) { // Synchronous error during the setup/call of onDataStream
        this.logger.log("ERROR", `Synchronous error executing pre-stream filter ${filter.name} (${filter.type}) for session ${session.id}: ${filterError.message}`);
        // Decide on error handling: reject or continue? For now, continue to next filter or processing.
        // Or, more safely, reject the email:
        // callback(new Error(`Critical error in filter ${filter.name}`));
        // return; 
        await processNextPreStreamFilter();
      }
    };
    
    const pipeStreamAndProcessPostStreamFilters = () => {
      this.logger.log("DEBUG", `Session ${session.id}: Saving email to ${session.emailPath}`);
      // @ts-ignore - HeadersTransform is a valid stream
      const transformStream = stream.pipe(new HeadersTransform(this.config.mailHeaders));
      transformStream.pipe(fs.createWriteStream(session.emailPath!));

      transformStream.on("end", async () => {
        this.logger.log("DEBUG", `Session ${session.id}: Email saved. Parsing email from ${session.emailPath}`);
        try {
          session.email = await simpleParser(fs.createReadStream(session.emailPath!));
          this.logger.log("DEBUG", `Session ${session.id}: Email parsed. Starting post-stream filter processing. Found ${postStreamFilters.length} post-stream filters.`);
          
          // Now run post-stream filters (original this.filter("Data", ...) logic)
          // We need to ensure we are only running filters that haven't run or are meant for post-stream
          // The current SmtpServer.filter logic might need adjustment or a new method
          // For simplicity, we'll reuse the existing filter logic, assuming it handles 'Data' event
          // for filters that expect a parsed email.
          
          // Rebuild args for post-stream filters that expect onData(session)
          // The original filter("Data", session, [session]) would call onData(session)
          for (const flowName in this.flows) {
            const flow = this.flows[flowName];
            if (session.flows[flowName] === "ACCEPTED" && flow.config.filtersOperator === "OR") {
              continue;
            }
            for (const filter of flow.filters) {
              // Only run if it's a post-stream filter and has onData(session)
              if (postStreamFilters.includes(filter)) {
                this.logger.log("DEBUG", `Session ${session.id}: Calling post-stream filter: ${filter.name} (type: ${filter.config.type})`);
                 // @ts-ignore filter could be any SmtpFilter
                const res = await filter.onData(session);
                this.logger.log("DEBUG", `Session ${session.id}: Post-stream filter ${filter.name} result: ${res}`);
                if (res === undefined) continue;
                if (flow.config.filtersOperator === "OR") {
                  if (res) session.flows[flowName] = "ACCEPTED";
                } else if (!res) {
                  delete session.flows[flowName];
                  break; 
                } else {
                  session.flows[flowName] = "ACCEPTED";
                }
              }
            }
          }
          this.logger.log("DEBUG", `Session ${session.id}: Post-stream filters processed. Active flows: %j`, session.flows);

          for (let name in session.flows) {
            if (session.flows[name] === "PENDING") {
              delete session.flows[name];
            }
          }

          this.manageCallback(session, finalErr => {
            if (finalErr) {
              return callback(finalErr);
            }
            (async () => {
              await this.onDataRead(session);
              if (!this.config.keepCache) {
                fs.unlink(session.emailPath!, errUnlink => {
                  errUnlink && this.logger.log("ERROR", `Unable to delete ${session.emailPath}`, errUnlink);
                });
              }
              callback();
            })();
          });
        } catch (parseError: any) {
          this.logger.log("ERROR", `Error parsing email or in post-stream filters for session ${session.id}: ${parseError.message}`);
          return callback(parseError);
        }
      });

      transformStream.on("error", (streamErr: Error) => {
        this.logger.log("ERROR", `Error piping stream for session ${session.id}: ${streamErr.message}`);
        callback(streamErr); // error converting stream
      });
    };

    // Start processing pre-stream filters
    await processNextPreStreamFilter();
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
    try {
      // We filter here as we can have several RCPT TO
      for (let name in session.flows) {
        let flow = this.flows[name];
        this.counter?.inc({ status: "accepted", flow: name });
        this.logger.log(
          "INFO",
          `Accepting mail from ${
            session.envelope.mailFrom ? session.envelope.mailFrom.address : "unknown"
          } to ${session.envelope.rcptTo.map(a => a.address).join(",")} (${session.clientHostname})`
        );
        for (let output of flow.outputs) {
          this.logger.log("DEBUG", `Output[${output.name}] triggered`);
          try {
            await output.onMail(session);
          } catch (err) {
            this.logger.log("ERROR", `Flow(${name}) Output(${output.name})`, err);
            this.counter?.inc({ status: "error", flow: name, output: output.name });
          }
        }
      }
    } catch (err) {
      this.logger.log("ERROR", err);
    }
  }

  manageCallback(session: SmtpSession, callback: SmtpCallback) {
    if (Object.keys(session.flows).length === 0) {
      this.counter?.inc({ status: "rejected" });
      this.logger.log(
        "INFO",
        `Rejecting mail from ${
          session.envelope.mailFrom ? session.envelope.mailFrom.address : "unknown"
        } to ${session.envelope.rcptTo.map(a => a.address).join(",")} (${session.clientHostname})`
      );
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
