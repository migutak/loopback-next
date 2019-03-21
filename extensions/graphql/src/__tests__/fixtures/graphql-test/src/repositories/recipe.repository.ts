// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/graphql
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {DefaultCrudRepository} from '@loopback/repository';
import {Recipe, RecipeRelations} from '../models';
import {ReceipesDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class RecipeRepository extends DefaultCrudRepository<
  Recipe,
  typeof Recipe.prototype.id,
  RecipeRelations
> {
  constructor(@inject('datasources.receipes') dataSource: ReceipesDataSource) {
    super(Recipe, dataSource);
  }
}
