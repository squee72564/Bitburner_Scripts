import * as z from "zod/v4";

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

export const writeFileInputSchema = z
  .object({
    filename: z.string(),
    content: z.string(),
    server: z.string().optional(),
  })
  .strict();

export const listFilesOutputSchema = z.array(z.string());
export const readFileOutputSchema = z.string();
export const writeFileOutputSchema = z.literal("OK");
export const deleteFileOutputSchema = z.literal("OK");
export const getAllFilesOutputSchema = z.array(
  z.object({
    filename: z.string(),
    content: z.string(),
  })
);
export const calculateRamOutputSchema = z.number();
export const definitionFileOutputSchema = z.string();
export const emptyInputSchema = z.object({}).strict();
