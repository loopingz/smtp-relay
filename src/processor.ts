import { SmtpComponent, SmtpComponentConfig } from "./component";
import { SmtpFlow } from "./flow";
import { SmtpSession } from "./server";

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
    if (!SmtpProcessor.registry[config.type]) {
      throw new Error(`${config.type} is an unknown filter type`);
    }
    return new SmtpProcessor.registry[config.type](flow, config);
  }
}
