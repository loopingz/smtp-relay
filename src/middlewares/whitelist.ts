import { SmtpMiddleware } from "../server";

export class WhitelistMiddleware implements SmtpMiddleware {
    config: {
        from?: string[],
        to?: string[],
        ips?: string[],
        domains?: string[]
    }
    
    onMailFrom(account) {

    }

    onConnect() {

    }

    onRcptTo() {

    }
}