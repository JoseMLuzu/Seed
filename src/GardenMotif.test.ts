import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GardenMotif, type GardenMotifStage } from './GardenMotif';

for (const stage of ['seed', 'sprout', 'bloom'] as GardenMotifStage[]) {
  test(`garden ${stage} detail is renderable, decorative and safe to repeat`, () => {
    const markup = renderToStaticMarkup(createElement(GardenMotif, { stage }));
    assert.match(markup, /<svg/);
    assert.match(markup, new RegExp(`garden-motif-${stage}`));
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /focusable="false"/);
    assert.doesNotMatch(markup, /\bid=|<button|<text|<animate/);
  });
}
