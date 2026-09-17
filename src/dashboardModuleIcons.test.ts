import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DASHBOARD_MODULES } from './dashboardModules';
import { DASHBOARD_MODULE_ICONS } from './dashboardModuleIcons';

test('every settings module has an icon that React can render, including the journal', () => {
  assert.deepEqual(Object.keys(DASHBOARD_MODULE_ICONS).sort(), DASHBOARD_MODULES.map(module => module.id).sort());
  for (const module of DASHBOARD_MODULES) {
    const Icon = DASHBOARD_MODULE_ICONS[module.id];
    assert.ok(Icon, `Missing icon for ${module.id}`);
    assert.match(renderToStaticMarkup(createElement(Icon, { size: 16 })), /<svg/);
  }
});
