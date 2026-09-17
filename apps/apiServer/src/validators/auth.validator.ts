import z from "zod";

export const signupSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(6, { error: "Password should be of min 6 chararter" }),
});

export type signupSchemaType = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export type loginSchemaType = z.infer<typeof loginSchema>;
