# Error objects for the web.

These error object can be used throughout your application and should cover most needs out-of-the-box.

If used consistently, the distinction between _unexpected_ errors (i.e. not `@proc/error`s) and expected/handled errors becomes clear. This allows you to identify problems that need highlighting as bugs and errors that need reporting to the client/user.

We only specific a few "_variants_" which do not cover the HTTP Status Codes, but provide
most that are useful in more than just plain HTTP/RESTful contexts.

```typescript
export enum ErrorVariant {
  NOT_IMPLEMENTED, // not implemented
  INTERNAL, // any non-explicit error
  BAD_REQUEST, // any input error that's not validation (e.g. unsupported media type, bad request)
  USER_INPUT, // validation error (e.g. unprocessable entity)
  CONFLICT, // non-user error, but the thing cannot be done due to business rules.
  NOT_FOUND, // not found,
  UNAUTHENTICATED, // authentication required but not present (e.g. http unauthorized)
  UNAUTHORIZED // authentication present but insufficient (e.g. http forbidden)
}
```

## Usage

```typescript
import { badData, isProcError } from "@proc/error";
// create an error
if (it_is_the_users_fault) {
  throw badData("user did something wrong");
}

// identify errors.
try {
  doSomething();
} catch (e) {
  if (isProcError(e)) {
    // it's a proc error
  } else {
    // an unexpected error!
  }
}
```
