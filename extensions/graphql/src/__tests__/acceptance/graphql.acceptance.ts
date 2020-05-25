// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/graphql
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {createBindingFromClass} from '@loopback/core';
import {supertest} from '@loopback/testlab';
import {GraphQLServer} from '../..';
import {RecipesDataSource} from '../fixtures/graphql-test/src/datasources';
import {RecipeResolver} from '../fixtures/graphql-test/src/graphql-resolvers/recipe-resolver';
import {RecipeRepository} from '../fixtures/graphql-test/src/repositories';
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

    server.bind('recipes').to([...sampleRecipes]);
    const repoBinding = createBindingFromClass(RecipeRepository);
    server.add(repoBinding);
    server.add(createBindingFromClass(RecipesDataSource));
    server.add(createBindingFromClass(RecipeService));
    await server.start();
    const repo = await server.get<RecipeRepository>(repoBinding.key);
    await repo.start();
  }

  async function stopServer() {
    if (!server) return;
    await server.stop();
  }
});
