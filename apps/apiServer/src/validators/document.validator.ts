import z from "zod";

export const createDocumentSchema = z.object({
  name: z.string(),
});

export type createDocumentSchemaType = z.infer<typeof createDocumentSchema>;
