# Recipes Plugin

The Recipes plugin provides comprehensive recipe management and meal planning functionality for families, enabling recipe storage, sharing, and integration with shopping lists.

## Features

- Recipe creation and management
- Ingredient tracking
- Recipe categorization
- Meal planning
- Recipe sharing within family
- Shopping list integration
- Nutritional information
- Serving size calculations

## API Endpoints

### Recipes

#### Create Recipe
```http
POST /api/families/:familyId/recipes
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Spaghetti Bolognese",
  "description": "Classic Italian pasta dish",
  "category": "MAIN_COURSE",
  "cuisine": "ITALIAN",
  "servings": 4,
  "prepTime": 15,
  "cookTime": 45,
  "ingredients": [
    {
      "name": "Ground beef",
      "amount": 500,
      "unit": "GRAM",
      "notes": "Lean"
    },
    {
      "name": "Spaghetti",
      "amount": 400,
      "unit": "GRAM"
    }
  ],
  "instructions": [
    "Brown the ground beef",
    "Add tomato sauce",
    "Cook pasta separately"
  ],
  "tags": ["pasta", "beef", "easy"]
}
```

#### Get Recipe
```http
GET /api/families/:familyId/recipes/:recipeId
Authorization: Bearer {token}
```

#### List Family Recipes
```http
GET /api/families/:familyId/recipes
Authorization: Bearer {token}
```

Query Parameters:
- `category`: Filter by recipe category
- `cuisine`: Filter by cuisine type
- `tags`: Filter by tags
- `createdBy`: Filter by creator
- `maxPrepTime`: Filter by maximum prep time
- `maxCookTime`: Filter by maximum cook time
- `sortBy`: Sort field (title, createdAt, prepTime)
- `order`: Sort order (asc, desc)

#### Update Recipe
```http
PUT /api/families/:familyId/recipes/:recipeId
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated Recipe Title",
  "servings": 6,
  "instructions": ["Updated step 1", "Updated step 2"]
}
```

#### Delete Recipe
```http
DELETE /api/families/:familyId/recipes/:recipeId
Authorization: Bearer {token}
```

### Meal Planning

#### Add to Meal Plan
```http
POST /api/families/:familyId/meal-plan
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipeId": "recipe_id",
  "date": "2024-01-20",
  "mealType": "DINNER",
  "servings": 4
}
```

#### Generate Shopping List
```http
POST /api/families/:familyId/recipes/:recipeId/shopping-list
Authorization: Bearer {token}
Content-Type: application/json

{
  "servings": 6,
  "excludeItems": ["salt", "pepper"]
}
```

## Data Models

### Recipe
```typescript
interface Recipe {
  id: string;
  title: string;
  description: string;
  category: RecipeCategory;
  cuisine: CuisineType;
  servings: number;
  prepTime: number;
  cookTime: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  nutritionInfo?: NutritionInfo;
  images?: string[];
  familyId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

enum RecipeCategory {
  APPETIZER = 'APPETIZER',
  MAIN_COURSE = 'MAIN_COURSE',
  SIDE_DISH = 'SIDE_DISH',
  DESSERT = 'DESSERT',
  SNACK = 'SNACK',
  BEVERAGE = 'BEVERAGE'
}

enum CuisineType {
  ITALIAN = 'ITALIAN',
  MEXICAN = 'MEXICAN',
  CHINESE = 'CHINESE',
  INDIAN = 'INDIAN',
  AMERICAN = 'AMERICAN',
  OTHER = 'OTHER'
}
```

### Ingredient
```typescript
interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: IngredientUnit;
  notes?: string;
  recipeId: string;
  optional: boolean;
}

enum IngredientUnit {
  GRAM = 'GRAM',
  KILOGRAM = 'KILOGRAM',
  MILLILITER = 'MILLILITER',
  LITER = 'LITER',
  CUP = 'CUP',
  TABLESPOON = 'TABLESPOON',
  TEASPOON = 'TEASPOON',
  PIECE = 'PIECE'
}
```

### MealPlan
```typescript
interface MealPlan {
  id: string;
  recipeId: string;
  date: Date;
  mealType: MealType;
  servings: number;
  familyId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACK = 'SNACK'
}
```

## Usage Examples

### Managing Recipes
```typescript
import { RecipeService } from './services/recipe.service';

const recipeService = new RecipeService();

// Create a new recipe
const newRecipe = await recipeService.createRecipe({
  title: "Chicken Stir Fry",
  description: "Quick and healthy stir fry",
  category: RecipeCategory.MAIN_COURSE,
  cuisine: CuisineType.CHINESE,
  servings: 4,
  prepTime: 20,
  cookTime: 15,
  ingredients: [
    {
      name: "Chicken breast",
      amount: 500,
      unit: IngredientUnit.GRAM,
      notes: "Diced"
    }
  ],
  instructions: [
    "Prepare ingredients",
    "Cook chicken",
    "Add vegetables"
  ],
  familyId: "family123"
});

// Generate shopping list
const shoppingList = await recipeService.generateShoppingList({
  recipeId: newRecipe.id,
  servings: 6,
  familyId: "family123"
});
```

### Meal Planning
```typescript
// Add recipe to meal plan
await recipeService.addToMealPlan({
  recipeId: "recipe123",
  date: new Date("2024-01-20"),
  mealType: MealType.DINNER,
  servings: 4,
  familyId: "family123"
});
```

## Testing

The Recipes plugin includes comprehensive test coverage:

### Test Files
- `recipe-test-setup.ts`: Test utilities and setup
- `recipe.test.ts`: Recipe CRUD tests
- `meal-plan.test.ts`: Meal planning tests
- `shopping-list.test.ts`: Shopping list generation tests

### Running Tests
```bash
# Run all recipe plugin tests
npm test src/plugins/recipes

# Run specific test file
npm test src/plugins/recipes/__tests__/recipe.test.ts
```

### Test Coverage
The test suite covers:
- Recipe creation and management
- Ingredient handling
- Meal planning operations
- Shopping list generation
- Authorization checks
- Error handling
- Edge cases

## Integration Points

The Recipes plugin integrates with other plugins:

- **Shopping Plugin**: Generate shopping lists from recipes
- **Calendar Plugin**: Meal planning integration
- **Family Core**: Uses family membership for access control

## Error Handling

The plugin includes comprehensive error handling:

```typescript
enum RecipeError {
  RECIPE_NOT_FOUND = 'Recipe not found',
  UNAUTHORIZED = 'User not authorized for this action',
  INVALID_INGREDIENT = 'Invalid ingredient data',
  INVALID_SERVINGS = 'Invalid number of servings',
  FAMILY_REQUIRED = 'Family ID is required',
  DUPLICATE_RECIPE = 'Recipe with this title already exists'
}
```

All API endpoints return appropriate HTTP status codes and error messages.

## Development Guidelines

1. Validate all recipe data
2. Handle ingredient conversions properly
3. Maintain data consistency
4. Add tests for new functionality
5. Document API changes
6. Follow TypeScript best practices
7. Use proper authorization checks
8. Keep controllers and services separate
9. Handle recipe scaling appropriately
