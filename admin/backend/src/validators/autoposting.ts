import { z } from 'zod'

// ─── Posts ────────────────────────────────────────────────────────────────────
// Fields from routes/autoposting/posts.ts POST handler
// Note: posts.ts uses multer for file upload — only body fields are validated here

export const CreatePostSchema = z.object({
  caption: z.string().optional(),
  source: z.string().optional().nullable(),
  // channelIds can be a single string id or array of string ids (multipart form)
  channelIds: z.union([
    z.string().min(1, 'channelIds is required'),
    z.array(z.string().min(1)),
  ], { errorMap: () => ({ message: 'channelIds required' }) }),
  status: z.enum(['drafted', 'scheduled', 'published']).optional(),
  scheduledTime: z.string().datetime({ offset: true }).optional().nullable(),
})

export const UpdatePostSchema = z.object({
  caption: z.string().optional(),
  source: z.string().optional().nullable(),
  status: z.enum(['drafted', 'scheduled', 'published']).optional(),
  scheduledTime: z.string().datetime({ offset: true }).optional().nullable(),
})

// ─── Schedules ────────────────────────────────────────────────────────────────
// Fields from routes/autoposting/schedules.ts PUT handler

const ScheduleItemSchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
  slots: z.array(z.string()),
})

export const UpdateSchedulesSchema = z.object({
  schedules: z.array(ScheduleItemSchema).optional(),
})

// ─── AI Caption ───────────────────────────────────────────────────────────────
// Fields from routes/autoposting/ai.ts POST /caption handler

export const GenerateCaptionSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
})

export const TranslateCaptionSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
})
