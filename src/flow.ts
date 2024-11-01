import { WorkerOutput } from "@webda/workout";
import { SmtpFilter } from "./filter";
import { StaticAuthConfiguration } from "./filters/static-auth";
import { WhitelistFilterConfiguration } from "./filters/whitelist";
import { SmtpProcessor } from "./processor";
import { AWSProcessorConfig } from "./processors/aws";
import { FileProcessorConfig } from "./processors/file";
import { GCPProcessorConfig } from "./processors/gcp";
import { NodeMailerProcessorConfig } from "./processors/nodemailer";
import { MailAuthConfig } from "./filters/mail-auth";
import { HttpAuthConfig } from "./filters/http-auth";
import { HttpFilterConfig } from "./filters/http-filter";

/**
 * This define one flow within the SMTP Server
 */
export interface SmtpFlowConfig {
  /**
   * Filters to apply to define if the connection/email should be accepted
   */
  filters?: (
    | StaticAuthConfiguration
    | WhitelistFilterConfiguration
    | MailAuthConfig
    | HttpAuthConfig
    | HttpFilterConfig
  )[];
  /**
   * Define which operator applies if several filters are applied
   *
   * @default AND
   */
  filtersOperator?: "AND" | "OR";
  /**
   * Define the processors to execute on the flow
   */
  outputs: (FileProcessorConfig | GCPProcessorConfig | AWSProcessorConfig | NodeMailerProcessorConfig)[];
}

/**
 * Define an execution flow within the SMTP
 *
 * The flow will evaluate based on its filter if the email should continue within it
 *
 * Once the evaluation is done, it will execute every processors of the flow to deliver
 * the email as intended
 */
export class SmtpFlow {
  /**
   * Flow configuration
   */
  config: SmtpFlowConfig;
  /**
   * Filter instances
   */
  filters: SmtpFilter[];
  /**
   * Processor instances
   */
  outputs: SmtpProcessor[];
  /**
   * Name of the flow in the configuration map
   */
  name: string;

  constructor(
    name: string,
    config: SmtpFlowConfig,
    public logger: WorkerOutput
  ) {
    this.name = name;
    this.config = config;
    config.filtersOperator ??= "AND";
    config.filters ??= [];
    config.outputs ??= [];
    this.filters = config.filters.map((f, i) => SmtpFilter.get(this, { ...f, name: f.name || `${f.type}_${i}` }));
    this.outputs = config.outputs.map((f, i) => SmtpProcessor.get(this, { ...f, name: f.name || `${f.type}_${i}` }));
  }
}
