/**
 * Script de test pour vérifier que NSFW.js fonctionne correctement
 */
require('dotenv').config();
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-cpu');
const nsfwjs = require('nsfwjs');
const { createCanvas, loadImage } = require('canvas');

async function testModeration() {
  console.log('🚀 Test de modération NSFW.js\n');

  try {
    // 1. Initialiser TensorFlow backend
    console.log('📦 Initialisation TensorFlow.js backend CPU...');
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('✅ Backend CPU prêt\n');

    // 2. Charger le modèle NSFW.js
    console.log('📦 Chargement du modèle NSFW.js (peut prendre ~30s au premier démarrage)...');
    const model = await nsfwjs.load();
    console.log('✅ Modèle NSFW.js chargé\n');

    // 3. Test avec une image de test (URL publique safe)
    const testImageUrl = 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400';
    console.log(`🖼️  Test avec image: ${testImageUrl}`);

    const img = await loadImage(testImageUrl);
    console.log(`✅ Image chargée: ${img.width}x${img.height}px\n`);

    // Créer canvas à partir de l'image
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // 4. Classification
    console.log('🔍 Classification en cours...');
    const predictions = await model.classify(canvas);

    console.log('📊 Résultats:\n');
    predictions.forEach(pred => {
      const percent = (pred.probability * 100).toFixed(2);
      const bar = '█'.repeat(Math.floor(pred.probability * 50));
      console.log(`  ${pred.className.padEnd(10)} ${percent.padStart(6)}%  ${bar}`);
    });

    // 5. Calcul des scores
    const pornScore = predictions.find(p => p.className === 'Porn')?.probability || 0;
    const hentaiScore = predictions.find(p => p.className === 'Hentai')?.probability || 0;
    const sexyScore = predictions.find(p => p.className === 'Sexy')?.probability || 0;
    const neutralScore = predictions.find(p => p.className === 'Neutral')?.probability || 0;

    const adultScore = (pornScore + hentaiScore) * 100;
    const racyScore = sexyScore * 100;

    console.log('\n📈 Scores calculés:');
    console.log(`  Adult content: ${adultScore.toFixed(1)}%`);
    console.log(`  Racy content:  ${racyScore.toFixed(1)}%`);
    console.log(`  Neutral:       ${(neutralScore * 100).toFixed(1)}%`);

    // 6. Décision de modération
    const ADULT_REJECT_THRESHOLD = 60;
    const ADULT_REVIEW_THRESHOLD = 30;
    const RACY_REVIEW_THRESHOLD = 50;

    let status;
    if (adultScore > ADULT_REJECT_THRESHOLD) {
      status = '❌ REJECTED - Contenu explicite détecté';
    } else if (adultScore > ADULT_REVIEW_THRESHOLD || racyScore > RACY_REVIEW_THRESHOLD) {
      status = '⚠️  NEEDS_REVIEW - Revue manuelle requise';
    } else {
      status = '✅ APPROVED - Contenu approprié';
    }

    console.log(`\n🎯 Décision: ${status}\n`);

    console.log('✅ Test terminé avec succès!\n');
    console.log('💡 Le système de modération est opérationnel.');
    console.log('📝 Vous pouvez maintenant l\'intégrer dans votre API.');

  } catch (error) {
    console.error('❌ Erreur pendant le test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testModeration();
