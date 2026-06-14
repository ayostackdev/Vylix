import { SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route as public (no authentication required).
 * Use this on controllers or individual route handlers.
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
