---
lang: en
title: 'Authentication'
keywords: LoopBack 4.0, LoopBack 4
sidebar: lb4_sidebar
permalink: /doc/en/lb4/Loopback-component-authentication.html
---

## Overview

This document describes the details of the LoopBack 4 `Authentication` component
from the `@loopback/authentication` package.

It begins with the architecture of `@loopback/authentication` from high level.
Then comes with the sub-sections for each artifact provided by the component.
Each section shows:

- **How to use it in the application.** (Code that users need to add when use
  the module.)
- **The mechanism of that artifact.** (Code that explains the mechanism.)

Here is a **high level** overview of the authentication component.

![authentication_overview_highlevel](./imgs/authentication_overview_highlevel.png)

As illustrated in the diagram, this component includes:

- A decorator to express an authentication requirement on controller methods
- A provider to access method-level authentication metadata
- An action in the REST sequence to enforce authentication
- An extension point to discover all authentication strategies and handle the
  delegation

Then let's take a look of the **detailed** overview of the authentication
component.

![authentication_overview_detailed](./imgs/authentication_overview_detailed.png)

Basically, to secure your API endpoints, you need to:

- decorate the endpoints of a controller with the
  `@authenticate(strategyName, options?)` decorator (app developer)
- insert the authentication action in a custom sequence (app developer)
- create a custom authentication strategy with a unique **name** (extension
  developer)
- register the custom authentication strategy (app developer)

The **Authentication Component** takes care of the rest.

## Installation

```sh
npm install --save @loopback/authentication
```

## Mounting Authentication Component

To utilize `authentication` in an application `application.ts`, you must load
the authentication component named `AuthenticationComponent`.

```ts
import {AuthenticationComponent} from '@loopback/authentication';
//...
export class MyApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options?: ApplicationConfig) {
    super(options);

    //...
    // ------ ADD SNIPPET AT THE BOTTOM ---------
    // Mount authentication system
    this.component(AuthenticationComponent);
    // ------------- END OF SNIPPET -------------
    //...
  }
}
```

The `AuthenticationComponent` is defined as follows:

```ts
// ------ CODE THAT EXPLAINS THE MECHANISM ---------
export class AuthenticationComponent implements Component {
  providers?: ProviderMap;

  constructor() {
    this.providers = {
      [AuthenticationBindings.AUTH_ACTION.key]: AuthenticateActionProvider,
      [AuthenticationBindings.STRATEGY.key]: AuthenticationStrategyProvider,
      [AuthenticationBindings.METADATA.key]: AuthMetadataProvider,
    };
  }
}
```

