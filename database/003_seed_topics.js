// ═══════════════════════════════════════════
//  MongoDB — Seed Topics
//  TrendBrief AI — Dynamic Topic Categories
//  Run: mongosh trendbriefai 003_seed_topics.js
// ═══════════════════════════════════════════

db = db.getSiblingDB('trendbriefai');

const now = new Date();

const topics = [
  {
    key: 'ai',
    label: 'AI',
    icon: 'smart_toy',
    color: '#2196F3',
    order: NumberInt(1),
    is_active: true,
    created_at: now,
  },
  {
    key: 'finance',
    label: 'Tài chính',
    icon: 'attach_money',
    color: '#4CAF50',
    order: NumberInt(2),
    is_active: true,
    created_at: now,
  },
  {
    key: 'lifestyle',
    label: 'Đời sống',
    icon: 'self_improvement',
    color: '#FF9800',
    order: NumberInt(3),
    is_active: true,
    created_at: now,
  },
  {
    key: 'drama',
    label: 'Drama',
    icon: 'local_fire_department',
    color: '#F44336',
    order: NumberInt(4),
    is_active: true,
    created_at: now,
  },
  {
    key: 'technology',
    label: 'Công nghệ',
    icon: 'devices',
    color: '#9C27B0',
    order: NumberInt(5),
    is_active: true,
    created_at: now,
  },
  {
    key: 'career',
    label: 'Sự nghiệp',
    icon: 'work',
    color: '#607D8B',
    order: NumberInt(6),
    is_active: true,
    created_at: now,
  },
  {
    key: 'health',
    label: 'Sức khỏe',
    icon: 'favorite',
    color: '#E91E63',
    order: NumberInt(7),
    is_active: true,
    created_at: now,
  },
  {
    key: 'entertainment',
    label: 'Giải trí',
    icon: 'movie',
    color: '#FF5722',
    order: NumberInt(8),
    is_active: true,
    created_at: now,
  },
];

// Clear existing topic data
db.topics.deleteMany({});

// Insert topics
const result = db.topics.insertMany(topics);

// Create indexes
db.topics.createIndex({ key: 1 }, { unique: true });
db.topics.createIndex({ order: 1 });
db.topics.createIndex({ is_active: 1 });

print(`✅ Seeded ${result.insertedIds.length} topics:`);
db.topics.find({}, { key: 1, label: 1, icon: 1, color: 1, order: 1 }).sort({ order: 1 }).forEach(t => {
  print(`   ${t.order}. ${t.key} — ${t.label} (${t.icon}, ${t.color})`);
});
