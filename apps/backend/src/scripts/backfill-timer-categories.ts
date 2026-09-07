import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting TimerCategory backfill...');

  // 1. Backfill default categories for all users
  const users = await prisma.user.findMany({ select: { id: true } });
  let newCategoriesCount = 0;

  for (const user of users) {
    const focusCategory = await prisma.timerCategory.upsert({
      where: { userId_name: { userId: user.id, name: 'Focus' } },
      update: {},
      create: { userId: user.id, name: 'Focus' },
    });
    if (focusCategory) newCategoriesCount++;

    const restCategory = await prisma.timerCategory.upsert({
      where: { userId_name: { userId: user.id, name: 'Rest' } },
      update: {},
      create: { userId: user.id, name: 'Rest' },
    });
    if (restCategory) newCategoriesCount++;
  }

  console.log(`Ensured default categories for ${users.length} users.`);

  // 2. Rewrite legacy TimerMode stagesConfig
  const modes = await prisma.timerMode.findMany({
    include: { user: { include: { timerCategories: true } } },
  });

  let migratedModesCount = 0;

  for (const mode of modes) {
    const categories = mode.user.timerCategories;
    const focusCat = categories.find((c) => c.name.toLowerCase() === 'focus');
    const restCat = categories.find((c) => c.name.toLowerCase() === 'rest');

    if (!focusCat || !restCat) {
      console.warn(`Skipping mode ${mode.id} - missing user categories`);
      continue;
    }

    const stagesConfig = mode.stagesConfig as any[];
    let hasLegacy = false;

    const newConfig = stagesConfig.map((stage: any) => {
      if (stage.type) {
        hasLegacy = true;
        const type = stage.type;
        delete stage.type;
        
        if (type === 'FOCUS') {
          stage.categoryId = focusCat.id;
        } else if (type === 'SHORT_BREAK' || type === 'LONG_BREAK') {
          stage.categoryId = restCat.id;
        } else {
          // Fallback just in case
          stage.categoryId = focusCat.id;
        }
      }
      return stage;
    });

    if (hasLegacy) {
      await prisma.timerMode.update({
        where: { id: mode.id },
        data: { stagesConfig: newConfig },
      });
      migratedModesCount++;
    }
  }

  console.log(`Migrated ${migratedModesCount} legacy TimerModes.`);
  console.log('Backfill complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
