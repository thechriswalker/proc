# Authentication/Authorization module adapter for `@proc/context`

The Authn module provides a framework for authentication and authorization within
your application.

It provides a middleware for attaching authn information to HTTP requests, or
(de)serializing that information. It also provides a basis for authorization which
includes decision making and reporting of decisions (audit).

Teminology:

There's a bunch of domain specific terms here and I may or may not be using standardised
wording, so I'll define some things.

- **`authn`**: Authentication, proving you are who you say you are
- **`authz`**: Authorization, deciding what you can and cannot do
- **`entity`**: A person, system or thing that can act within the application. The `authn`
  specifies and identifies the authenticated `entity`.
- **`subject`**: this is the authenticated `entity`, i.e. the entity that the authn
  object is referencing. In an authorization decision like "Can `X` do `Y` with `Z`"
  the `subject` is `X`.
- **`owner`**: this is the `entity` which owns this authentication. This is not
  often different to the `subject`, however sometimes we create _delegated_ authentication
  object. That is a _privileged_ entity may be allowed to act as a different entity, for
  example a admin user logged into a regular user's account. We distinguish this case from
  the direct authn as sometimes it is useful to be able to discern the difference, even
  if the decisions are based solely on the `subject` and `scopes`.
- **`scopes`**: which are simply string values that identify the capabilities this authn
  has been granted. They will be application specific and carry little meaning externally.
  They are used to determine the outcome of authorization decisions.

There are 3 types of Authn Entity defined:

- `User` this represents a human user, has an identifier to represent the stored ID for the user.
- `System` this represents a non-human user, i.e. system to system communication, scheduled tasks.
- `Anonymous` this represents a non-authenticated state. It is useful to have this seperately for
  a number of reasons, foremost it means you can make your authn object non-null (simplifying code)
  and also anonymous access is often allowed in many systems and defining it up front makes it easier
  to reason about. This also represents a failed Authn, which is often best handled the same as none, but
  we still want to know if there was _no_ authn attempt versus an _invalid_ authentication attempt.
