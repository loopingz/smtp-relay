import { SmtpFlow } from "./flow";
import { SmtpSession } from "./server";
import { SmtpComponent, SmtpComponentConfig } from "./component";

/**
 * Middleware to add behavior to the smtp
 */
export abstract class SmtpProcessor<T extends SmtpComponentConfig = SmtpComponentConfig> extends SmtpComponent<T> {
  abstract onMail(session: SmtpSession): Promise<any>;

  static registry = {};

  static register(type: string, constructor) {
    SmtpProcessor.registry[type] = constructor;
  }

  static get(flow: SmtpFlow, config: SmtpComponentConfig): SmtpProcessor {
    return new SmtpProcessor.registry[config.type](flow, config);
  }
}
