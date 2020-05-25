// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/graphql
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {ResolverInterface} from 'type-graphql';
import {
  arg,
  fieldResolver,
  Int,
  mutation,
  query,
  resolver,
  root,
} from '../../../../..';
import {RecipeInput} from '../graphql-types/recipe-input';
import {Recipe} from '../graphql-types/recipe-type';
import {RecipeRepository} from '../repositories';
import {RecipeService} from '../services/recipe.service';

@resolver(of => Recipe)
export class RecipeResolver implements ResolverInterface<Recipe> {
  constructor(
    // constructor injection of service
    @repository('RecipeRepository')
    private readonly recipeRepo: RecipeRepository,
    @service(RecipeService) private readonly recipeService: RecipeService,
  ) {}

  @query(returns => Recipe, {nullable: true})
  async recipe(@arg('recipeId') recipeId: string) {
    return this.recipeRepo.getOne(recipeId);
  }

  @query(returns => [Recipe])
  async recipes(): Promise<Recipe[]> {
    return this.recipeRepo.getAll();
  }

  @mutation(returns => Recipe)
  async addRecipe(@arg('recipe') recipe: RecipeInput): Promise<Recipe> {
    return this.recipeRepo.add(recipe);
  }

  @fieldResolver()
  async numberInCollection(@root() recipe: Recipe): Promise<number> {
    const index = await this.recipeRepo.findIndex(recipe);
    return index + 1;
  }

  @fieldResolver()
  ratingsCount(
    @root() recipe: Recipe,
    @arg('minRate', type => Int, {defaultValue: 0.0})
    minRate: number,
  ): number {
    return this.recipeService.ratingsCount(recipe, minRate);
  }
}
