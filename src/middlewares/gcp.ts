import { SmtpMiddleware } from "../server";

export class GCPMiddleware implements SmtpMiddleware {
    config: {
        storage: string,
        pubsub: string
    }

    onMailFrom(account) {

    }

    onConnect() {

    }

    onRcptTo() {
        
    }
}