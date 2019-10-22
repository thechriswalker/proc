const $procError = Symbol("procError");

export enum ErrorVariant {
  NOT_IMPLEMENTED, // not implemented
  INTERNAL, // any non-explicit error
  BAD_REQUEST, // any input error that's not validation (e.g. unsupported media type, bad request)
  USER_INPUT, // validation error (e.g. unprocessable entity)
  CONFLICT, // non-user error, but the thing cannot be done due to business rules.
  NOT_FOUND, // not found,
  UNAUTHENTICATED, // authentication required but not present / invalid (e.g. http unauthorized)
  UNAUTHORIZED // authentication present and valid but insufficient (e.g. http forbidden)
}

class ProcError extends Error {
  public [$procError]: boolean = true;
  constructor(
    msg: string,
    public readonly variant: ErrorVariant,
    public readonly code: number,
    public readonly data: object
  ) {
    super(msg);
    Error.captureStackTrace(this, ProcError);
  }
}

export function isProcError(e: ProcError | any): e is ProcError {
  return e instanceof Error && (e as ProcError)[$procError] ? true : false;
}

export type errorFn = (msg?: string, data?: object) => ProcError;

export function createProcError(
  defaultMessage: string,
  variant: ErrorVariant,
  code: number
): errorFn {
  return (msg: string = defaultMessage, data: object = {}): ProcError => {
    return new ProcError(msg, variant, code, data);
  };
}

export const badRequest = createProcError(
  "Bad Request",
  ErrorVariant.BAD_REQUEST,
  400
);

export const unauthenticated = createProcError(
  "Not Authenticated",
  ErrorVariant.UNAUTHENTICATED,
  401
);
export const requiresAuthentication = unauthenticated;

export const unauthorized = createProcError(
  "Not Authorized",
  ErrorVariant.UNAUTHORIZED,
  403
);
export const forbidden = unauthorized;

export const notFound = createProcError(
  "Not Found",
  ErrorVariant.NOT_FOUND,
  404
);
export const conflict = createProcError("Conflict", ErrorVariant.CONFLICT, 409);

export const badData = createProcError(
  "Unprocessable Entity",
  ErrorVariant.USER_INPUT,
  422
);

export const internalError = createProcError(
  "Internal Server Error",
  ErrorVariant.INTERNAL,
  500
);
export const notImplemented = createProcError(
  "Not Implemented",
  ErrorVariant.NOT_IMPLEMENTED,
  501
);
