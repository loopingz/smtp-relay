declare module "mailauth" {
  export function authenticate(input: any, options?: any): Promise<any>;
}

declare module "mailauth/lib/dkim/sign" {
  export function dkimSign(input: any, options?: any): any;
}