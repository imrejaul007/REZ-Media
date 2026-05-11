// Local type declaration for jsonwebtoken (avoids @types/jsonwebtoken devDependency)
declare module 'jsonwebtoken' {
  export interface Secret {
    key: string;
    passphrase?: string;
    padding?: number;
  }

  export interface SignOptions {
    algorithm?: string;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    subject?: string;
    issuer?: string;
    jwtid?: string;
    noTimestamp?: boolean;
    header?: Record<string, unknown>;
    keyid?: string;
  }

  export interface VerifyOptions {
    algorithms?: string[];
    audience?: string | string[];
    complete?: boolean;
    issuer?: string | string[];
    jwtid?: string;
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    subject?: string;
    clockTolerance?: number;
    maxAge?: string | number;
    clockTimestamp?: number;
  }

  export interface JwtPayload {
    [key: string]: unknown;
  }

  export function verify(
    token: string,
    secret: string | Secret,
    options?: VerifyOptions
  ): JwtPayload | string;

  export function decode(
    token: string,
    options?: { complete?: boolean; json?: boolean }
  ): null | JwtPayload | string;

  export function sign(
    payload: string | Buffer | object,
    secret: string | Secret,
    options?: SignOptions
  ): string;
}
