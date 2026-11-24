import { Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { isManagementApiKey, requireManagementApiKey } from '../middleware/management-auth.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from './index.js';
import {
  adoptionRequestIdParams,
  adoptionRequestQuery,
  createAdoptionRequest,
  updateAdoptionRequest,
} from '../validation/schemas.js';

const parseId = (req) => adoptionRequestIdParams.parse(req.params).id;
const allowedStatusTransitions = {
  pending: new Set(['pending', 'approved', 'rejected']),
  approved: new Set(['approved']),
  rejected: new Set(['rejected']),
};

const validateStatusTransition = (currentStatus, nextStatus) => {
  if (nextStatus !== undefined && !allowedStatusTransitions[currentStatus]?.has(nextStatus)) {
    throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Adoption request status cannot be changed from its current state');
  }
};

export const createAdoptionRequestRouter = (repository, { managementApiKey } = {}) => {
  const router = Router();
  const managementAuth = requireManagementApiKey(managementApiKey);

  router.get('/', asyncRoute(async (req, res, next) => {
    if (isManagementApiKey(managementApiKey, req.get('x-api-key'))) return next();
    return requireAuth(req, res, next);
  }), asyncRoute(async (req, res) => {
    const filters = adoptionRequestQuery.parse(req.query);
    if (!isManagementApiKey(managementApiKey, req.get('x-api-key'))) filters.userId = req.user.id;
    const result = await repository.list(filters);
    res.json({ adoptionRequests: result.data, pagination: { page: result.page, pageSize: result.pageSize, total: result.total } });
  }));

  router.get('/:id', managementAuth, asyncRoute(async (req, res) => {
    const adoptionRequest = await repository.findById(parseId(req));
    if (!adoptionRequest) throw new AppError(404, 'ADOPTION_REQUEST_NOT_FOUND', 'Adoption request not found');
    res.json({ adoptionRequest });
  }));

  router.post('/', requireAuth, asyncRoute(async (req, res) => {
    const input = createAdoptionRequest.parse(req.body);
    if (!req.user.phone) throw new AppError(400, 'PROFILE_INCOMPLETE', 'Add a phone number to your profile before applying');
    const adoptionRequest = await repository.create({
      petId: input.petId,
      applicantName: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      message: input.message,
      userId: req.user.id,
    });
    res.status(201).json({ adoptionRequest });
  }));

  const update = asyncRoute(async (req, res) => {
    const id = parseId(req);
    const input = updateAdoptionRequest.parse(req.body);
    const current = await repository.findById(id);
    if (!current) throw new AppError(404, 'ADOPTION_REQUEST_NOT_FOUND', 'Adoption request not found');
    validateStatusTransition(current.status, input.status);
    const adoptionRequest = await repository.update(id, input);
    res.json({ adoptionRequest });
  });
  router.patch('/:id', managementAuth, update);
  router.put('/:id', managementAuth, update);

  router.delete('/:id', managementAuth, asyncRoute(async (req, res) => {
    const removed = await repository.remove(parseId(req));
    if (!removed) throw new AppError(404, 'ADOPTION_REQUEST_NOT_FOUND', 'Adoption request not found');
    res.json({ message: 'Adoption request deleted' });
  }));

  return router;
};
