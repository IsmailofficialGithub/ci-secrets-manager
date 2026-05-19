import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const upsertSecretSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Key must be a valid env var name"),
  value: z.string().min(1).max(10000),
});

export const createDeployTokenSchema = z.object({
  name: z.string().max(100).trim().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const ciSecretsRequestSchema = z.object({
  projectId: z.string().uuid(),
  token: z.string().min(1),
});

export const deleteProjectSchema = z.object({
  confirmName: z.string().min(1).max(100).trim(),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid(),
});

export const secretIdParamSchema = z.object({
  projectId: z.string().uuid(),
  secretId: z.string().uuid(),
});

export const tokenIdParamSchema = z.object({
  projectId: z.string().uuid(),
  tokenId: z.string().uuid(),
});
