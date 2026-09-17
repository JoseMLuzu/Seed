import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GardenerGlossary } from './GardenerGlossary';
import { GARDEN_VOCABULARY, gardenName, gardenStageName, gardenTypeName, type GardenTermId } from './gardenVocabulary';
import { DASHBOARD_MODULES, DEFAULT_DASHBOARD_MODULES, readDashboardModules, readDashboardOrder } from './dashboardModules';

test('every metaphor has names and a functional explanation in both languages', () => {
  for (const [id, term] of Object.entries(GARDEN_VOCABULARY)) {
    for (const language of ['es', 'en'] as const) {
      assert.ok(term[language].name.trim(), id);
      assert.ok(term[language].meaning.trim(), id);
      assert.equal(gardenName(id as GardenTermId, language), term[language].name);
    }
  }
});

test('existing content and stage IDs translate without renaming persisted values', () => {
  assert.equal(gardenTypeName('idea', 'es'), 'Semilla');
  assert.equal(gardenTypeName('idea', 'en'), 'Seed');
  assert.equal(gardenTypeName('project', 'es'), 'Brote');
  assert.equal(gardenTypeName('goal', 'es'), 'Fruto deseado');
  assert.equal(gardenTypeName('learning', 'es'), 'Aprendizaje de la cosecha');
  assert.equal(gardenStageName('seed', 'es'), 'Por germinar');
  assert.equal(gardenStageName('sprout', 'es'), 'En crecimiento');
  assert.equal(gardenStageName('bloom', 'es'), 'Cosechado');
  assert.equal(gardenStageName('withered', 'es'), 'Necesita atención');
});

test('future cultivation vocabulary is explicit and does not introduce dashboard modules', () => {
  const planned = Object.entries(GARDEN_VOCABULARY).filter(([, term]) => 'planned' in term && term.planned).map(([id]) => id);
  assert.deepEqual(planned, ['cultivation', 'recordCare', 'season']);
  assert.deepEqual(DEFAULT_DASHBOARD_MODULES, ['capture', 'focus', 'upcoming', 'summary', 'watering', 'projects', 'learning', 'journal', 'board', 'activity']);
  const preferences = JSON.stringify(['board', 'focus', 'capture']);
  assert.deepEqual(readDashboardModules(preferences), ['board', 'focus', 'capture']);
  assert.deepEqual(readDashboardOrder(preferences).slice(0, 3), ['board', 'focus', 'capture']);
  assert.equal(DASHBOARD_MODULES.find(module => module.id === 'focus')?.title, 'Mi labor de hoy');
  assert.equal(DASHBOARD_MODULES.find(module => module.id === 'board')?.title, 'La mesa del jardinero');
});

for (const language of ['es', 'en'] as const) {
  test(`glossary renders all metaphors and only three future badges in ${language}`, () => {
    const markup = renderToStaticMarkup(createElement(GardenerGlossary, { language }));
    assert.match(markup, /<details/);
    assert.match(markup, /<summary/);
    assert.equal((markup.match(/<dt>/g) || []).length, Object.keys(GARDEN_VOCABULARY).length);
    assert.equal((markup.match(language === 'es' ? /<span>Por venir<\/span>/g : /<span>Coming later<\/span>/g) || []).length, 3);
    assert.ok(markup.includes(gardenName('harvestReady', language)));
    assert.ok(markup.includes(language === 'es' ? 'Regar no es completar' : 'Watering is not completion'));
    assert.doesNotMatch(markup, /<button|<input/);
  });
}