As you can see, there are a few [providers](Creating-components.md#providers)
which make up the bulk of the authentication component.

Essentially

- The binding key `AuthenticationBindings.METADATA.key` is bound to
  `AuthMetadataProvider` which returns authentication decorator metadata of type
  `AuthenticationMetadata`
- The binding key `AuthenticationBindings.AUTH_ACTION.key` is bound to
  `AuthenticateActionProvider` which returns an authenticating function of type
  `AuthenticateFn`
- The binding key `AuthenticationBindings.STRATEGY.key` is bound to
  `AuthenticationStrategyProvider` which resolves and returns an authentication
  strategy of type `AuthenticationStrategy`

The purpose of these providers and the values they return will be explained in
the sections below.

## Concept One - Authentication Decorator

The decorators in LoopBack 4 are no different to the standard decorators in
TypeScript. They add metadata to classes, methods. properties, or parameters.
They don't actually add any functionality, only metadata.

Securing your application's API endpoints is done by decorating **controller**
functions with the
[Authentication Decorator](decorators/Decorators_authenticate.md).

The decorator's syntax is:

```ts
@authenticate(strategyName: string, options?: object)
```

or

```ts
@authenticate(metadata: AuthenticationMetadata)
```

The **strategyName** is the **unique** name of the authentication strategy.

When the **options** object is specified, it must be relevant to that particular
strategy.

Here is an example of the decorator using a custom authentication strategy named
**'basic'** without options, for the endpoint `/whoami` in a controller named
`WhoAmIController`. (We will
[create](#creating-a-custom-authentication-strategy) and
[register](#registering-a-custom-authentication-strategy) the **'basic'**
authentication strategy in later sections)

```ts
import {inject} from '@loopback/context';
import {AuthenticationBindings, authenticate} from '@loopback/authentication';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {get} from '@loopback/rest';

export class WhoAmIController {
  constructor(
    // `AuthenticationBindings.CURRENT_USER` is now an alias of
    // `SecurityBindings.USER` in @loopback/security
    // ------ ADD SNIPPET ---------
    @inject(SecurityBindings.USER)
    private userProfile: UserProfile,
  ) // ------------- END OF SNIPPET -------------
  {}

  // ------ ADD SNIPPET ---------
  @authenticate('basic')
  @get('/whoami')
  whoAmI(): string {
    // `securityId` is Symbol to represent the security id of the user,
    // typically the user id. You can find more information of `securityId` in
    // https://loopback.io/doc/en/lb4/Security
    return this.userProfile[securityId];
  }
  // ------------- END OF SNIPPET -------------
}
```

{% include note.html content="If only <b>some</b> of the controller methods are decorated with the <b>@authenticate</b> decorator, then the injection decorator for SecurityBindings.USER in the controller's constructor must be specified as <b>@inject(SecurityBindings.USER, {optional:true})</b> to avoid a binding error when an unauthenticated endpoint is accessed. Alternatively, do not inject SecurityBindings.USER in the controller <b>constructor</b>, but in the controller <b>methods</b> which are actually decorated with the <b>@authenticate</b> decorator. See [Method Injection](Dependency-injection.md#method-injection), [Constructor Injection](Dependency-injection.md#constructor-injection) and [Optional Dependencies](Dependency-injection.md#optional-dependencies) for details.
" %}

An example of the decorator when options **are** specified looks like this:

```ts
@authenticate('basic', { /* some options for the strategy */})
```

{% include tip.html content="
To avoid repeating the same options in the <b>@authenticate</b> decorator for many endpoints in a controller, you can instead define global options which can be injected into an authentication strategy thereby allowing you to avoid specifying the options object in the decorator itself. For controller endpoints that need to override a global option, you can specify it in an options object passed into the decorator. Your authentication strategy would need to handle the option overrides. See [Managing Custom Authentication Strategy Options](#managing-custom-authentication-strategy-options) for details.
" %}

After a request is successfully authenticated, the current user profile is
available on the request context. You can obtain it via dependency injection by
using the `SecurityBindings.USER` binding key.

Parameters of the `@authenticate` decorator can be obtained via dependency
injection using the `AuthenticationBindings.METADATA` binding key. It returns
data of type `AuthenticationMetadata` provided by `AuthMetadataProvider`. The
`AuthenticationStrategyProvider`, discussed in a later section, makes use of
`AuthenticationMetadata` to figure out what **name** you specified as a
parameter in the `@authenticate` decorator of a specific controller endpoint.

## Concept Two - Authentication Action

### Adding an Authentication Action to a Custom Sequence

In a LoopBack 4 application with REST API endpoints, each request passes through
a stateless grouping of actions called a [Sequence](Sequence.md).

The default sequence which injects and invokes actions `findRoute`,
`parseParams`, `invoke`, `send`, `reject` could be found in the
[Todo example's sequence file](https://github.com/strongloop/loopback-next/blob/master/examples/todo/src/sequence.ts)

To know more details of what each action does, click the code snippet below with
more descriptions.

<details>
<summary>Click to view the details of the default sequence</summary>

```ts
export class DefaultSequence implements SequenceHandler {
  /**
   * Constructor: Injects findRoute, invokeMethod & logError
   * methods as promises.
   *
   * @param {FindRoute} findRoute Finds the appropriate controller method,
   *  spec and args for invocation (injected via SequenceActions.FIND_ROUTE).
   * @param {ParseParams} parseParams The parameter parsing function (injected
   * via SequenceActions.PARSE_PARAMS).
   * @param {InvokeMethod} invoke Invokes the method specified by the route
   * (injected via SequenceActions.INVOKE_METHOD).
   * @param {Send} send The action to merge the invoke result with the response
   * (injected via SequenceActions.SEND)
   * @param {Reject} reject The action to take if the invoke returns a rejected
   * promise result (injected via SequenceActions.REJECT).
   */
  constructor(
    @inject(SequenceActions.FIND_ROUTE) protected findRoute: FindRoute,
    @inject(SequenceActions.PARSE_PARAMS) protected parseParams: ParseParams,
    @inject(SequenceActions.INVOKE_METHOD) protected invoke: InvokeMethod,
    @inject(SequenceActions.SEND) public send: Send,
    @inject(SequenceActions.REJECT) public reject: Reject,
  ) {}

  /**
   * Runs the default sequence. Given a handler context (request and response),
   * running the sequence will produce a response or an error.
   *
   * Default sequence executes these steps
   *  - Finds the appropriate controller method, swagger spec
   *    and args for invocation
   *  - Parses HTTP request to get API argument list
   *  - Invokes the API which is defined in the Application Controller
   *  - Writes the result from API into the HTTP response
   *  - Error is caught and logged using 'logError' if any of the above steps
   *    in the sequence fails with an error.
   *
   * @param context The request context: HTTP request and response objects,
   * per-request IoC container and more.
   */
  async handle(context: RequestContext): Promise<void> {
    try {
      const {request, response} = context;
      const route = this.findRoute(request);
      const args = await this.parseParams(request, route);
      const result = await this.invoke(route, args);

      debug('%s result -', route.describe(), result);
      this.send(response, result);
    } catch (error) {
      this.reject(context, error);
    }
  }
}
```

</details>

By default, authentication is **not** part of the sequence of actions, so you
must create a custom sequence and add the authentication action.

An authentication action `AuthenticateFn` is provided by the
`AuthenticateActionProvider` class.

`AuthenticateActionProvider` is defined as follows:

```ts
// ------ CODE THAT EXPLAINS THE MECHANISM ---------
export class AuthenticateActionProvider implements Provider<AuthenticateFn> {
  constructor(
    // The provider is instantiated for Sequence constructor,
    // at which time we don't have information about the current
    // route yet. This information is needed to determine
    // what auth strategy should be used.
    // To solve this, we are injecting a getter function that will
    // defer resolution of the strategy until authenticate() action
    // is executed.
    @inject.getter(AuthenticationBindings.STRATEGY)
    readonly getStrategy: Getter<AuthenticationStrategy>,
    @inject.setter(SecurityBindings.USER)
    readonly setCurrentUser: Setter<UserProfile>,
  ) {}

  /**
   * @returns authenticateFn
   */
  value(): AuthenticateFn {
    return request => this.action(request);
  }

  /**
   * The implementation of authenticate() sequence action.
   * @param request The incoming request provided by the REST layer
   */
  async action(request: Request): Promise<UserProfile | undefined> {
    const strategy = await this.getStrategy();
    if (!strategy) {
      // The invoked operation does not require authentication.
      return undefined;
    }

    const userProfile = await strategy.authenticate(request);
    if (!userProfile) {
      // important to throw a non-protocol-specific error here
      let error = new Error(
        `User profile not returned from strategy's authenticate function`,
      );
      Object.assign(error, {
        code: USER_PROFILE_NOT_FOUND,
      });
      throw error;
    }

    this.setCurrentUser(userProfile);
    return userProfile;
  }
}
```

`AuthenticateActionProvider`'s `value()` function returns a function of type
`AuthenticateFn`. This function attempts to obtain an authentication strategy
(resolved by `AuthenticationStrategyProvider` via the
`AuthenticationBindings.STRATEGY` binding). If **no** authentication strategy
was specified for this endpoint, the action immediately returns. If an
authentication strategy **was** specified for this endpoint, its
`authenticate(request)` function is called. If a user profile is returned, this
means the user was authenticated successfully, and the user profile is added to
the request context (via the `SecurityBindings.USER` binding); otherwise an
error is thrown.

Here is an example of a custom sequence which utilizes the `authentication`
action.

```ts
export class MyAuthenticatingSequence implements SequenceHandler {
  constructor(
    // ... Other injections
    // ------ ADD SNIPPET ---------
    @inject(AuthenticationBindings.AUTH_ACTION)
    protected authenticateRequest: AuthenticateFn,
  ) // ------------- END OF SNIPPET -------------
  {}

  async handle(context: RequestContext) {
    try {
      const {request, response} = context;
      const route = this.findRoute(request);

      // ------ ADD SNIPPET ---------
      //call authentication action
      await this.authenticateRequest(request);
      // ------------- END OF SNIPPET -------------

      // Authentication successful, proceed to invoke controller
      const args = await this.parseParams(request, route);
      const result = await this.invoke(route, args);
      this.send(response, result);
    } catch (error) {
      // ------ ADD SNIPPET ---------
      if (
        error.code === AUTHENTICATION_STRATEGY_NOT_FOUND ||
        error.code === USER_PROFILE_NOT_FOUND
      ) {
        Object.assign(error, {statusCode: 401 /* Unauthorized */});
      }
      // ------------- END OF SNIPPET -------------

      this.reject(context, error);
      return;
    }
  }
}
```

Notice the new dependency injection in the sequence's constructor.

```ts
@inject(AuthenticationBindings.AUTH_ACTION)
protected authenticateRequest: AuthenticateFn,
```

The binding key `AuthenticationBindings.AUTH_ACTION` gives us access to the
authentication function `authenticateRequest` of type `AuthenticateFn` provided
by `AuthenticateActionProvider`.

Now the authentication function `authenticateRequest` can be called in our
custom sequence anywhere `before` the `invoke` action in order secure the
endpoint.

There are two particular protocol-agnostic errors
`AUTHENTICATION_STRATEGY_NOT_FOUND` and `USER_PROFILE_NOT_FOUND` which must be
addressed in the sequence, and given an HTTP status code of 401 (UnAuthorized).

It is up to the developer to throw the appropriate HTTP error code from within a
custom authentications strategy or its custom services.

If any error is thrown during the authentication process, the controller
function of the endpoint is never executed.

### Binding the Authenticating Sequence to the Application

Now that we've defined a custom sequence that performs an authentication action
on every request, we must bind it to the application `application.ts`

```ts
export class MyApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options?: ApplicationConfig) {
    super(options);

    //...

    // ------ ADD SNIPPET ---------
    this.sequence(MyAuthenticatingSequence);
    // ------------- END OF SNIPPET -------------

    //...
  }
}
```

## Concept Three - Authentication Strategy

`AuthenticationStrategy` is a standard interface that the
`@loopback/authentication` package understands. Hence, any authentication
strategy that adopts this interface can be used with `@loopback/authentication`.
Think of it like the standard interface for
[Passport.js](http://www.passportjs.org/packages/passport-npm/) uses to
interface with many different authentication strategies.

With a **common** authentication strategy interface and an
[**extensionPoint/extensions**](Extension-point-and-extensions.md) pattern used
to **register** and **discover** authentication strategies, users can bind
**multiple strategies** to an application.

The component has a default authentication strategy provider which discovers the
registered strategies by name. It automatically searches with the name given in
an endpoint's `@authenticate()` decorator, then return the corresponding
strategy for the authentication action to proceed.

It's usually **extension developer**'s responsibility to provide an
authentication strategy as provider. To simplify the tutorial, we leverage an
existing strategy from file
[basic authentication strategy](https://github.com/strongloop/loopback-next/blob/master/packages/authentication/src/__tests__/fixtures/strategies/basic-strategy.ts)
to show people how to register (bind) an strategy to the application.

Before registering the `basic` strategy, please make sure the following files
are copied to your application:

- Copy
  [basic authentication strategy](https://github.com/strongloop/loopback-next/blob/master/packages/authentication/src/__tests__/fixtures/strategies/basic-strategy.ts)
  to `src/strategies/basic-strategy.ts`
- Copy
  [user service](https://github.com/strongloop/loopback-next/blob/master/packages/authentication/src/__tests__/fixtures/services/basic-auth-user-service.ts)
  to `src/services/basic-auth-user-service.ts`
  - Copy
    [user model](https://github.com/strongloop/loopback-next/blob/master/packages/authentication/src/__tests__/fixtures/users/user.ts)
    to `src/models/user.ts`
  - Copy
    [user repository](https://github.com/strongloop/loopback-next/blob/master/packages/authentication/src/__tests__/fixtures/users/user.repository.ts)
    to `src/repositories/user.repository.ts`

**Registering** `BasicAuthenticationStrategy` in an application `application.ts`
is as simple as:

```ts
import {registerAuthenticationStrategy} from '@loopback/authentication';

export class MyApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options?: ApplicationConfig) {
    super(options);

