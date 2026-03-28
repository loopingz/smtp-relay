import { SmtpComponent, SmtpComponentConfig } from "./component";
import { SmtpFlow } from "./flow";
import { SmtpSession } from "./server";

/**
 * Middleware to add behavior to the smtp
 */
export abstract class SmtpProcessor<T extends SmtpComponentConfig = SmtpComponentConfig> extends SmtpComponent<T> {
  abstract onMail(session: SmtpSession): Promise<any>;

  static registry: { [key: string]: new (...args: any[]) => SmtpProcessor } = {};

  static register(type: string, constructor: new (...args: any[]) => SmtpProcessor) {
    SmtpProcessor.registry[type] = constructor;
  }

  static get(flow: SmtpFlow, config: SmtpComponentConfig): SmtpProcessor {
    if (!SmtpProcessor.registry[config.type]) {
      throw new Error(`${config.type} is an unknown filter type`);
    }
    return new SmtpProcessor.registry[config.type](flow, config);
  }
}
