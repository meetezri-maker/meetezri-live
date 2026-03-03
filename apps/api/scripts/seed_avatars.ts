
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const avatars = [
  {
    name: "Maya Chen",
    gender: "Female",
    age_range: "35-40",
    personality: "Warm, Empathetic, Supportive",
    specialties: ["Anxiety", "Depression", "Stress Management"],
    description: "A compassionate AI companion with a warm presence. Maya specializes in helping with anxiety, stress, and building emotional resilience through mindfulness.",
    image_url: "👩‍💼",
    voice_type: "Warm & Soothing",
    accent_type: "Neutral American",
    rating: 4.9,
    is_active: true
  },
  {
    name: "Alex Rivera",
    gender: "Male",
    age_range: "30-35",
    personality: "Calm, Patient, Understanding",
    specialties: ["PTSD", "Trauma", "Life Transitions"],
    description: "A gentle and patient listener who creates a safe space for healing. Alex focuses on trauma recovery and navigating life's big changes.",
    image_url: "👨‍💼",
    voice_type: "Deep & Calming",
    accent_type: "Neutral American",
    rating: 4.8,
    is_active: true
  },
  {
    name: "Jordan Taylor",
    gender: "Non-binary",
    age_range: "28-32",
    personality: "Energetic, Positive, Supportive",
    specialties: ["Self-Esteem", "Relationships", "Personal Growth"],
    description: "An uplifting companion who helps you discover your strengths. Jordan specializes in building confidence and personal development.",
    image_url: "🧑‍💼",
    voice_type: "Bright & Encouraging",
    accent_type: "Neutral American",
    rating: 4.7,
    is_active: true
  },
  {
    name: "Sarah Mitchell",
    gender: "Female",
    age_range: "45-50",
    personality: "Wise, Grounded, Nurturing",
    specialties: ["Grief", "Family Issues", "Chronic Illness"],
    description: "A wise and nurturing presence with deep empathy. Sarah brings years of life experience in supporting people through challenging times.",
    image_url: "👩‍🦳",
    voice_type: "Gentle & Maternal",
    accent_type: "British",
    rating: 4.9,
    is_active: true
  }
];

async function main() {
  console.log('Seeding AI Avatars...');
  
  // Clear existing avatars? Or upsert?
  // Let's delete all to ensure we don't have duplicates for now, or check by name.
  // Since this is "remove dummy data", let's clear first.
  await prisma.ai_avatars.deleteMany({});
  console.log('Cleared existing avatars.');

  for (const avatar of avatars) {
    await prisma.ai_avatars.create({
      data: avatar
    });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
