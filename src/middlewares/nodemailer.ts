import { SmtpMiddleware } from "../server";

export class MailerMiddleware implements SmtpMiddleware {
    config: {
        redirect: string
    }

    onMailFrom(account) {

    }

    onConnect() {

    }

    onRcptTo() {
        
    }
}