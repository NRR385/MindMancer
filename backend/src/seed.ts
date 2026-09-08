import { connectDatabase, disconnectDatabase } from './config/database';
import { Character } from './models/Character.model';
import { Feature } from './models/Feature.model';

export const SEED_FEATURES = [
  {
    key: 'is_human',
    question: 'Is your character biologically human?',
    category: 'biology',
  },
  {
    key: 'can_fly',
    question: 'Can your character fly unaided or with built-in equipment?',
    category: 'abilities',
  },
  {
    key: 'wears_cape',
    question: 'Does your character frequently wear a cape or cloaked robes?',
    category: 'appearance',
  },
  {
    key: 'has_superpowers',
    question: 'Does your character possess supernatural or superhuman powers?',
    category: 'abilities',
  },
  {
    key: 'uses_technology',
    question: 'Does your character rely primarily on high-tech gadgets or armored suits?',
    category: 'equipment',
  },
  {
    key: 'is_hero',
    question: 'Is your character fundamentally aligned with heroism and saving others?',
    category: 'morality',
  },
  {
    key: 'wears_mask',
    question: 'Does your character wear a mask or helmet concealing their facial identity?',
    category: 'appearance',
  },
  {
    key: 'uses_magic',
    question: 'Does your character cast spells or practice formal wizardry/sorcery?',
    category: 'abilities',
  },
  {
    key: 'is_alien',
    question: 'Was your character born outside of planet Earth?',
    category: 'origin',
  },
  {
    key: 'uses_lightsaber',
    question: 'Does your character wield a lightsaber or plasma blade in combat?',
    category: 'equipment',
  },
  {
    key: 'has_secret_identity',
    question: 'Does your character actively maintain a civilian secret identity?',
    category: 'lifestyle',
  },
  {
    key: 'fights_crime',
    question: 'Does your character patrol and fight street-level urban crime?',
    category: 'lifestyle',
  },
  {
    key: 'transforms',
    question: 'Does your character transform into an entirely different physical form?',
    category: 'abilities',
  },
  {
    key: 'is_wealthy',
    question: 'Is your character known for having immense personal financial wealth?',
    category: 'background',
  },
  {
    key: 'uses_martial_arts',
    question: 'Is your character a master practitioner of hand-to-hand martial arts?',
    category: 'abilities',
  },
  {
    key: 'wields_sword',
    question: 'Does your character regularly fight with a traditional blade or sword?',
    category: 'equipment',
  },
];

