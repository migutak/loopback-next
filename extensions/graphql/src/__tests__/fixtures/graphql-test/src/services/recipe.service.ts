// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/graphql
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {asService, bind} from '@loopback/core';
import {Recipe} from '../graphql-types/recipe-type';

@bind(asService(RecipeService))
export class RecipeService {
  ratingsCount(recipe: Recipe, minRate: number): number {
    return recipe.ratings.filter(rating => rating >= minRate).length;
  }
}
