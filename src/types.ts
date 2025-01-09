export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: Difficulty;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  familyId: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  itemId: string;
  quantity: number;
  unit: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeRating {
  id: string;
  recipeId: string;
  userId: string;
  nutrition?: number;
  flavor?: number;
  difficulty?: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecipeInput {
  name: string;
  description?: string;
  instructions: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty?: Difficulty;
  ingredients: {
    itemId: string;
    quantity: number;
    unit: string;
    notes?: string;
  }[];
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  instructions?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: Difficulty;
  ingredients?: {
    id?: string; // For updating existing ingredients
    itemId: string;
    quantity: number;
    unit: string;
    notes?: string;
  }[];
}

export interface RateRecipeInput {
  nutrition?: number;
  flavor?: number;
  difficulty?: number;
  comment?: string;
}

export interface RecipeFilters {
  name?: string;
  difficulty?: Difficulty;
  maxPrepTime?: number;
  maxCookTime?: number;
  minRating?: number;
  ingredient?: string;
}

export interface RecipeWithDetails extends Recipe {
  ingredients: (RecipeIngredient & { item: { name: string } })[];
  ratings: RecipeRating[];
  averageRatings?: {
    nutrition: number;
    flavor: number;
    difficulty: number;
  };
}
