import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { dateKey } from './billing-calculator';

export const calendarDate = z.string().refine((value) => {
  try {
    dateKey(value);
    return true;
  } catch {
    return false;
  }
}, 'Enter a valid calendar date');
const percentage = z.number().int().min(0).max(10000);
export const policySchema = z
  .object({
    proration: z.enum(['full', 'days', 'sessions']),
    discounts: z
      .array(
        z
          .object({
            id: z.string().min(1).max(50),
            name: z.string().min(1).max(100),
            kind: z.enum(['sibling', 'multi_class']),
            percent_bp: percentage.min(1),
            priority: z.number().int().min(0).max(1000),
            group: z.string().min(1).max(50),
            minimum: z.number().int().min(2).max(100),
            fee_ids: z.array(z.string().uuid()).max(100),
          })
          .strict(),
      )
      .max(20),
    stack_groups: z.boolean(),
    pause_credit_bp: percentage,
    cancellation_credit_bp: percentage,
    notice_days: z.number().int().min(0).max(366),
  })
  .strict()
  .refine(
    (policy) => new Set(policy.discounts.map((rule) => rule.id)).size === policy.discounts.length,
    'Discount identifiers must be unique',
  );
export const policyVersionSchema = z
  .object({ effective_date: calendarDate, policy: policySchema })
  .strict();
export const revisionSchema = z
  .object({ effective_date: calendarDate, amount: z.string().regex(/^\d+(\.\d{1,2})?$/) })
  .strict();
export const runSchema = z
  .object({
    family_id: z.string().uuid(),
    period_start: calendarDate,
    period_end: calendarDate,
    due_date: calendarDate,
    frequency: z.enum(['monthly', 'term', 'annual', 'one_time']),
    activity: z
      .array(
        z
          .object({
            member_id: z.string().uuid(),
            active_start: calendarDate,
            active_end: calendarDate,
          })
          .strict(),
      )
      .max(100)
      .default([]),
    sessions: z
      .array(
        z.object({ fee_id: z.string().uuid(), dates: z.array(calendarDate).max(366) }).strict(),
      )
      .max(100)
      .default([]),
  })
  .strict();
export type BillingRunInput = z.infer<typeof runSchema>;
export const creditSchema = z
  .object({
    item_id: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
    source_event: z.string().trim().min(1).max(150),
    kind: z.enum(['manual', 'injury_pause', 'club_cancellation']),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    start_date: calendarDate.optional(),
    end_date: calendarDate.optional(),
    notice_date: calendarDate.optional(),
  })
  .strict();
export type CreditInput = z.infer<typeof creditSchema>;
export const allocationSchema = z
  .object({
    target_invoice_id: z.string().uuid(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    source_event: z.string().min(1).max(150),
  })
  .strict();
export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(result.error.issues.map((issue) => issue.message).join('; '));
  return result.data;
}
