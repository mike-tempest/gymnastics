import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string(),
    tags: z.array(z.string()),
    image: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    faqItems: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      )
      .optional(),
    canonical: z.string().url().optional(),
    noindex: z.boolean().optional(),
    // Optional region tag for multi-region content. Existing posts omit this
    // and are treated as UK. Additive and backwards-compatible only.
    region: z.enum(['uk', 'us', 'ca', 'au']).optional(),
  }),
});

export const collections = {
  blog: blogCollection,
};
