import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { parse } from '../../lib/validate.js';
import { registry, json, errors, secured } from '../../docs/openapi.js';
import {
  SearchQuery,
  TechnicianSummary,
  UpdateTechnicianProfileBody,
  getTechnicianProfile,
  searchTechnicians,
  updateTechnicianProfile,
} from './technicians.service.js';

const IdParams = z.object({ id: z.uuid() });

export function techniciansRouter() {
  const r = Router();

  r.get('/', async (req, res) => {
    res.json(await searchTechnicians(parse(SearchQuery, req.query)));
  });

  // "me" routes must come before "/:id".
  r.get('/me/profile', requireAuth, requireRole('technician'), async (req, res) => {
    res.json(await getTechnicianProfile(currentUser(req).id, { includeUnverified: true }));
  });

  r.patch('/me/profile', requireAuth, requireRole('technician'), async (req, res) => {
    const body = parse(UpdateTechnicianProfileBody, req.body);
    res.json(await updateTechnicianProfile(currentUser(req).id, body));
  });

  r.get('/:id', async (req, res) => {
    const { id } = parse(IdParams, req.params);
    res.json(await getTechnicianProfile(id));
  });

  return r;
}

const tag = ['Technicians'];
const SearchResult = z
  .object({
    items: z.array(TechnicianSummary),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  })
  .meta({ id: 'TechnicianSearchResult' });

registry.registerPath({
  method: 'get',
  path: '/technicians',
  tags: tag,
  summary: 'Find verified technicians near a point, ranked',
  description:
    'Returns technicians within `radiusKm` whose own service radius also covers the customer. ' +
    'If `from`/`to` are given, technicians with an overlapping active booking are excluded. ' +
    '`sort=best` ranks by a Bayesian rating blended with proximity, reliability and experience.',
  request: { query: SearchQuery },
  responses: { 200: json(SearchResult), 400: errors[400] },
});
registry.registerPath({
  method: 'get',
  path: '/technicians/{id}',
  tags: tag,
  summary: 'Public technician profile',
  request: { params: IdParams },
  responses: { 200: { description: 'Profile with recent reviews' }, 404: errors[404] },
});
registry.registerPath({
  method: 'get',
  path: '/technicians/me/profile',
  tags: tag,
  security: secured,
  summary: 'Own technician profile (technicians only)',
  responses: { 200: { description: 'Profile' }, 401: errors[401], 403: errors[403] },
});
registry.registerPath({
  method: 'patch',
  path: '/technicians/me/profile',
  tags: tag,
  security: secured,
  summary: 'Update own profile, location, availability or services',
  request: { body: { content: { 'application/json': { schema: UpdateTechnicianProfileBody } } } },
  responses: { 200: { description: 'Updated profile' }, 400: errors[400], 403: errors[403] },
});
