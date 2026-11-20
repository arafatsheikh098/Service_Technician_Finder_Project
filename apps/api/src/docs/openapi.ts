import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const registry = new OpenAPIRegistry();

export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});
export const secured = [{ [bearerAuth.name]: [] }];

export const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
    requestId: z.string().optional(),
  })
  .meta({ id: 'Error' });

export const json = <T extends z.ZodType>(schema: T, description = 'OK') => ({
  description,
  content: { 'application/json': { schema } },
});
export const errors = {
  400: json(ErrorResponse, 'Validation error'),
  401: json(ErrorResponse, 'Not authenticated'),
  403: json(ErrorResponse, 'Not allowed'),
  404: json(ErrorResponse, 'Not found'),
  409: json(ErrorResponse, 'Conflict'),
};

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'TechFinder API',
      version: '2.0.0',
      description:
        'Geo-aware home-services marketplace. Access tokens are short-lived JWTs; refresh tokens rotate and live in an httpOnly cookie.',
    },
    servers: [{ url: '/api/v1' }],
  });
}
