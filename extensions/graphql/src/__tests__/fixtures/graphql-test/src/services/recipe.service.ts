// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/graphql
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {asService, bind, inject} from '@loopback/core';
import {plainToClass} from 'class-transformer';
import {RecipeInput} from '../graphql-types/recipe-input';
import {Recipe} from '../graphql-types/recipe-type';

@bind(asService(RecipeService))
export class RecipeService {
  private autoIncrementValue: number;

  constructor(@inject('recipes') private readonly items: Recipe[]) {
    this.autoIncrementValue = this.items.length;
  }

  async getAll() {
    return this.items;
  }

  async getOne(id: string) {
    return this.items.find(it => it.id === id);
  }

  async add(data: RecipeInput) {
    const recipe = this.createRecipe(data);
    this.items.push(recipe);
    return recipe;
  }

  async findIndex(recipe: Recipe) {
    return this.items.findIndex(it => it.id === recipe.id);
  }

  private createRecipe(recipeData: Partial<Recipe>): Recipe {
    const recipe = plainToClass(Recipe, recipeData);
    recipe.id = this.getId();
    recipe.creationDate = new Date('2020-05-24');
    recipe.ratings = [2, 4];
    return recipe;
  }

  private getId(): string {
    return (++this.autoIncrementValue).toString();
  }
}
