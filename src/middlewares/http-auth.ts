import { SmtpMiddleware } from "../server";

export class HttpMiddleware implements SmtpMiddleware {
    config: {
        url: string,
        nethod?: "PUT" | "POST"
        /**
         * If not define the HTTP code is used
         * < 300: Allowed
         * >= 300: Refused
         */
        jsonpath?: string;
    }

    onMailFrom(account) {

    }

    onConnect() {

    }

    onRcptTo() {
        // Send the information for validation
    }
}