import { PrismaClient, Prisma } from '@prisma/client';
import { Difficulty } from '../types';

interface RecipeResult {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  instructions: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: Difficulty;
  usageCount: number;
  userId: string;
  familyId: string;
  ingredients?: {
    id: string;
    itemId: string;
    quantity: number;
    unit: string;
    notes: string | null;
    item: {
      name: string;
    };
  }[];
  ratings?: {
    userId: string;
    nutrition: number | null;
    flavor: number | null;
    difficulty: number | null;
    comment: string | null;
  }[];
  averageRatings?: {
    nutrition: number;
    flavor: number;
    difficulty: number;
  };
}

interface RecipeCountResult {
  count: string | number;
}

export class CustomPrismaClient extends PrismaClient {
  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error']
    });
  }

  async findRecipeById(id: string, includeDetails = true): Promise<RecipeResult | null> {
    const result = await this.$queryRaw<RecipeResult[]>`
      SELECT 
        r.*,
        json_group_array(json_object(
          'id', ri.id,
          'itemId', ri.itemId,
          'quantity', ri.quantity,
          'unit', ri.unit,
          'notes', ri.notes,
          'item', json_object('name', i.name)
        )) as ingredients,
        json_group_array(json_object(
          'userId', rr.userId,
          'nutrition', rr.nutrition,
          'flavor', rr.flavor,
          'difficulty', rr.difficulty,
          'comment', rr.comment
        )) as ratings,
        json_object(
          'nutrition', avg(rr.nutrition),
          'flavor', avg(rr.flavor),
          'difficulty', avg(rr.difficulty)
        ) as averageRatings
      FROM "Recipe" r
      LEFT JOIN "RecipeIngredient" ri ON r.id = ri.recipeId
      LEFT JOIN "Item" i ON ri.itemId = i.id
      LEFT JOIN "RecipeRating" rr ON r.id = rr.recipeId
      WHERE r.id = ${id}
      GROUP BY r.id
      LIMIT 1
    `;

    if (!result[0]) return null;

    const recipe = result[0];
    if (includeDetails) {
      // Parse JSON arrays from SQLite
      recipe.ingredients = JSON.parse(recipe.ingredients as unknown as string)
        .filter((i: any) => i.id !== null);
      recipe.ratings = JSON.parse(recipe.ratings as unknown as string)
        .filter((r: any) => r.userId !== null);
      recipe.averageRatings = JSON.parse(recipe.averageRatings as unknown as string);
    }

    return recipe;
  }

  async findRecipesByUser(userId: string, includeDetails = true): Promise<RecipeResult[]> {
    const result = await this.$queryRaw<RecipeResult[]>`
      SELECT 
        r.*,
        json_group_array(json_object(
          'id', ri.id,
          'itemId', ri.itemId,
          'quantity', ri.quantity,
          'unit', ri.unit,
          'notes', ri.notes,
          'item', json_object('name', i.name)
        )) as ingredients,
        json_group_array(json_object(
          'userId', rr.userId,
          'nutrition', rr.nutrition,
          'flavor', rr.flavor,
          'difficulty', rr.difficulty,
          'comment', rr.comment
        )) as ratings,
        json_object(
          'nutrition', avg(rr.nutrition),
          'flavor', avg(rr.flavor),
          'difficulty', avg(rr.difficulty)
        ) as averageRatings
      FROM "Recipe" r
      LEFT JOIN "RecipeIngredient" ri ON r.id = ri.recipeId
      LEFT JOIN "Item" i ON ri.itemId = i.id
      LEFT JOIN "RecipeRating" rr ON r.id = rr.recipeId
      WHERE r.userId = ${userId}
      GROUP BY r.id
    `;

    if (includeDetails) {
      return result.map(recipe => ({
        ...recipe,
        ingredients: JSON.parse(recipe.ingredients as unknown as string)
          .filter((i: any) => i.id !== null),
        ratings: JSON.parse(recipe.ratings as unknown as string)
          .filter((r: any) => r.userId !== null),
        averageRatings: JSON.parse(recipe.averageRatings as unknown as string)
      }));
    }

    return result;
  }

  async findRecipesByFamily(familyId: string, includeDetails = true): Promise<RecipeResult[]> {
    const result = await this.$queryRaw<RecipeResult[]>`
      SELECT 
        r.*,
        json_group_array(json_object(
          'id', ri.id,
          'itemId', ri.itemId,
          'quantity', ri.quantity,
          'unit', ri.unit,
          'notes', ri.notes,
          'item', json_object('name', i.name)
        )) as ingredients,
        json_group_array(json_object(
          'userId', rr.userId,
          'nutrition', rr.nutrition,
          'flavor', rr.flavor,
          'difficulty', rr.difficulty,
          'comment', rr.comment
        )) as ratings,
        json_object(
          'nutrition', avg(rr.nutrition),
          'flavor', avg(rr.flavor),
          'difficulty', avg(rr.difficulty)
        ) as averageRatings
      FROM "Recipe" r
      LEFT JOIN "RecipeIngredient" ri ON r.id = ri.recipeId
      LEFT JOIN "Item" i ON ri.itemId = i.id
      LEFT JOIN "RecipeRating" rr ON r.id = rr.recipeId
      WHERE r.familyId = ${familyId}
      GROUP BY r.id
    `;

    if (includeDetails) {
      return result.map(recipe => ({
        ...recipe,
        ingredients: JSON.parse(recipe.ingredients as unknown as string)
          .filter((i: any) => i.id !== null),
        ratings: JSON.parse(recipe.ratings as unknown as string)
          .filter((r: any) => r.userId !== null),
        averageRatings: JSON.parse(recipe.averageRatings as unknown as string)
      }));
    }

    return result;
  }

  async createRecipe(data: {
    name: string;
    description?: string;
    instructions: string;
    prepTime: number;
    cookTime: number;
    servings: number;
    difficulty?: Difficulty;
    userId: string;
    familyId: string;
    ingredients: {
      itemId: string;
      quantity: number;
      unit: string;
      notes?: string;
    }[];
  }): Promise<RecipeResult> {
    // Start transaction
    return this.$transaction(async (tx) => {
      // Create recipe
      const recipe = await tx.$queryRaw<RecipeResult[]>`
        INSERT INTO "Recipe" (
          id,
          name,
          description,
          instructions,
          prepTime,
          cookTime,
          servings,
          difficulty,
          usageCount,
          userId,
          familyId,
          createdAt,
          updatedAt
        ) VALUES (
          uuid_generate_v4(),
          ${data.name},
          ${data.description || null},
          ${data.instructions},
          ${data.prepTime},
          ${data.cookTime},
          ${data.servings},
          ${data.difficulty || Difficulty.MEDIUM},
          0,
          ${data.userId},
          ${data.familyId},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      if (!recipe[0]) {
        throw new Error('Failed to create recipe');
      }

      // Create ingredients
      for (const ingredient of data.ingredients) {
        await tx.$queryRaw`
          INSERT INTO "RecipeIngredient" (
            id,
            recipeId,
            itemId,
            quantity,
            unit,
            notes,
            createdAt,
            updatedAt
          ) VALUES (
            uuid_generate_v4(),
            ${recipe[0].id},
            ${ingredient.itemId},
            ${ingredient.quantity},
            ${ingredient.unit},
            ${ingredient.notes || null},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;
      }

      // Return recipe with ingredients
      return this.findRecipeById(recipe[0].id) as Promise<RecipeResult>;
    });
  }

  async updateRecipe(id: string, data: Partial<{
    name: string;
    description: string | null;
    instructions: string;
    prepTime: number;
    cookTime: number;
    servings: number;
    difficulty: Difficulty;
    ingredients: {
      id?: string;
      itemId: string;
      quantity: number;
      unit: string;
      notes?: string;
    }[];
  }>): Promise<RecipeResult> {
    return this.$transaction(async (tx) => {
      // Update recipe
      const setClauses: Prisma.Sql[] = [];
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'ingredients') {
          setClauses.push(Prisma.sql`"${Prisma.raw(key)}" = ${value}`);
        }
      });

      if (setClauses.length > 0) {
        await tx.$queryRaw`
          UPDATE "Recipe"
          SET ${Prisma.join(setClauses, ', ')}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ${id}
        `;
      }

      // Update ingredients if provided
      if (data.ingredients) {
        // Delete existing ingredients
        await tx.$queryRaw`DELETE FROM "RecipeIngredient" WHERE recipeId = ${id}`;

        // Create new ingredients
        for (const ingredient of data.ingredients) {
          await tx.$queryRaw`
            INSERT INTO "RecipeIngredient" (
              id,
              recipeId,
              itemId,
              quantity,
              unit,
              notes,
              createdAt,
              updatedAt
            ) VALUES (
              uuid_generate_v4(),
              ${id},
              ${ingredient.itemId},
              ${ingredient.quantity},
              ${ingredient.unit},
              ${ingredient.notes || null},
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `;
        }
      }

      // Return updated recipe
      const recipe = await this.findRecipeById(id);
      if (!recipe) {
        throw new Error('Failed to update recipe');
      }
      return recipe;
    });
  }

  async deleteRecipe(id: string): Promise<RecipeResult> {
    const recipe = await this.findRecipeById(id, false);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    await this.$queryRaw`DELETE FROM "Recipe" WHERE id = ${id}`;
    return recipe;
  }

  async rateRecipe(recipeId: string, userId: string, data: {
    nutrition?: number;
    flavor?: number;
    difficulty?: number;
    comment?: string;
  }): Promise<void> {
    const existingRating = await this.$queryRaw<any[]>`
      SELECT id FROM "RecipeRating"
      WHERE recipeId = ${recipeId} AND userId = ${userId}
      LIMIT 1
    `;

    if (existingRating.length > 0) {
      // Update existing rating
      const setClauses: Prisma.Sql[] = [];
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          setClauses.push(Prisma.sql`"${Prisma.raw(key)}" = ${value}`);
        }
      });

      await this.$queryRaw`
        UPDATE "RecipeRating"
        SET ${Prisma.join(setClauses, ', ')}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE recipeId = ${recipeId} AND userId = ${userId}
      `;
    } else {
      // Create new rating
      await this.$queryRaw`
        INSERT INTO "RecipeRating" (
          id,
          recipeId,
          userId,
          nutrition,
          flavor,
          difficulty,
          comment,
          createdAt,
          updatedAt
        ) VALUES (
          uuid_generate_v4(),
          ${recipeId},
          ${userId},
          ${data.nutrition || null},
          ${data.flavor || null},
          ${data.difficulty || null},
          ${data.comment || null},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
    }
  }

  async countRecipes(where?: {
    userId?: string;
    familyId?: string;
    difficulty?: Difficulty;
    minRating?: number;
  }): Promise<number> {
    const conditions: Prisma.Sql[] = [];

    if (where?.userId) {
      conditions.push(Prisma.sql`r."userId" = ${where.userId}`);
    }
    if (where?.familyId) {
      conditions.push(Prisma.sql`r."familyId" = ${where.familyId}`);
    }
    if (where?.difficulty) {
      conditions.push(Prisma.sql`r.difficulty = ${where.difficulty}`);
    }
    if (where?.minRating) {
      conditions.push(Prisma.sql`
        (SELECT avg(
          (COALESCE(nutrition, 0) + COALESCE(flavor, 0) + COALESCE(difficulty, 0)) / 3
        ) FROM "RecipeRating" rr WHERE rr.recipeId = r.id) >= ${where.minRating}
      `);
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [result] = await this.$queryRaw<[RecipeCountResult]>`
      SELECT COUNT(*) as count 
      FROM "Recipe" r
      ${whereClause}
    `;

    return Number(result.count);
  }

  async incrementUsageCount(id: string): Promise<void> {
    await this.$queryRaw`
      UPDATE "Recipe"
      SET usageCount = usageCount + 1,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
  }
}

export const prisma = new CustomPrismaClient();