    //...
    // ------ ADD SNIPPET ---------
    registerAuthenticationStrategy(this, BasicAuthenticationStrategy);
    // ----- END OF SNIPPET -------
    //...
  }
}
```

## Advanced Topic - Managing Custom Authentication Strategy Options

This is an **optional** step.

If your custom authentication strategy doesn't require special options, you can
skip this section.

As previously mentioned in the
[Using the Authentication Decorator](#using-the-authentication-decorator)
section, a custom authentication strategy should avoid repeatedly specifying its
**default** options in the **@authenticate** decorator. Instead, it should
define its **default** options in one place, and only specify **overriding**
options in the **@authenticate** decorator when necessary.

Here are the steps for accomplishing this.

### Default authentication metadata

In some cases, it's desirable to have a default authentication enforcement for
methods that are not explicitly decorated with `@authenticate`. To do so, we can
simply configure the authentication component with `defaultMetadata` as follows:

```ts
app
  .configure(AuthenticationBindings.COMPONENT)
  .to({defaultMetadata: {strategy: 'xyz'}});
```

### Define the Options Interface and Binding Key

Define an options interface and a binding key for the default options of that
specific authentication strategy.

```ts
export interface AuthenticationStrategyOptions {
  [property: string]: any;
}

export namespace BasicAuthenticationStrategyBindings {
  export const DEFAULT_OPTIONS = BindingKey.create<
    AuthenticationStrategyOptions
  >('authentication.strategies.basic.defaultoptions');
}
```

### Bind the Default Options

Bind the **default** options of the custom authentication strategy to the
application `application.ts` via the
`BasicAuthenticationStrategyBindings.DEFAULT_OPTIONS` binding key.

In this hypothetical example, our custom authentication strategy has a
**default** option of `gatherStatistics` with a value of `true`. (In a real
custom authentication strategy, the number of options could be more numerous)

```ts
export class MyApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options?: ApplicationConfig) {
    super(options);

