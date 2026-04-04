/**
 * One-off: set metadata.rent_entire_unit = true for yacht listings (merge, do not wipe metadata).
 * Usage: from repo root, DATABASE_URL in env (e.g. .env.local): node scripts/merge-yacht-rent-entire-unit.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function mergeMetadata(existing) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  return { ...base, rent_entire_unit: true };
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { category: { slug: 'yachts' } },
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  });

  if (listings.length === 0) {
    console.error('No listings with category slug "yachts". Try another slug in DB.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `Found ${listings.length} yacht listing(s):`,
    listings.map((l) => ({ id: l.id, title: l.title }))
  );

  for (const listing of listings) {
    const before = listing.metadata;
    const merged = mergeMetadata(before);
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { metadata: merged },
    });
    console.log('\nUpdated listing', updated.id, updated.title);
    console.log('metadata before:', JSON.stringify(before));
    console.log('metadata after: ', JSON.stringify(updated.metadata));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
