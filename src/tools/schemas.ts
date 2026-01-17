import * as z from 'zod/v4';

export const serverInputSchema = z
  .object({
    server: z.string().optional(),
  })
  .strict();

export const filenameInputSchema = z
  .object({
    filename: z.string(),
    server: z.string().optional(),
  })
  .strict();

export const listFilesOutputSchema = z.object({
  result: z.array(z.string()),
});
export const readFileOutputSchema = z.object({
  result: z.string(),
});
export const getAllFilesOutputSchema = z.object({
  result: z.array(
    z.object({
      filename: z.string(),
      content: z.string(),
    }),
  ),
});
export const calculateRamOutputSchema = z.object({
  result: z.number(),
});
export const definitionFileOutputSchema = z.object({
  result: z.string(),
});
export const emptyInputSchema = z.object({}).strict();
