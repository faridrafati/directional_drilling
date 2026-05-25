/**
 * Zod schemas shared by the API and the web UI.
 * These mirror the Prisma models defined in apps/api/prisma/schema.prisma.
 */
import { z } from "zod";

export const lengthUnitSchema = z.enum(["cm", "m", "km", "ft", "yd", "mi", "nmi"]);
export const angleUnitSchema = z.enum(["deg", "rad"]);
export const dlsUnitSchema = z.enum(["deg/100ft", "deg/30m"]);
export const calculationTypeSchema = z.enum(["WellDesign", "SurveyEditor"]);

export const unitSystemSchema = z.object({
  length: lengthUnitSchema,
  angle: angleUnitSchema,
  dls: dlsUnitSchema,
});

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  units: unitSystemSchema,
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  units: unitSystemSchema.optional(),
});

export const countryCreateSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(200),
  area: z.string().max(200).optional(),
});

export const fieldCreateSchema = z.object({
  countryId: z.string(),
  name: z.string().min(1).max(200),
  ns: z.number().optional(),
  ew: z.number().optional(),
  msl: z.number().optional(),
});

export const wellCreateSchema = z.object({
  fieldId: z.string(),
  name: z.string().min(1).max(200),
  ns: z.number().optional(),
  ew: z.number().optional(),
  msl: z.number().optional(),
  wellType: z.string().optional(),
  tvd: z.number().optional(),
  md: z.number().optional(),
  comment: z.string().optional(),
});

export const calculationCreateSchema = z.object({
  wellId: z.string(),
  name: z.string().min(1).max(200),
  type: calculationTypeSchema,
});

export const segmentSchema = z.object({
  order: z.number().int(),
  profileType: z.number().int(),
  milestoneRole: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  md: z.number(),
  inc: z.number(),
  azm: z.number(),
  tvd: z.number(),
  vsec: z.number(),
  ns: z.number(),
  ew: z.number(),
  dls: z.number(),
  tf: z.number(),
  br: z.number(),
  tr: z.number(),
  dmd: z.number(),
  surveyTools: z.string().nullable().optional(),
});

export const segmentBulkReplaceSchema = z.object({
  segments: z.array(segmentSchema),
});

// Type exports for convenience.
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type CountryCreate = z.infer<typeof countryCreateSchema>;
export type FieldCreate = z.infer<typeof fieldCreateSchema>;
export type WellCreate = z.infer<typeof wellCreateSchema>;
export type CalculationCreate = z.infer<typeof calculationCreateSchema>;
export type SegmentInput = z.infer<typeof segmentSchema>;
