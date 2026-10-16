import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { rfcSchema, journeySchema, glossarySchema } from './lib/schemas';

// Unpadded filenames: content/rfcs/903.json → id "903".
const stem = ({ entry }: { entry: string }) => entry.replace(/\.json$/, '');

const rfcs = defineCollection({
  loader: glob({ pattern: '*.json', base: './content/rfcs', generateId: stem }),
  schema: rfcSchema,
});
const journeys = defineCollection({
  loader: glob({ pattern: '*.json', base: './content/journeys', generateId: stem }),
  schema: journeySchema,
});
const glossary = defineCollection({
  loader: glob({ pattern: '*.json', base: './content/glossary', generateId: stem }),
  schema: glossarySchema,
});

export const collections = { rfcs, journeys, glossary };
