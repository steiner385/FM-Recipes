import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Recipe Status Enum
export enum RecipeStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  PRIVATE = 'PRIVATE',
  ARCHIVED = 'ARCHIVED'
}

// Recipe Difficulty Enum
export enum RecipeDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

// Configuration Schema
export const RecipesConfigSchema = z.object({
  features: z.object({
    ratings: z.boolean().default(true),
    ingredients: z.boolean().default(true),
    sharing: z.boolean().default(true)
  }),
  roles: z.object({
    canCreateRecipes: z.array(z.string()).default(['PARENT', 'CHILD']),
    canEditAllRecipes: z.array(z.string()).default(['PARENT']),
    canRateRecipes: z.array(z.string()).default(['PARENT', 'CHILD'])
  }),
  limits: z.object({
    maxRecipesPerUser: z.number().min(1).default(50),
    maxIngredientsPerRecipe: z.number().min(1).default(30),
    maxRatingsPerRecipe: z.number().min(1).default(100)
  })
});

// Derived Types
export type RecipesConfig = z.infer<typeof RecipesConfigSchema>;

// Interfaces for Domain Models
export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  status: RecipeStatus;
  difficulty: RecipeDifficulty;
  userId: string;
  familyId: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  recipeId: string;
}

export interface RecipeRating {
  id: string;
  recipeId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

// Type Guards and Utility Functions
export function isValidRecipeStatus(status: unknown): status is RecipeStatus {
  return typeof status === 'string' && 
         Object.values(RecipeStatus).includes(status as RecipeStatus);
}

export function isValidRecipeDifficulty(difficulty: unknown): difficulty is RecipeDifficulty {
  return typeof difficulty === 'string' && 
         Object.values(RecipeDifficulty).includes(difficulty as RecipeDifficulty);
}

export function convertRecipeStatusForPrisma(
  status: unknown
): Prisma.EnumRecipeStatusFilter<"Recipe"> | undefined {
  if (status === undefined || status === null) return undefined;
  
  // Validate and convert the status
  if (!isValidRecipeStatus(status)) {
    throw new Error(`Invalid RecipeStatus: ${String(status)}`);
  }
  
  // Use Prisma's native enum type conversion
  return {
    equals: status
  };
}

// Event Types
export type RecipeEventType = 
  | 'recipe.created'
  | 'recipe.updated'
  | 'recipe.deleted'
  | 'recipe.rated'
  | 'recipe.shared';

// Utility Types
export type Optional<T> = T | null | undefined;
export type Nullable<T> = T | null;