import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { BasePlugin, PluginConfig, PluginContext } from './types/sdk';
import { RecipeController } from './controllers/RecipeController';
import { RecipesConfigSchema, RecipesConfig } from './types';
import { Context } from 'hono';
import { RouteDefinition } from './types/routes';

export class RecipesPlugin extends BasePlugin {
  private recipeController: RecipeController;
  private prisma: PrismaClient;
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
      config: RecipesConfigSchema,
      events: {
        subscriptions: ['family.updated'],
        publications: [
          'recipe.created',
          'recipe.updated',
          'recipe.deleted',
          'recipe.rated',
          'recipe.shared'
        ]
      }
    };

    super(config);
    this.prisma = new PrismaClient();
    this.recipeController = new RecipeController(this.prisma);
  }

  async init(context: PluginContext): Promise<void> {
    try {
      // Validate configuration
      const validatedConfig = RecipesConfigSchema.parse(
        context.config || {}
      ) as RecipesConfig;

      // Register routes
      this.registerRoutes(context, validatedConfig);

      // Initialize metrics
      await this.updateMetrics();

      this.logger.info('Recipes plugin initialized', {
        config: validatedConfig
      });
    } catch (error) {
      this.logger.error('Failed to initialize Recipes plugin', error);
      throw error;
    }
  }

  private registerRoutes(context: PluginContext, config: RecipesConfig): void {
    const routes: RouteDefinition[] = [
      // Recipe routes
      {
        path: '/api/recipes',
        method: 'GET',
        handler: this.recipeController.getRecipes.bind(this.recipeController),
        description: 'Get all recipes'
      },
      {
        path: '/api/recipes',
        method: 'POST',
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
      // Additional routes for recipe management
    ];

    // Add routes to the application
    routes.forEach(route => {
      switch (route.method) {
        case 'GET':
          context.app.get(route.path, route.handler);
          break;
        case 'POST':
          context.app.post(route.path, route.handler);
          break;
        // Add other HTTP methods as needed
      }
    });
  }

  private startMetricsTracking(): void {
    // Start periodic metrics update
    this.metricsInterval = setInterval(
      () => this.updateMetrics(), 
      60000 // Update every minute
    );
  }

  private async updateMetrics(): Promise<void> {
    try {
      const [totalRecipes, activeRecipes, totalRatings, averageRatingResult] = await Promise.all([
        this.prisma.recipe.count(),
        this.prisma.recipe.count({ 
          where: { status: 'PUBLISHED' } 
        }),
        this.prisma.recipeRating.count(),
        this.prisma.recipeRating.aggregate({
          _avg: { rating: true }
        })
      ]);

      this.metrics = {
        totalRecipes,
        activeRecipes,
        totalRatings,
        averageRating: averageRatingResult._avg.rating || 0
      };

      this.logger.info('Recipes metrics updated', this.metrics);
    } catch (error) {
      this.logger.error('Failed to update recipes metrics', error);
    }
  }

  protected async handleEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'family.updated':
        await this.recipeController.handleFamilyUpdate(event.data);
        break;
      default:
        this.logger.warn(`Unhandled event type: ${event.type}`);
    }
  }

  async getHealth(): Promise<any> {
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        timestamp: Date.now(),
        message: 'Recipes plugin is healthy',
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

  async onStart(): Promise<void> {
    this.logger.info('Starting Recipes plugin');
    this.startMetricsTracking();
  }

  async onStop(): Promise<void> {
    this.logger.info('Stopping Recipes plugin');
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    await this.prisma.$disconnect();
  }
}