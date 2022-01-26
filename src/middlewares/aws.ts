import { SmtpMiddleware } from "../server";

export class AWSMiddleware implements SmtpMiddleware {
    config: {
        sqs: string,
        s3: string
    }

    onMailFrom(account) {

    }

    onConnect() {

    }

    onRcptTo() {
        
    }
}