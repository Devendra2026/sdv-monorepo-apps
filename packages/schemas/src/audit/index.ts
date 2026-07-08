import { z } from "zod"

export const auditActorSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.email(),
})

export const auditEntrySchema = z.object({
  _id: z.string(),
  _creationTime: z.number(),

  action: z.string(),
  entity: z.string(),

  entityId: z.string().nullable(),

  metadata: z.unknown(),

  actor: auditActorSchema.nullable(),
})

export type AuditActor = z.infer<typeof auditActorSchema>

export type AuditEntry = z.infer<typeof auditEntrySchema>