export const SEED_CHARACTERS = [
  {
    name: 'Batman',
    traits: {
      is_human: true,
      can_fly: false,
      wears_cape: true,
      has_superpowers: false,
      uses_technology: true,
      is_hero: true,
      wears_mask: true,
      uses_magic: false,
      is_alien: false,
      uses_lightsaber: false,
      has_secret_identity: true,
      fights_crime: true,
      transforms: false,
      is_wealthy: true,
      uses_martial_arts: true,
      wields_sword: false,
    },
  },
  {
    name: 'Superman',
    traits: {
      is_human: false,
      can_fly: true,
      wears_cape: true,
      has_superpowers: true,
      uses_technology: false,
      is_hero: true,
      wears_mask: false,
      uses_magic: false,
      is_alien: true,
      has_secret_identity: true,
      fights_crime: true,
      transforms: false,
      is_wealthy: false,
    },
    // Note: uses_martial_arts, wields_sword are deliberately UNKNOWN (omitted)
  },
  {
    name: 'Spider-Man',
    traits: {
      is_human: true,
      can_fly: false,
      wears_cape: false,
      has_superpowers: true,
      uses_technology: true,
      is_hero: true,
      wears_mask: true,
      uses_magic: false,
      is_alien: false,
      has_secret_identity: true,
      fights_crime: true,
      transforms: false,
      is_wealthy: false,
      uses_martial_arts: false,
      wields_sword: false,
    },
  },
  {
    name: 'Iron Man',
    traits: {
      is_human: true,
      can_fly: true,
      wears_cape: false,
      has_superpowers: false,
      uses_technology: true,
      is_hero: true,
      wears_mask: true,
      uses_magic: false,
      is_alien: false,
      has_secret_identity: false,
      fights_crime: true,
      transforms: false,
      is_wealthy: true,
    },
  },
  {
    name: 'Wonder Woman',
    traits: {
      is_human: false,
      can_fly: true,
      wears_cape: false,
      has_superpowers: true,
      uses_technology: false,
      is_hero: true,
      wears_mask: false,
      is_alien: false,
      has_secret_identity: true,
      uses_martial_arts: true,
      wields_sword: true,
    },
    // Note: uses_magic, is_wealthy are deliberately UNKNOWN (omitted)
  },
  {
    name: 'Harry Potter',
    traits: {
      is_human: true,
      can_fly: true,
      wears_cape: true,
      has_superpowers: true,
      uses_technology: false,
      is_hero: true,
      wears_mask: false,
      uses_magic: true,
      is_alien: false,
      uses_lightsaber: false,
      has_secret_identity: false,
      fights_crime: false,
      transforms: false,
      uses_martial_arts: false,
      wields_sword: false,
    },
  },
  {
    name: 'Yoda',
    traits: {
      is_human: false,
      can_fly: false,
      wears_cape: true,
      has_superpowers: true,
      uses_technology: false,
      is_hero: true,
      wears_mask: false,
      uses_magic: false,
      is_alien: true,
      uses_lightsaber: true,
      has_secret_identity: false,
      fights_crime: false,
      transforms: false,
      uses_martial_arts: false,
    },
    // Note: is_wealthy, wields_sword deliberately UNKNOWN
  },
  {
    name: 'Darth Vader',
    traits: {
      is_human: true,
      can_fly: false,
      wears_cape: true,
      has_superpowers: true,
      uses_technology: true,
      is_hero: false,
      wears_mask: true,
      uses_magic: false,
      is_alien: false,
      uses_lightsaber: true,
      has_secret_identity: false,
      fights_crime: false,
      transforms: false,
      wields_sword: true,
    },
  },
  {
    name: 'Hulk',
    traits: {
      is_human: true,
      can_fly: false,
      wears_cape: false,
      has_superpowers: true,
      uses_technology: false,
      is_hero: true,
      wears_mask: false,
      uses_magic: false,
      is_alien: false,
      has_secret_identity: false,
      transforms: true,
      uses_martial_arts: false,
      wields_sword: false,
    },
  },
  {
    name: 'Goku',
    traits: {
      is_human: false,
      can_fly: true,
      wears_cape: false,
      has_superpowers: true,
      uses_technology: false,
      is_hero: true,
      wears_mask: false,
      uses_magic: false,
      is_alien: true,
      has_secret_identity: false,
      fights_crime: false,
      transforms: true,
      uses_martial_arts: true,
      wields_sword: false,
    },
  },
  {
    name: 'Sherlock Holmes',
    traits: {
      is_human: true,
      can_fly: false,
      wears_cape: true,
      has_superpowers: false,
      uses_technology: false,
      is_hero: true,
      wears_mask: false,
      uses_magic: false,
      is_alien: false,
      has_secret_identity: false,
      fights_crime: true,
      transforms: false,
      uses_martial_arts: true,
      wields_sword: false,
    },
  },
  {
    name: 'Pikachu',
    traits: {
      is_human: false,
      can_fly: false,
      wears_cape: false,
      has_superpowers: true,
      uses_technology: false,
      is_hero: true,
      wears_mask: false,
      uses_magic: false,
      is_alien: false,
      uses_lightsaber: false,
      has_secret_identity: false,
      fights_crime: false,
      transforms: false,
    },
    // Note: uses_martial_arts, is_wealthy omitted
  },
];

export async function seedDatabase(): Promise<{ featuresCount: number; charactersCount: number }> {
  console.log('[Seed] Starting knowledge base seed process...');

  // Upsert Features
  for (const feat of SEED_FEATURES) {
    await Feature.updateOne(
      { key: feat.key },
      {
        $set: {
          key: feat.key,
          question: feat.question,
          category: feat.category,
        },
      },
      { upsert: true }
    );
  }
  const featuresCount = await Feature.countDocuments();
  console.log(`[Seed] Features collection populated (${featuresCount} total).`);

  // Upsert Characters
  for (const char of SEED_CHARACTERS) {
    await Character.updateOne(
      { name: char.name },
      {
        $set: {
          name: char.name,
          traits: char.traits,
        },
      },
      { upsert: true }
    );
  }
  const charactersCount = await Character.countDocuments();
  console.log(`[Seed] Characters collection populated (${charactersCount} total).`);

  console.log('[Seed] Knowledge base seeding completed successfully.');
  return { featuresCount, charactersCount };
}

// Allow direct execution: `npx tsx src/seed.ts`
if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      await seedDatabase();
      await disconnectDatabase();
      process.exit(0);
    } catch (error) {
      console.error('[Seed] Seeding failed:', error);
      process.exit(1);
    }
  })();
}
