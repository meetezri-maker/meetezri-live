import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tools = [
  {
    title: "Box Breathing",
    category: "Breathing",
    description: "4-4-4-4 breathing pattern to reduce stress",
    duration_minutes: 5,
    difficulty: "Beginner",
    icon: "Wind",
    status: "published",
    is_premium: false
  },
  {
    title: "Body Scan Meditation",
    category: "Meditation",
    description: "Progressive relaxation from head to toe",
    duration_minutes: 10,
    difficulty: "Beginner",
    icon: "Brain",
    status: "published",
    is_premium: false
  },
  {
    title: "4-7-8 Breathing",
    category: "Breathing",
    description: "Natural tranquilizer for the nervous system",
    duration_minutes: 3,
    difficulty: "Beginner",
    icon: "Wind",
    status: "published",
    is_premium: false
  },
  {
    title: "Mindfulness Practice",
    category: "Meditation",
    description: "Present moment awareness meditation",
    duration_minutes: 15,
    difficulty: "Intermediate",
    icon: "Brain",
    status: "published",
    is_premium: false
  },
  {
    title: "Rain & Thunder",
    category: "Sounds",
    description: "Calming nature sounds for relaxation",
    duration_minutes: 0, // Infinite
    difficulty: "Any",
    icon: "Music",
    status: "published",
    is_premium: false
  },
  {
    title: "Gratitude Reflection",
    category: "Gratitude",
    description: "Focus on three things you're grateful for",
    duration_minutes: 5,
    difficulty: "Beginner",
    icon: "Smile",
    status: "published",
    is_premium: false
  },
  {
    title: "Morning Meditation",
    category: "Meditation",
    description: "Start your day with positive intentions",
    duration_minutes: 10,
    difficulty: "Beginner",
    icon: "Sun",
    status: "published",
    is_premium: false
  },
  {
    title: "Sleep Meditation",
    category: "Meditation",
    description: "Wind down and prepare for restful sleep",
    duration_minutes: 20,
    difficulty: "Beginner",
    icon: "Moon",
    status: "published",
    is_premium: false
  }
];

async function main() {
  console.log('Seeding wellness tools...');
  for (const tool of tools) {
    const existing = await prisma.wellness_tools.findFirst({
      where: { title: tool.title }
    });

    if (!existing) {
      console.log(`Creating ${tool.title}...`);
      await prisma.wellness_tools.create({
        data: tool
      });
    } else {
      console.log(`Updating ${tool.title}...`);
      await prisma.wellness_tools.update({
        where: { id: existing.id },
        data: tool
      });
    }
  }
  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
