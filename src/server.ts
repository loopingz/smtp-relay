import { SMTPServer } from "smtp-server";

export interface SmtpMiddleware {
    onAuth?: (auth, session, callback: (err, result) => void, next: () => void) => void;
    onConnect?: (session, callback: (err, result) => void, next: () => void) => void;
    onMailFrom?: (address, session, callback: (err, result) => void, next: () => void) => void;
    onRcptTo?: (address, session, callback: (err, result) => void, next: () => void) => void;
    onData?: (test, next) => void;
    onClose?: (next) => void;
}

export class SmtpServer {
    server: SMTPServer;
    middlewares: SmtpMiddleware[] = [];

    init() {
        this.server = new SMTPServer({
            onAuth: (...args) => this.middleware("onAuth", undefined, ...args),
            onConnect: (...args) => this.middleware("onConnect", undefined, ...args),
            onMailFrom: (...args) => this.middleware("onMailFrom", undefined, ...args),
            onRcptTo: (...args) => this.middleware("onRcptTo", undefined, ...args),
            onData: (...args) => this.middleware("onData", undefined, ...args),
            onClose: (...args) => this.middleware("onClose", undefined, ...args)
        });

        this.server.listen()
    }

    close() {
        this.server.close();
    }

    /**
     * Loop throught the middleware
     * @param method 
     * @param middlewares 
     * @param args 
     * @returns 
     */
    middleware(method: string,middlewares: SmtpMiddleware[] = [...this.middlewares],  ...args) {
        let mid = middlewares.shift();
        if (!mid) {
            return;
        }
        if (mid[method]) {
            mid[method](...args, () => this.middleware(method, middlewares, ...args));
        } else {
            this.middleware(method, middlewares, ...args)
        }
    }
}