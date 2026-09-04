import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default("Swimly Team"),
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    faqItems: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    canonical: z.string().url().optional(),
    noindex: z.boolean().optional(),
    // Optional region tag for multi-region content. Existing posts omit this
    // and are treated as UK. Additive and backwards-compatible only.
    region: z.enum(["uk", "us", "ca", "au"]).optional(),
  }),
});

export const collections = { blog };
