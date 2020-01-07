# `@proc/context-features` easy feature flags.

There are 2 type of flag used for feature flagging.

- Global Flags: These are on or off for the application. All users/entities
  see the same value for the flag.
- User Flags: These are set specifically for each user/entity to allow gradual
  rollout, beta testing, etc...

This package is concerned with User flags, although they can be used to simulate
Global flags, and in some cases that is desireable.

In this package, Flags are configured via the regular env or dotenv. They have the
prefix `FEATURE_` and by convention they are UPPER_SNAKE_CASED. The value in the
config file is a float, between `0` and `1`, that indicates how likely an un-enrolled
entity will be given the enabled flag. A missing key in the environment is defaulted
to a split of `0`, so no user is automatically assigned the value.

```sh
# 50% of users get my awesome thing
FEATURE_MY_AWESOME_THING=0.5
```

To check the value of a feature flag for a user we can call `get`. If the flag has
not been assigned to this user, then it is set during the call based on the configured
split percentage. Once set (either on or off), it will be returned the same for all
subsequent calls.

```ts
const feature = createFeature(storage);
if (await feature.get("MY_AWESOME_THING", userId)) {
  // do something awesome
}
```

This is a simplistic way to assign entities to features. Often you will not want
to assign randomly. In this case you will have some code to produce the values.
In this case, either omit, or explicitly set the split to `0` so no users are
automatically given the flag, and then either at runtime or in an offline task you
should update your entities and set the flag explicitly.

i.e. you want all users that were created before 2010 to have the flag.

```ts
const feature = createFeatureFlags(storage);
const userIds = await fetchUsersCreatedBefore(2010);
await Promise.all(userIds.map(id => feature.set("MY_AWESOME_THING", id, true)));
```

or you can wrap the feature check into a seperate function that incorporates the logic
and initialise it explicitly.

NB: there are 2 caveats to this approach:

1. The function is _only_ run on initialisation of the flag, not every request, so
   do not use it for "psuedo" access-control.
2. This will take precedence over the environment configured values, which can be confusing
   so this package will log a warning if you configure both.

```ts
const feature = createFeatureFlags(storage);
feature.create(
  "MY_AWESOME_FEATURE",
  async (ctx, userId): Promise<boolean> => {
    // look up something about the user.
    return userId === 123;
  }
);
```

Also this is how the "random" spread is implemented, so you could define all
your features in code rather than using configuration files. In many ways this
encourages cleaner practices as you can `export` the feature flag values and keep
them and the logic in a single place.

```ts
import { spread } from "@proc/context-features";

const feature = createFeatureFlags(storage);

// same as using the configuration
feature.create("MY_AWESOME_THING", spread(0.5));
```

Of course your sotrage will probably use `ctx` (`@proc/context`) so you will need
to initialise your features with context, and attach them with an enhancer.
