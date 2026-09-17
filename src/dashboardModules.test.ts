import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DASHBOARD_MODULES, readDashboardModules, readDashboardOrder, moveDashboardModule, reorderDashboardModules } from './dashboardModules';

test('new dashboards show every module without sharing the default array', () => {
  const modules = readDashboardModules(null);
  assert.deepEqual(modules, DEFAULT_DASHBOARD_MODULES);
  assert.notEqual(modules, DEFAULT_DASHBOARD_MODULES);
});

test('all modules can stay disabled after saving and reopening', () => {
  assert.deepEqual(readDashboardModules(JSON.stringify([]), '["summary","watering"]'), []);
});

test('saved preferences ignore unknown IDs and duplicates', () => {
  assert.deepEqual(readDashboardModules('["focus","unknown","focus",null,"upcoming"]'), ['focus', 'upcoming']);
});

test('legacy preferences retain optional choices and formerly fixed modules', () => {
  assert.deepEqual(readDashboardModules(null, '["summary","path"]'), ['capture', 'focus', 'upcoming', 'projects', 'activity', 'summary']);
  assert.deepEqual(readDashboardModules(null, '[]'), ['capture', 'focus', 'upcoming', 'projects', 'activity']);
});

test('damaged preferences recover to a usable dashboard', () => {
  assert.deepEqual(readDashboardModules('{broken', '{broken'), DEFAULT_DASHBOARD_MODULES);
  assert.deepEqual(readDashboardModules('{}'), DEFAULT_DASHBOARD_MODULES);
});

test('custom order survives saving and reopening independently of visibility', () => {
  const order = moveDashboardModule([...DEFAULT_DASHBOARD_MODULES], 'upcoming', -1);
  assert.deepEqual(order.slice(0, 3), ['capture', 'upcoming', 'focus']);
  assert.deepEqual(readDashboardOrder(JSON.stringify(order)), order);
  assert.deepEqual(order.filter(id => ['focus', 'upcoming'].includes(id)), ['upcoming', 'focus']);
  assert.deepEqual(readDashboardModules('[]'), []);
});

test('reordering supports both directions without mutating the original', () => {
  const initial = [...DEFAULT_DASHBOARD_MODULES];
  const moved = moveDashboardModule(initial, 'capture', 1);
  assert.deepEqual(moved.slice(0, 2), ['focus', 'capture']);
  assert.deepEqual(initial, DEFAULT_DASHBOARD_MODULES);
  assert.deepEqual(moveDashboardModule(moved, 'capture', -1), initial);
  assert.equal(moveDashboardModule(initial, 'capture', -1), initial);
  assert.equal(moveDashboardModule(initial, 'activity', 1), initial);
  assert.deepEqual(moveDashboardModule(['focus'], 'upcoming', -1), ['focus']);
});

test('partial or damaged orders append missing modules and remove duplicates', () => {
  const order = readDashboardOrder('["activity","unknown",null,"activity","upcoming"]');
  assert.deepEqual(order.slice(0, 2), ['activity', 'upcoming']);
  assert.equal(order.length, DEFAULT_DASHBOARD_MODULES.length);
  assert.equal(new Set(order).size, order.length);
  assert.deepEqual(readDashboardOrder('{broken'), DEFAULT_DASHBOARD_MODULES);
  assert.deepEqual(readDashboardOrder(null), DEFAULT_DASHBOARD_MODULES);
  assert.deepEqual(readDashboardOrder('[]'), DEFAULT_DASHBOARD_MODULES);
});

test('dragging moves across several modules in either direction and persists', () => {
  const initial = [...DEFAULT_DASHBOARD_MODULES];
  const moved = reorderDashboardModules(initial, 'activity', 'capture');
  assert.deepEqual(moved, ['activity', ...initial.slice(0, -1)]);
  assert.deepEqual(readDashboardOrder(JSON.stringify(moved)), moved);
  assert.deepEqual(reorderDashboardModules(moved, 'activity', 'board'), initial);
  assert.deepEqual(initial, DEFAULT_DASHBOARD_MODULES);
});

test('cancelled drags, unchanged targets and invalid IDs do not change order', () => {
  const order = [...DEFAULT_DASHBOARD_MODULES];
  for (const [active, over] of [['capture', null], ['focus', 'focus'], ['unknown', 'focus'], ['focus', 'unknown']] as const) {
    assert.equal(reorderDashboardModules(order, active, over), order);
  }
});
