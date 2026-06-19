// Zod schemas for request validation, plus a route builder.
const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

const createAliasSchema = z.object({
  address: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/, 'Invalid alias format')
    .optional(),
  label: z.string().min(1).max(80).optional(),
  domain: z.string().min(1).max(254).optional(),
});

const updateAliasSchema = z.object({
  label: z.string().min(1).max(80).nullable().optional(),
  isActive: z.boolean().optional(),
});

const listAliasesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().min(1).max(200).optional(),
  active: z.union([z.literal('true'), z.literal('false')]).optional(),
  domain: z.string().min(1).max(254).optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const aliasIdParamSchema = z.object({
  aliasId: z.string().min(1),
});

const emailIdParamSchema = z.object({
  id: z.string().min(1),
});

const listEmailsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  unread: z.union([z.literal('true'), z.literal('false')]).optional(),
  q: z.string().min(1).max(200).optional(),
});

const markReadSchema = z.object({
  isRead: z.boolean(),
});

module.exports = {
  registerSchema,
  loginSchema,
  createAliasSchema,
  updateAliasSchema,
  listAliasesQuerySchema,
  idParamSchema,
  aliasIdParamSchema,
  emailIdParamSchema,
  listEmailsQuerySchema,
  markReadSchema,
};