    //...
    this.bind(BasicAuthenticationStrategyBindings.DEFAULT_OPTIONS).to({
      gatherStatistics: true,
    });
    //...
  }
}
```

### Override Default Options In Authentication Decorator

Specify overriding options in the `@authenticate` decorator only when necessary.

In this example, we only specify an **overriding** option `gatherStatistics`
with a value of `false` for the `/scareme` endpoint. We use the **default**
option value for the `/whoami` endpoint.

```ts
import {inject} from '@loopback/context';
import {AuthenticationBindings, authenticate} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {get} from '@loopback/rest';

export class WhoAmIController {
  constructor(
    @inject(SecurityBindings.USER)
    private userProfile: UserProfile,
  ) {}

  @authenticate('basic')
  @get('/whoami')
  whoAmI(): string {
    return this.userProfile[securityId];
  }

  @authenticate('basic', {gatherStatistics: false})
  @get('/scareme')
  scareMe(): string {
    return 'boo!';
  }
}
```

### Update Custom Authentication Strategy to Handle Options

The custom authentication strategy must be updated to handle the loading of
default options, and overriding them if they have been specified in the
`@authenticate` decorator.

Here is the updated `BasicAuthenticationStrategy`:

```ts
import {
  AuthenticationStrategy,
  TokenService,
  AuthenticationMetadata,
  AuthenticationBindings,
} from '@loopback/authentication';
import {UserProfile} from '@loopback/security';
import {Getter} from '@loopback/core';

