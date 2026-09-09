import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting TimerMode autoAdvance backfill...');
  
  const timerModes = await prisma.timerMode.findMany();
  let updatedCount = 0;

  for (const mode of timerModes) {
    let changed = false;
    const stages = mode.stagesConfig as any[];

    if (Array.isArray(stages)) {
      for (const stage of stages) {
        if (typeof stage.autoAdvance !== 'boolean') {
          stage.autoAdvance = false;
          changed = true;
        }
      }
    }

    if (changed) {
      await prisma.timerMode.update({
        where: { id: mode.id },
        data: { stagesConfig: stages },
      });
      updatedCount++;
    }
  }

  console.log(`Backfill complete. Updated ${updatedCount} TimerModes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
