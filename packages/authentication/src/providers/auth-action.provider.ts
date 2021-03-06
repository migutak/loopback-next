// Copyright IBM Corp. 2019,2020. All Rights Reserved.
// Node module: @loopback/authentication
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Getter, inject, Provider, Setter} from '@loopback/core';
import {Request, RedirectRoute} from '@loopback/rest';
import {SecurityBindings, UserProfile} from '@loopback/security';
import {AuthenticationBindings} from '../keys';
import {
  AuthenticateFn,
  AuthenticationStrategy,
  USER_PROFILE_NOT_FOUND,
} from '../types';
/**
 * Provides the authentication action for a sequence
 * @example `context.bind('authentication.actions.authenticate').toProvider(AuthenticateActionProvider)`
 */
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
    @inject.setter(AuthenticationBindings.AUTHENTICATION_REDIRECT_URL)
    readonly setRedirectUrl: Setter<string>,
    @inject.setter(AuthenticationBindings.AUTHENTICATION_REDIRECT_STATUS)
    readonly setRedirectStatus: Setter<number>,
  ) {}

  /**
   * @returns authenticateFn
   */
  value(): AuthenticateFn {
    return request => this.action(request);
  }

  /**
   * The implementation of authenticate() sequence action.
   * @param request - The incoming request provided by the REST layer
   */
  async action(request: Request): Promise<UserProfile | undefined> {
    const strategy = await this.getStrategy();
    if (!strategy) {
      // The invoked operation does not require authentication.
      return undefined;
    }

    const authResponse = await strategy.authenticate(request);
    let userProfile: UserProfile;

    // response from `strategy.authenticate()` could return an object of type UserProfile or RedirectRoute
    if (RedirectRoute.isRedirectRoute(authResponse)) {
      const redirectOptions = authResponse;
      // bind redirection url and status to the context
      // controller should handle actual redirection
      this.setRedirectUrl(redirectOptions.targetLocation);
      this.setRedirectStatus(redirectOptions.statusCode);
    } else if (authResponse) {
      // if `strategy.authenticate()` returns an object of type UserProfile, set it as current user
      userProfile = authResponse as UserProfile;
      this.setCurrentUser(userProfile);
      return userProfile;
    } else if (!authResponse) {
      // important to throw a non-protocol-specific error here
      const error = new Error(
        `User profile not returned from strategy's authenticate function`,
      );
      Object.assign(error, {
        code: USER_PROFILE_NOT_FOUND,
      });
      throw error;
    }
  }
}
