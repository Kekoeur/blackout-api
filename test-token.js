/**
 * Script pour tester et décoder les tokens JWT
 * Usage: node test-token.js <votre-token>
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = process.argv[2];

if (!token) {
  console.log('Usage: node test-token.js <votre-token>');
  console.log('\nExemple:');
  console.log('node test-token.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  process.exit(1);
}

console.log('🔍 Analyse du token JWT\n');
console.log('Token:', token.substring(0, 50) + '...\n');

// Décoder sans vérifier (pour voir le payload)
try {
  const decoded = jwt.decode(token);
  console.log('📦 Payload décodé (sans vérification):');
  console.log(JSON.stringify(decoded, null, 2));
  console.log('');
} catch (error) {
  console.error('❌ Erreur de décodage:', error.message);
  process.exit(1);
}

// Tester avec chaque secret
const secrets = {
  'JWT_SECRET (ancien)': process.env.JWT_SECRET,
  'CLIENT_MOBILE_JWT_SECRET': process.env.CLIENT_MOBILE_JWT_SECRET,
  'ADMIN_DASHBOARD_JWT_SECRET': process.env.ADMIN_DASHBOARD_JWT_SECRET,
  'BAR_DASHBOARD_JWT_SECRET': process.env.BAR_DASHBOARD_JWT_SECRET,
};

console.log('🔐 Test de vérification avec chaque secret:\n');

for (const [name, secret] of Object.entries(secrets)) {
  try {
    const payload = jwt.verify(token, secret);
    console.log(`✅ ${name}: VALIDE`);
    console.log(`   Type: ${payload.type || 'non défini'}`);
    console.log(`   User ID: ${payload.sub}`);
    console.log(`   Email: ${payload.email || 'non défini'}`);
    console.log(`   Expires: ${new Date(payload.exp * 1000).toLocaleString()}`);
    console.log('');
  } catch (error) {
    console.log(`❌ ${name}: INVALIDE (${error.message})`);
  }
}

console.log('💡 Recommandation:');
console.log('Si ton token est valide avec JWT_SECRET (ancien), déconnecte-toi et reconnecte-toi');
console.log('pour obtenir un nouveau token avec CLIENT_MOBILE_JWT_SECRET.');
