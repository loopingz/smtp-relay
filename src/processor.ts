import { SmtpFlow } from "./flow";
import { SmtpSession } from "./server";

/**
 * Middleware to add behavior to the smtp
 */
export class SmtpProcessor {
  type: string;
  onMail: (session: SmtpSession) => Promise<any>;

  static registry = {};

  static register(type: string, constructor) {
    SmtpProcessor.registry[type] = constructor;
  }

  static get(flow: SmtpFlow, config: SmtpProcessorConfig): SmtpProcessor {
    return new SmtpProcessor.registry[config.type](flow, config);
  }
}

export interface SmtpProcessorConfig {
  type: string;
  name?: string;
}
