"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { OverlayView } = require("../src/content/highlighter.js");

function fixture(t) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.innerWidth = 1200;
  globalThis.innerHeight = 800;
  t.after(() => {
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
    delete globalThis.document;
  });
  const rect = { left: 20, top: 20, right: 320, bottom: 120, width: 300, height: 100 };
  const element = { getBoundingClientRect: () => rect };
  const view = Object.assign(Object.create(OverlayView.prototype), {
    badge: { hidden: true, dataset: {}, style: {}, getBoundingClientRect: () => ({ width: 28, height: 28 }) },
    host: { dataset: {} },
    shadow: {},
    badgeOffsets: new WeakMap(),
    activeElement: element
  });
  view.resetBadgeDismissal();
  return { view, element };
}

test("resolved badge disappears after one second and stays hidden on rerender", (t) => {
  const { view, element } = fixture(t);
  view.positionBadge(element, 1);
  view.positionBadge(element, 0);
  assert.equal(view.badge.textContent, "✓");
  t.mock.timers.tick(500);
  view.positionBadge(element, 0);
  t.mock.timers.tick(499);
  assert.equal(view.badge.hidden, false);
  t.mock.timers.tick(1);
  assert.equal(view.badge.hidden, true);
  assert.equal(view.host.dataset.squiggleSageBadgeText, "");
  view.positionBadge(element, 0);
  assert.equal(view.badge.hidden, true);
  view.positionBadge(element, 2);
  assert.equal(view.badge.hidden, false);
  assert.equal(view.badge.textContent, "2");
});

test("new issues cancel pending dismissal and the next resolution gets a full second", (t) => {
  const { view, element } = fixture(t);
  view.positionBadge(element, 0);
  t.mock.timers.tick(500);
  view.positionBadge(element, 1);
  t.mock.timers.tick(1000);
  assert.equal(view.badge.hidden, false);
  view.positionBadge(element, 0);
  t.mock.timers.tick(999);
  assert.equal(view.badge.hidden, false);
  t.mock.timers.tick(1);
  assert.equal(view.badge.hidden, true);
});

test("switching editors cancels the previous editor's dismissal", (t) => {
  const { view, element } = fixture(t);
  view.positionBadge(element, 0);
  t.mock.timers.tick(500);
  view.positionBadge({ ...element }, 0);
  t.mock.timers.tick(500);
  assert.equal(view.badge.hidden, false);
  t.mock.timers.tick(500);
  assert.equal(view.badge.hidden, true);
});

test("clearing and destroying the overlay cancel dismissal", (t) => {
  const { view, element } = fixture(t);
  Object.assign(view, { issues: new Map(), layer: { replaceChildren() {} }, hideCard() {}, resetDiagnostics() {} });
  view.positionBadge(element, 0);
  view.clear();
  t.mock.timers.tick(1000);
  assert.equal(view.badgeDismissed, false);
  globalThis.document = { removeEventListener() {} };
  view.host.remove = () => {};
  view.positionBadge(element, 0);
  view.destroy();
  t.mock.timers.tick(1000);
  assert.equal(view.badgeDismissed, false);
});
