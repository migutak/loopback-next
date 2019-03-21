// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/graphql
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {supertest} from '@loopback/testlab';
import {GraphQLServer} from '../..';
import {RecipeResolver} from '../fixtures/graphql-test/src/graphql-resolvers/recipe-resolver';
import {sampleRecipes} from '../fixtures/graphql-test/src/sample-recipes';
import {RecipeService} from '../fixtures/graphql-test/src/services/recipe.service';
import {runTests} from './graphql-tests';

describe('GraphQL integration', () => {
  let server: GraphQLServer;

  before(givenServer);
  after(stopServer);

  runTests(() => supertest(server.httpServer?.url));

  async function givenServer() {
    server = new GraphQLServer(undefined, {host: '127.0.0.1', port: 0});
    server.resolver(RecipeResolver);
    await server.start();

    server.bind('recipes').to([...sampleRecipes]);
    server.bind('services.RecipeService').toClass(RecipeService);
  }

  async function stopServer() {
    if (!server) return;
    await server.stop();
  }
});
