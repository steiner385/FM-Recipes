import { BasePlugin } from '../../sdk/core/BasePlugin';
import { PluginConfig, PluginHealthCheck } from '../../sdk/core/types';
import { Event } from '../../sdk/events/types';
import { z } from 'zod';
import { prisma } from './prisma/client';
import { RecipeController } from './controllers/RecipeController';
import { Context } from 'hono';
import { RouteDefinition } from '../../sdk/core/routes';
import { Difficulty } from './types';

/**
 * Plugin configuration schema
 */
const configSchema = z.object({
  features: z.object({
    ratings: z.boolean().default(true),
    ingredients: z.boolean().default(true),
    sharing: z.boolean().default(true)
  }),
  roles: z.object({
    canCreateRecipes: z.array(z.string()).default(['PARENT', 'CHILD']),
    canDeleteRecipes: z.array(z.string()).default(['PARENT']),
    canRateRecipes: z.array(z.string()).default(['PARENT', 'CHILD'])
  }),
  limits: z.object({
    maxRecipesPerUser: z.number().min(1).default(100),
    maxIngredientsPerRecipe: z.number().min(1).default(50)
  })
});

type RecipePluginConfig = z.infer<typeof configSchema>;

/**
 * Recipe plugin implementation
 */
export class RecipePlugin extends BasePlugin {
  private recipeController: RecipeController;
  private metricsInterval?: NodeJS.Timeout;
  private metrics = {
    totalRecipes: 0,
    activeRecipes: 0,
    totalRatings: 0,
    averageRating: 0
  };

  constructor() {
    const config: PluginConfig = {
      metadata: {
        name: 'recipes-plugin',
        version: '1.0.0',
        description: 'Recipe management plugin',
        author: 'FamilyManager',
        license: 'MIT'
      },
      config: configSchema,
      events: {
        subscriptions: ['family.updated'],
        publications: [
          'recipe.created',
          'recipe.updated',
          'recipe.deleted',
          'recipe.rated'
        ]
      }
    };

    super(config);

    // Initialize controller
    this.recipeController = new RecipeController(prisma);

    // Add routes
    this.config.routes = this.getRoutes();
  }

  /**
   * Initialize plugin
   */
  async onInit(): Promise<void> {
    this.logger.info('Initializing recipes plugin');
    await this.updateMetrics();
  }

  /**
   * Start plugin
   */
  async onStart(): Promise<void> {
    this.logger.info('Starting recipes plugin');
    this.metricsInterval = setInterval(() => this.updateMetrics(), 60000);
  }

  /**
   * Stop plugin
   */
  async onStop(): Promise<void> {
    this.logger.info('Stopping recipes plugin');
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }

  /**
   * Handle events
   */
  protected async handleEvent(event: Event): Promise<void> {
    switch (event.type) {
      case 'family.updated':
        await this.recipeController.handleFamilyUpdated(event.data);
        break;
    }
  }

  /**
   * Define plugin routes
   */
  private getRoutes(): RouteDefinition[] {
    const config = this.context.config as RecipePluginConfig;
    const routes: RouteDefinition[] = [
      {
        path: '/api/recipes',
        method: 'GET' as const,
        handler: this.recipeController.getRecipes.bind(this.recipeController),
        description: 'Get all recipes'
      },
      {
        path: '/api/recipes',
        method: 'POST' as const,
        handler: async (c: Context) => {
          const user = c.get('user');
          if (!config.roles.canCreateRecipes.includes(user.role)) {
            return c.json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'User not authorized to create recipes'
              }
            }, 403);
          }
          return this.recipeController.createRecipe(c);
        },
        description: 'Create a new recipe'
      },
      {
        path: '/api/recipes/:id',
        method: 'GET' as const,
        handler: this.recipeController.getRecipeById.bind(this.recipeController),
        description: 'Get a recipe by ID'
      },
      {
        path: '/api/recipes/:id',
        method: 'PUT' as const,
        handler: this.recipeController.updateRecipe.bind(this.recipeController),
        description: 'Update a recipe'
      },
      {
        path: '/api/recipes/:id',
        method: 'DELETE' as const,
        handler: async (c: Context) => {
          const user = c.get('user');
          if (!config.roles.canDeleteRecipes.includes(user.role)) {
            return c.json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'User not authorized to delete recipes'
              }
            }, 403);
          }
          return this.recipeController.deleteRecipe(c);
        },
        description: 'Delete a recipe'
      },
      {
        path: '/api/recipes/family/:familyId',
        method: 'GET' as const,
        handler: this.recipeController.getFamilyRecipes.bind(this.recipeController),
        description: 'Get recipes by family ID'
      }
    ];

    // Add rating route if enabled
    if (config.features.ratings) {
      routes.push({
        path: '/api/recipes/:id/rate',
        method: 'POST' as const,
        handler: async (c: Context) => {
          const user = c.get('user');
          if (!config.roles.canRateRecipes.includes(user.role)) {
            return c.json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'User not authorized to rate recipes'
              }
            }, 403);
          }
          return this.recipeController.rateRecipe(c);
        },
        description: 'Rate a recipe'
      });
    }

    return routes;
  }

  /**
   * Update metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      const [total, rated] = await Promise.all([
        prisma.countRecipes(),
        prisma.countRecipes({ minRating: 1 })
      ]);

      // Get average rating across all recipes
      const [result] = await prisma.$queryRaw<[{ avg: number }]>`
        SELECT avg((nutrition + flavor + difficulty) / 3) as avg
        FROM "RecipeRating"
        WHERE nutrition IS NOT NULL 
          OR flavor IS NOT NULL 
          OR difficulty IS NOT NULL
      `;

      this.metrics = {
        totalRecipes: total,
        activeRecipes: rated,
        totalRatings: rated,
        averageRating: Number(result?.avg || 0)
      };
    } catch (error) {
      this.logger.error('Error updating metrics', error as Error);
    }
  }

  /**
   * Get plugin health status
   */
  async getHealth(): Promise<PluginHealthCheck> {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        timestamp: Date.now(),
        message: 'Plugin is healthy',
        metrics: this.metrics
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error,
        message: 'Database connection failed'
      };
    }
  }
}
