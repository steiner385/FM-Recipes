import { Context } from 'hono';
import { CustomPrismaClient } from '../prisma/client';
import { RecipeError } from '../errors/RecipeError';
import { CreateRecipeInput, UpdateRecipeInput, RateRecipeInput, Difficulty } from '../types';
import { errorResponse, successResponse } from '../utils/response';
import { z } from 'zod';

interface UserContext {
  id: string;
  role: string;
  familyId: string;
}

interface RequestContext extends Context {
  get(key: 'user'): UserContext;
}

const recipeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().min(1),
  prepTime: z.number().min(0),
  cookTime: z.number().min(0),
  servings: z.number().min(1),
  difficulty: z.nativeEnum(Difficulty).optional(),
  ingredients: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().min(0),
    unit: z.string(),
    notes: z.string().optional()
  })).min(1)
});

const ratingSchema = z.object({
  nutrition: z.number().min(0).max(5).optional(),
  flavor: z.number().min(0).max(5).optional(),
  difficulty: z.number().min(0).max(5).optional(),
  comment: z.string().optional()
});

export class RecipeController {
  constructor(private readonly prisma: CustomPrismaClient) {}

  async getRecipes(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const recipes = await this.prisma.findRecipesByUser(user.id);
      return successResponse(c, recipes);
    } catch (error) {
      console.error('Get recipes error:', error);
      return errorResponse(c, error);
    }
  }

  async getRecipeById(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { id } = c.req.param();

      const recipe = await this.prisma.findRecipeById(id);
      if (!recipe) {
        throw new RecipeError({
          code: 'RECIPE_NOT_FOUND',
          message: 'Recipe not found'
        });
      }

      // Verify access
      if (recipe.userId !== user.id && recipe.familyId !== user.familyId) {
        throw new RecipeError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this recipe'
        });
      }

      return successResponse(c, recipe);
    } catch (error) {
      console.error('Get recipe error:', error);
      return errorResponse(c, error);
    }
  }

  async getFamilyRecipes(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { familyId } = c.req.param();

      // Verify family access
      if (familyId !== user.familyId) {
        throw new RecipeError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this family\'s recipes'
        });
      }

      const recipes = await this.prisma.findRecipesByFamily(familyId);
      return successResponse(c, recipes);
    } catch (error) {
      console.error('Get family recipes error:', error);
      return errorResponse(c, error);
    }
  }

  async createRecipe(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const data = await c.req.json() as CreateRecipeInput;

      // Validate recipe data
      const validatedData = recipeSchema.parse(data);

      // Create recipe
      const recipe = await this.prisma.createRecipe({
        ...validatedData,
        userId: user.id,
        familyId: user.familyId
      });

      return successResponse(c, recipe, 201);
    } catch (error) {
      console.error('Create recipe error:', error);
      return errorResponse(c, error);
    }
  }

  async updateRecipe(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const data = await c.req.json() as UpdateRecipeInput;

      // Verify recipe exists and user has access
      const existingRecipe = await this.prisma.findRecipeById(id);
      if (!existingRecipe) {
        throw new RecipeError({
          code: 'RECIPE_NOT_FOUND',
          message: 'Recipe not found'
        });
      }

      if (existingRecipe.userId !== user.id && existingRecipe.familyId !== user.familyId) {
        throw new RecipeError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this recipe'
        });
      }

      // Validate recipe data
      const validatedData = recipeSchema.partial().parse(data);

      // Update recipe
      const updatedRecipe = await this.prisma.updateRecipe(id, validatedData);
      return successResponse(c, updatedRecipe);
    } catch (error) {
      console.error('Update recipe error:', error);
      return errorResponse(c, error);
    }
  }

  async deleteRecipe(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { id } = c.req.param();

      // Verify recipe exists and user has access
      const recipe = await this.prisma.findRecipeById(id);
      if (!recipe) {
        throw new RecipeError({
          code: 'RECIPE_NOT_FOUND',
          message: 'Recipe not found'
        });
      }

      if (recipe.userId !== user.id && recipe.familyId !== user.familyId) {
        throw new RecipeError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this recipe'
        });
      }

      await this.prisma.deleteRecipe(id);
      return successResponse(c, { message: 'Recipe deleted successfully' });
    } catch (error) {
      console.error('Delete recipe error:', error);
      return errorResponse(c, error);
    }
  }

  async rateRecipe(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const data = await c.req.json() as RateRecipeInput;

      // Verify recipe exists and user has access
      const recipe = await this.prisma.findRecipeById(id);
      if (!recipe) {
        throw new RecipeError({
          code: 'RECIPE_NOT_FOUND',
          message: 'Recipe not found'
        });
      }

      if (recipe.familyId !== user.familyId) {
        throw new RecipeError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to rate this recipe'
        });
      }

      // Validate rating data
      const validatedData = ratingSchema.parse(data);

      // Add rating
      await this.prisma.rateRecipe(id, user.id, validatedData);

      // Increment usage count
      await this.prisma.incrementUsageCount(id);

      // Return updated recipe
      const updatedRecipe = await this.prisma.findRecipeById(id);
      return successResponse(c, updatedRecipe);
    } catch (error) {
      console.error('Rate recipe error:', error);
      return errorResponse(c, error);
    }
  }

  async handleFamilyUpdated(data: { familyId: string }): Promise<void> {
    try {
      // Update recipe access based on family membership changes
      // This is a placeholder for any family update logic
      console.log('Family updated:', data);
    } catch (error) {
      console.error('Handle family updated error:', error);
      throw error;
    }
  }
}
