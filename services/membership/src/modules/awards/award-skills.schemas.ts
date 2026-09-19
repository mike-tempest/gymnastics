import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
const id = z.string().uuid();
const note = z.string().trim().max(4000).nullable().optional();
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Use a valid calendar date');
export const criterionSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    guidance: note,
    sort_order: z.number().int().min(0).max(10000).default(0),
    required: z.boolean().default(true),
    active: z.boolean().default(true),
  })
  .strict();
export const criterionUpdateSchema = criterionSchema
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict();
export const progressionSchema = z.object({ next_level_id: id.nullable() }).strict();
export const skillAssessmentSchema = z
  .object({
    request_key: id,
    level_id: id,
    session_id: id.optional(),
    squad_id: id.optional(),
    assessed_on: day,
    results: z
      .array(
        z
          .object({
            member_id: id,
            criterion_id: id,
            expected_version: z.number().int().min(0),
            criterion_version: z.number().int().positive(),
            status: z.enum(['working_towards', 'achieved']),
            internal_note: note,
            parent_note: note,
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()
  .refine((v) => !(v.session_id && v.squad_id), 'Select a session or squad');
export type SkillAssessmentInput = z.infer<typeof skillAssessmentSchema>;
export function parseAwardInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(result.error.issues.map((i) => i.message).join('; '));
  return result.data;
}
