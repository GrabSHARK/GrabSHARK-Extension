import { z } from 'zod';

export const bookmarkFormSchema = z.object({
  url: z.string().url('This has to be a URL'),
  collection: z
    .object({
      id: z.number().optional(),
      ownerId: z.number().optional(),
      name: z.string(),
    })
    .optional(),
  tags: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
      })
    )
    .nullish(),
  name: z.string(),
  description: z.string(),
  type: z.string().optional(),
  image: z.enum(['jpeg', 'png']).optional(),
  preservationConfig: z.object({
    archiveAsScreenshot: z.boolean().optional(),
    archiveAsMonolith: z.boolean().optional(),
    archiveAsPDF: z.boolean().optional(),
    archiveAsReadable: z.boolean().optional(),
    archiveAsWaybackMachine: z.boolean().optional(),
    aiTag: z.boolean().optional(),
  }).optional(),
});

export type bookmarkFormValues = z.infer<typeof bookmarkFormSchema>;
