import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupTestContext, cleanupTestContext } from '../utils/test-setup';
import { createTestUser, createTestFamily } from '../utils/test-helpers';
import { RecipeService } from '../../services/recipe/recipe.service';
import { RecipeCategory, RecipeDifficulty } from '../../types/recipe';
import { prisma } from '../../utils/prisma';

describe('Recipe Management', () => {
  let recipeService: RecipeService;
  let testUser: any;
  let testFamily: any;

  beforeAll(async () => {
    recipeService = new RecipeService();
  });

  beforeEach(async () => {
    // Create test user and family
    testUser = await createTestUser({
      email: `recipe_test_${Date.now()}@test.com`,
      role: 'PARENT',
      firstName: 'Recipe',
      lastName: 'Tester'
    });

    testFamily = await createTestFamily(testUser.id);
  });

  afterAll(async () => {
    await cleanupTestContext();
  });

  it('should create a recipe with ingredients and steps', async () => {
    const recipeData = {
      title: 'Test Recipe',
      description: 'A test recipe',
      category: RecipeCategory.DINNER,
      difficulty: RecipeDifficulty.MEDIUM,
      servings: 4,
      prepTime: 30,
      cookTime: 45,
      ingredients: [
        {
          name: 'Test Ingredient',
          amount: 2,
          unit: 'cups',
          optional: false
        }
      ],
      steps: [
        {
          order: 1,
          description: 'Test step',
          duration: 10
        }
      ],
      familyId: testFamily.id
    };

    const recipe = await recipeService.createRecipe(recipeData);

    expect(recipe).toBeDefined();
    expect(recipe.title).toBe(recipeData.title);
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.steps).toHaveLength(1);
  });

  it('should retrieve a recipe by id', async () => {
    // Create a recipe first
    const recipe = await recipeService.createRecipe({
      title: 'Test Recipe',
      description: 'A test recipe',
      category: RecipeCategory.DINNER,
      difficulty: RecipeDifficulty.EASY,
      servings: 2,
      prepTime: 15,
      cookTime: 30,
      ingredients: [],
      steps: [],
      familyId: testFamily.id
    });

    const retrieved = await recipeService.getRecipe(recipe.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(recipe.id);
  });
});