export interface Credentials {
  username: string;
  password: string;
}

export class BasicAuthenticationStrategy implements AuthenticationStrategy {
  name: string = 'basic';

  @inject(BasicAuthenticationStrategyBindings.DEFAULT_OPTIONS)
  options: AuthenticationStrategyOptions;

  constructor(
    @inject(UserServiceBindings.USER_SERVICE)
    private userService: UserService,
    @inject.getter(AuthenticationBindings.METADATA)
    readonly getMetaData: Getter<AuthenticationMetadata>,
  ) {}

  async authenticate(request: Request): Promise<UserProfile | undefined> {
    const credentials: Credentials = this.extractCredentials(request);

    await this.processOptions();

    if (this.options.gatherStatistics === true) {
      console.log(`\nGathering statistics...\n`);
    } else {
      console.log(`\nNot gathering statistics...\n`);
    }

    const user = await this.userService.verifyCredentials(credentials);
    const userProfile = this.userService.convertToUserProfile(user);

    return userProfile;
  }

  extractCredentials(request: Request): Credentials {
    let creds: Credentials;

    /**
     * Code to extract the 'basic' user credentials from the Authorization header
     */

    return creds;
  }

  async processOptions() {
    /**
        Obtain the options object specified in the @authenticate decorator
        of a controller method associated with the current request.
        The AuthenticationMetadata interface contains : strategy:string, options?:object
        We want the options property.
    */
    const controllerMethodAuthenticationMetadata = await this.getMetaData();

    if (!this.options) this.options = {}; //if no default options were bound, assign empty options object

    //override default options with request-level options
    this.options = Object.assign(
      {},
      this.options,
      controllerMethodAuthenticationMetadata.options,
    );
  }
}
```

**Inject** default options into a property `options` using the
`BasicAuthenticationStrategyBindings.DEFAULT_OPTIONS` binding key.

**Inject** a `getter` named `getMetaData` that returns `AuthenticationMetadata`
using the `AuthenticationBindings.METADATA` binding key. This metadata contains
the parameters passed into the `@authenticate` decorator.

Create a function named `processOptions()` that obtains the default options, and
overrides them with any request-level overriding options specified in the
`@authenticate` decorator.

Then, in the `authenticate()` function of the custom authentication strategy,
call the `processOptions()` function, and have the custom authentication
strategy react to the updated options.

## Summary

We've gone through the main steps for adding `authentication` to your LoopBack 4
application.

Your `application.ts` should look similar to this:

```ts
import {
  AuthenticationComponent,
  registerAuthenticationStrategy,
} from '@loopback/authentication';

export class MyApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options?: ApplicationConfig) {
    super(options);

    /* set up miscellaneous bindings */

    //...

    // ------ ADD SNIPPET ---------
    // load the authentication component
    this.component(AuthenticationComponent);

    // register your custom authentication strategy
    registerAuthenticationStrategy(this, BasicAuthenticationStrategy);

    // use your custom authenticating sequence
    this.sequence(MyAuthenticatingSequence);
    // ------------- END OF SNIPPET -------------

    this.static('/', path.join(__dirname, '../public'));

    this.projectRoot = __dirname;

    this.bootOptions = {
      controllers: {
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }
```

You can find a **completed example** and **tutorial** of a LoopBack 4
application with JWT authentication
[here](./tutorials/authentication/Authentication-Tutorial.md).
