import { setupTestContext, type TestContext } from '../../../__tests__/core/utils/test-setup';
import { prisma } from '../../../lib/prisma';
import { Recipe, RecipeIngredient, RecipeRating } from '../types';
import { Difficulty } from '../types';
import { UserRole } from '../../../types/user-role';
import { hashPassword } from '../../../utils/auth';

export interface RecipeTestContext extends TestContext {
  familyId: string;
  userId: string;
  itemId?: string;
}

const db = prisma as any;

export async function setupRecipeTest(): Promise<RecipeTestContext> {
  const baseContext = await setupTestContext() as RecipeTestContext;
  
  // Create test user and family
  const user = await db.user.create({
    data: {
      email: 'testuser@test.com',
      password: await hashPassword('TestPass123!'),
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser_' + Date.now(),
      role: UserRole.PARENT,
    }
  });

  const family = await db.family.create({
    data: {
      name: 'Test Family',
      members: {
        connect: [{ id: user.id }]
      }
    }
  });

  // Update user with familyId
  await db.user.update({
    where: { id: user.id },
    data: { familyId: family.id }
  });

  // Create a test shopping item for ingredients
  const item = await db.shoppingItem.create({
    data: {
      name: 'Test Item',
      userId: user.id,
      familyId: family.id,
    }
  });

  return {
    ...baseContext,
    familyId: family.id,
    userId: user.id,
    itemId: item.id,
  };
}

export async function createTestRecipe(data: {
  userId: string;
  familyId: string;
  name?: string;
  description?: string;
  instructions?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: Difficulty;
}): Promise<Recipe> {
  // First ensure the user exists and belongs to the family
  const user = await db.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    const newUser = await db.user.create({
      data: {
        id: data.userId,
        email: `test${Date.now()}@test.com`,
        password: await hashPassword('TestPass123!'),
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser_' + Date.now(),
        role: UserRole.PARENT,
        familyId: data.familyId,
      }
    });
  }

  return await db.recipe.create({
    data: {
      name: data.name || 'Test Recipe',
      description: data.description || 'Test Description',
      instructions: data.instructions || 'Test Instructions',
      prepTime: data.prepTime || 30,
      cookTime: data.cookTime || 45,
      servings: data.servings || 4,
      difficulty: data.difficulty || 'MEDIUM',
      userId: data.userId,
      familyId: data.familyId,
      usageCount: 0,
    },
  });
}

export async function createTestIngredient(data: {
  recipeId: string;
  itemId: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}): Promise<RecipeIngredient> {
  return await db.recipeIngredient.create({
    data: {
      recipeId: data.recipeId,
      itemId: data.itemId,
      quantity: data.quantity || 1,
      unit: data.unit || 'unit',
      notes: data.notes,
    },
  });
}

export async function createTestRating(data: {
  recipeId: string;
  userId: string;
  nutrition?: number;
  flavor?: number;
  difficulty?: number;
  comment?: string;
}): Promise<RecipeRating> {
  return await db.recipeRating.create({
    data: {
      recipeId: data.recipeId,
      userId: data.userId,
      nutrition: data.nutrition,
      flavor: data.flavor,
      difficulty: data.difficulty,
      comment: data.comment,
    },
  });
}

export async function cleanupRecipeTest(): Promise<void> {
  await prisma.$transaction([
    db.recipeRating.deleteMany(),
    db.recipeIngredient.deleteMany(),
    db.recipe.deleteMany(),
    db.shoppingItem.deleteMany(),
    db.user.deleteMany(),
    db.family.deleteMany()
  ]);
  await prisma.$disconnect();
}
