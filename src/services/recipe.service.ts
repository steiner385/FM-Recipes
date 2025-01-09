import { prisma } from '../../../lib/prisma';
import {
  Recipe,
  RecipeWithDetails,
  CreateRecipeInput,
  UpdateRecipeInput,
  RateRecipeInput,
  RecipeFilters,
  RecipeIngredient,
} from '../types';

type RatingStats = {
  nutrition: number | null;
  flavor: number | null;
  difficulty: number | null;
}

type RecipeWithIngredients = Recipe & {
  ingredients: RecipeIngredient[];
  ratings: RatingStats[];
}

export class RecipeService {
  private db: any;

  constructor() {
    this.db = prisma;
  }

  async createRecipe(
    userId: string,
    familyId: string,
    input: CreateRecipeInput
  ): Promise<Recipe> {
    const { ingredients, ...recipeData } = input;

    const created = await this.db.recipe.create({
      data: {
        ...recipeData,
        userId,
        familyId,
      },
    });

    if (ingredients.length > 0) {
      await this.db.recipeIngredient.createMany({
        data: ingredients.map((ingredient) => ({
          recipeId: created.id,
          itemId: ingredient.itemId,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes,
        })),
      });
    }

    const recipe = await this.db.recipe.findUnique({
      where: { id: created.id },
      include: { ingredients: true },
    });

    if (!recipe) throw new Error('Failed to create recipe');
    return recipe;
  }

  async updateRecipe(
    recipeId: string,
    userId: string,
    input: UpdateRecipeInput
  ): Promise<Recipe> {
    const existingRecipe = await this.db.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: true },
    });

    if (!existingRecipe) {
      throw new Error('Recipe not found');
    }

    if (existingRecipe.userId !== userId) {
      throw new Error('Not authorized to update this recipe');
    }

    const { ingredients, ...recipeData } = input;

    if (ingredients) {
      await this.db.recipeIngredient.deleteMany({
        where: { recipeId },
      });

      await this.db.recipeIngredient.createMany({
        data: ingredients.map((ingredient) => ({
          recipeId,
          itemId: ingredient.itemId,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes,
        })),
      });
    }

    const updated = await this.db.recipe.update({
      where: { id: recipeId },
      data: recipeData,
      include: {
        ingredients: true,
      },
    });

    return updated;
  }

  async deleteRecipe(recipeId: string, userId: string): Promise<void> {
    const existingRecipe = await this.db.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!existingRecipe) {
      throw new Error('Recipe not found');
    }

    if (existingRecipe.userId !== userId) {
      throw new Error('Not authorized to delete this recipe');
    }

    await this.db.recipe.delete({
      where: { id: recipeId },
    });
  }

  async getRecipe(recipeId: string): Promise<RecipeWithDetails | null> {
    const recipe = await this.db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          include: {
            item: {
              select: { name: true },
            },
          },
        },
        ratings: true,
      },
    });

    if (!recipe) {
      return null;
    }

    const averageRatings = {
      nutrition: this.calculateAverageRating(recipe.ratings as RatingStats[], 'nutrition'),
      flavor: this.calculateAverageRating(recipe.ratings as RatingStats[], 'flavor'),
      difficulty: this.calculateAverageRating(recipe.ratings as RatingStats[], 'difficulty'),
    };

    return {
      ...recipe,
      averageRatings,
    } as RecipeWithDetails;
  }

  async listRecipes(
    familyId: string,
    filters?: RecipeFilters
  ): Promise<RecipeWithDetails[]> {
    const where = { familyId } as any;

    if (filters?.name) {
      where.name = { contains: filters.name };
    }
    if (filters?.difficulty) {
      where.difficulty = filters.difficulty;
    }
    if (filters?.maxPrepTime) {
      where.prepTime = { lte: filters.maxPrepTime };
    }
    if (filters?.maxCookTime) {
      where.cookTime = { lte: filters.maxCookTime };
    }
    if (filters?.ingredient) {
      where.ingredients = {
        some: {
          item: {
            name: { contains: filters.ingredient },
          },
        },
      };
    }

    const recipes = await this.db.recipe.findMany({
      where,
      include: {
        ingredients: {
          include: {
            item: {
              select: { name: true },
            },
          },
        },
        ratings: true,
      },
    });

    const recipesWithRatings = recipes.map((recipe: RecipeWithIngredients) => {
      const averageRatings = {
        nutrition: this.calculateAverageRating(recipe.ratings, 'nutrition'),
        flavor: this.calculateAverageRating(recipe.ratings, 'flavor'),
        difficulty: this.calculateAverageRating(recipe.ratings, 'difficulty'),
      };
      return {
        ...recipe,
        averageRatings,
      };
    }) as RecipeWithDetails[];

    if (!filters?.minRating) {
      return recipesWithRatings;
    }

    return recipesWithRatings.filter((recipe) => {
      const flavorRating = recipe.averageRatings?.flavor ?? 0;
      return flavorRating >= filters.minRating!;
    });
  }

  async rateRecipe(
    recipeId: string,
    userId: string,
    input: RateRecipeInput
  ): Promise<void> {
    const existingRecipe = await this.db.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!existingRecipe) {
      throw new Error('Recipe not found');
    }

    await this.db.recipeRating.upsert({
      where: {
        recipeId_userId: {
          recipeId,
          userId,
        },
      },
      update: input,
      create: {
        ...input,
        recipeId,
        userId,
      },
    });
  }

  async incrementUsageCount(recipeId: string): Promise<void> {
    await this.db.recipe.update({
      where: { id: recipeId },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  async cloneRecipe(
    originalRecipeId: string,
    userId: string,
    familyId: string
  ): Promise<Recipe> {
    const originalRecipe = await this.db.recipe.findUnique({
      where: { id: originalRecipeId },
      include: {
        ingredients: true,
      },
    });

    if (!originalRecipe) {
      throw new Error('Recipe not found');
    }

    const { 
      id, 
      userId: _userId, 
      familyId: _familyId, 
      createdAt: _createdAt, 
      updatedAt: _updatedAt, 
      usageCount: _usageCount, 
      ingredients: originalIngredients,
      ...recipeData 
    } = originalRecipe as RecipeWithIngredients;

    const clonedRecipe = await this.db.recipe.create({
      data: {
        ...recipeData,
        name: `${recipeData.name} (Copy)`,
        userId,
        familyId,
        usageCount: 0,
        ingredients: {
          create: originalIngredients.map(({ 
            id: _id, 
            recipeId: _recipeId, 
            createdAt: _createdAt, 
            updatedAt: _updatedAt, 
            ...ingredientData 
          }: RecipeIngredient) => ingredientData),
        },
      },
      include: {
        ingredients: true,
      },
    });

    return clonedRecipe;
  }

  private calculateAverageRating(
    ratings: RatingStats[],
    field: keyof RatingStats
  ): number {
    const validRatings = ratings.filter((r) => r[field] != null);
    if (validRatings.length === 0) return 0;
    
    const sum = validRatings.reduce((acc, rating) => acc + (rating[field] || 0), 0);
    return sum / validRatings.length;
  }
}
