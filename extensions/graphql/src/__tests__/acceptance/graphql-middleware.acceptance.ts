// Copyright IBM Corp. 2020. All Rights Reserved.
// Node module: @loopback/graphql
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {createRestAppClient, givenHttpServerConfig} from '@loopback/testlab';
import {GraphqlTestApplication} from '../fixtures/graphql-test/src';
import {runTests} from './graphql-tests';

describe('GraphQL middleware', () => {
  let app: GraphqlTestApplication;

  before(giveAppWithGraphQLMiddleware);
  after(stopApp);

  runTests(() => createRestAppClient(app));

  async function giveAppWithGraphQLMiddleware() {
    app = new GraphqlTestApplication({rest: givenHttpServerConfig()});
    await app.boot();
    await app.start();
    return app;
  }

  async function stopApp() {
    await app?.stop();
  }
});
