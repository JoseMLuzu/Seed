import assert from 'node:assert/strict';
import test from 'node:test';
import { composerContent } from './noteComposer';

test('notes preserve multiline text and trim only the outside', () => {
  assert.equal(composerContent('  Idea\n\nDetalles  '), 'Idea\n\nDetalles');
});

test('checklist-only projects have content without requiring a title', () => {
  assert.equal(composerContent('', [{ text: '  Primer paso  ' }, { text: '' }, { text: 'Segundo paso' }]), 'Primer paso\nSegundo paso');
});

test('clearing every visible step never saves stale text from a previous mode', () => {
  assert.equal(composerContent('Texto anterior', [{ text: '  ' }]), '');
  assert.equal(composerContent('Texto anterior', []), '');
});

test('whitespace-only notes cannot enable save', () => {
  assert.equal(composerContent(' \n  '), '');
});
