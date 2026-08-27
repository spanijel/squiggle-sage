(function installHighlighter(global) {
  "use strict";

  const TEXT_INPUT_TYPES = new Set(["text"]);
  const BLOCK_ELEMENTS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD",
    "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3",
    "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P",
    "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"
  ]);
  const ATOMIC_ELEMENTS = new Set([
    "AUDIO", "BUTTON", "CANVAS", "EMBED", "HR", "IFRAME", "IMG", "INPUT",
    "MATH", "OBJECT", "SELECT", "SVG", "TEXTAREA", "VIDEO", "WBR"
  ]);
  const MIRROR_PROPERTIES = [
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopWidth",
    "boxSizing",
    "direction",
    "fontFamily",
    "fontFeatureSettings",
    "fontKerning",
    "fontSize",
    "fontStretch",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "overflowWrap",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "tabSize",
    "textAlign",
    "textIndent",
    "textTransform",
    "whiteSpace",
    "wordBreak",
    "wordSpacing"
  ];

  function elementTag(element) {
    return typeof element?.localName === "string" ? element.localName.toLowerCase() : "";
  }

  function isTextControl(element) {
    const tag = elementTag(element);
    if (tag === "textarea") {
      return true;
    }
    return tag === "input" && TEXT_INPUT_TYPES.has(String(element.type || "").toLowerCase());
  }

  function childIndex(node) {
    return node.parentNode ? Array.prototype.indexOf.call(node.parentNode.childNodes, node) : 0;
  }

  function buildEditableTextModel(root) {
    const pieces = [];
    const segments = [];
    let length = 0;

    function appendText(node) {
      if (!node.data) {
        return;
      }
      const start = length;
      pieces.push(node.data);
      length += node.data.length;
      segments.push({ type: "text", node, start, end: length });
    }

    function appendBreak(startPosition, endPosition, source, force = false) {
      if (!force && pieces.length && pieces.at(-1).endsWith("\n")) {
        return;
      }
      const start = length;
      pieces.push("\n");
      length += 1;
      segments.push({ type: "break", start, end: length, startPosition, endPosition, source });
    }

    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        appendText(node);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const contentEditableValue = String(node.getAttribute("contenteditable") || "").toLowerCase();
      if (
        node !== root &&
        (node.matches("script, style, template") ||
          contentEditableValue === "false" ||
          ATOMIC_ELEMENTS.has(node.tagName.toUpperCase()))
      ) {
        const parent = node.parentNode;
        const index = childIndex(node);
        appendBreak(
          { node: parent, offset: index },
          { node: parent, offset: index + 1 },
          "protected",
          true
        );
        return;
      }
      const parent = node.parentNode;
      const index = childIndex(node);
      if (node.tagName === "BR") {
        appendBreak(
          { node: parent, offset: index },
          { node: parent, offset: index + 1 },
          "br",
          true
        );
        return;
      }
      const isBlock = node !== root && BLOCK_ELEMENTS.has(node.tagName);
      if (isBlock && length > 0) {
        appendBreak(
          { node: parent, offset: index },
          { node, offset: 0 },
          "block"
        );
      }
      for (const child of node.childNodes) {
        visit(child);
      }
      if (isBlock && length > 0) {
        appendBreak(
          { node, offset: node.childNodes.length },
          { node: parent, offset: index + 1 },
          "block"
        );
      }
    }

    visit(root);
    if (segments.at(-1)?.type === "break" && segments.at(-1).source === "block") {
      segments.pop();
      pieces.pop();
      length -= 1;
    }
    return { text: pieces.join(""), length, segments };
  }

  function getEditableText(element) {
    if (isTextControl(element)) {
      return element.value;
    }
    return buildEditableTextModel(element).text;
  }

  function resolveTextPosition(root, requestedOffset, bias = "forward", suppliedModel = null) {
    const model = suppliedModel || buildEditableTextModel(root);
    const offset = Math.max(0, Math.min(model.length, requestedOffset));
    const textSegments = model.segments.filter((segment) => segment.type === "text");
    if (bias === "backward") {
      for (let index = textSegments.length - 1; index >= 0; index -= 1) {
        const segment = textSegments[index];
        if (offset > segment.start && offset <= segment.end) {
          return { node: segment.node, offset: offset - segment.start };
        }
      }
    } else {
      for (const segment of textSegments) {
        if (offset >= segment.start && offset < segment.end) {
          return { node: segment.node, offset: offset - segment.start };
        }
      }
    }
    for (const segment of model.segments) {
      if (segment.type !== "break") {
        continue;
      }
      if (offset === segment.start) {
        return segment.startPosition;
      }
      if (offset === segment.end) {
        return segment.endPosition;
      }
    }
    if (bias === "backward") {
      const first = textSegments[0];
      if (first && offset === 0) {
        return { node: first.node, offset: 0 };
      }
    } else {
      const last = textSegments.at(-1);
      if (last && offset === model.length) {
        return { node: last.node, offset: last.node.data.length };
      }
    }
    return { node: root, offset: bias === "backward" ? root.childNodes.length : 0 };
  }

  function clipRect(rect, clip) {
    const left = Math.max(rect.left, clip.left);
    const right = Math.min(rect.right, clip.right);
    const top = Math.max(rect.top, clip.top);
    const bottom = Math.min(rect.bottom, clip.bottom);
    if (right - left < 1 || bottom - top < 1) {
      return null;
    }
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  function contentEditableRects(element, issue, model) {
    const start = resolveTextPosition(element, issue.offset, "forward", model);
    const end = resolveTextPosition(element, issue.offset + issue.length, "backward", model);
    if (!start || !end) {
      return [];
    }
    const range = document.createRange();
    try {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    } catch (_error) {
      return [];
    }
    const clip = element.getBoundingClientRect();
    return Array.from(range.getClientRects(), (rect) => clipRect(rect, clip)).filter(Boolean);
  }

  function appendIssueSpans(mirror, text, issues) {
    const spans = new Map();
    let cursor = 0;
    for (const issue of [...issues].sort((left, right) => left.offset - right.offset)) {
      if (issue.offset < cursor || issue.offset + issue.length > text.length) {
        continue;
      }
      mirror.append(document.createTextNode(text.slice(cursor, issue.offset)));
      const span = document.createElement("span");
      span.dataset.issueId = issue.id;
      span.textContent = text.slice(issue.offset, issue.offset + issue.length) || "\u200b";
      mirror.append(span);
      spans.set(issue.id, span);
      cursor = issue.offset + issue.length;
    }
    mirror.append(document.createTextNode(text.slice(cursor) || "\u200b"));
    return spans;
  }

  function textControlRects(element, issues) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) {
      return new Map();
    }
    const computed = getComputedStyle(element);
    const mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    Object.assign(mirror.style, {
      background: "transparent",
      color: "transparent",
      height: `${bounds.height}px`,
      left: `${bounds.left}px`,
      margin: "0",
      opacity: "0",
      overflow: "hidden",
      pointerEvents: "none",
      position: "fixed",
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      zIndex: "-2147483648"
    });
    for (const property of MIRROR_PROPERTIES) {
      mirror.style[property] = computed[property];
    }
      if (elementTag(element) === "input") {
      mirror.style.whiteSpace = "pre";
      mirror.style.overflowWrap = "normal";
    }
    const spans = appendIssueSpans(mirror, element.value, issues);
    document.documentElement.append(mirror);
    mirror.scrollTop = element.scrollTop;
    mirror.scrollLeft = element.scrollLeft;
    const result = new Map();
    for (const [issueId, span] of spans) {
      const rects = Array.from(span.getClientRects(), (rect) => clipRect(rect, bounds)).filter(Boolean);
      result.set(issueId, rects);
    }
    mirror.remove();
    return result;
  }

  function calculateIssueRects(element, issues) {
    if (isTextControl(element)) {
      return textControlRects(element, issues);
    }
    const model = buildEditableTextModel(element);
    return new Map(issues.map((issue) => [issue.id, contentEditableRects(element, issue, model)]));
  }

  function makeElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  class OverlayView {
    constructor(onAction) {
      this.onAction = onAction;
      this.issues = new Map();
      this.activeElement = null;
      this.badgeOffsets = new WeakMap();
      this.badgeDrag = null;
      this.suppressBadgeClick = false;
      this.canUndo = false;
      this.returnFocus = null;
      this.host = document.createElement("div");
      this.host.id = "squiggle-sage-overlay-host";
      this.shadow = this.host.attachShadow({ mode: "closed" });
      const style = makeElement("style");
      style.textContent = `
        :host { color-scheme: light dark; }
        * { box-sizing: border-box; }
        .layer { inset: 0; pointer-events: none; position: fixed; }
        .marker { --issue-wave: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 4 Q2 .8 4 4 T8 4' fill='none' stroke='%23dc2626' stroke-linecap='round' stroke-width='2.2'/%3E%3C/svg%3E"); background-color: transparent; background-image: var(--issue-wave); background-position: left bottom; background-repeat: repeat-x; background-size: 8px 8px; border: 0; cursor: pointer; height: 10px; margin: 0; padding: 0; pointer-events: auto; position: fixed; }
        .marker:focus-visible, .badge:focus-visible, .replacement:focus-visible, .secondary:focus-visible { outline: 2px solid #0f766e; outline-offset: 2px; }
        .badge { align-items: center; background: #0f766e; border: 2px solid #fff; border-radius: 999px; box-shadow: 0 3px 12px #0004; color: #fff; cursor: grab; display: flex; font: 700 12px/1 system-ui, sans-serif; height: 28px; justify-content: center; min-width: 28px; padding: 0 7px; pointer-events: auto; position: fixed; touch-action: none; user-select: none; }
        .badge[data-dragging="true"] { cursor: grabbing; }
        .card { background: Canvas; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 12px; box-shadow: 0 14px 38px #0004; color: CanvasText; display: grid; font: 14px/1.35 system-ui, sans-serif; gap: 10px; max-width: min(340px, calc(100vw - 16px)); padding: 14px; pointer-events: auto; position: fixed; width: 320px; }
        .card[hidden] { display: none; }
        .close { align-items: center; background: transparent; border: 0; border-radius: 999px; color: CanvasText; cursor: pointer; display: flex; font: 700 18px/1 system-ui, sans-serif; height: 28px; justify-content: center; padding: 0; position: absolute; right: 7px; top: 7px; width: 28px; }
        .close:hover { background: color-mix(in srgb, CanvasText 10%, transparent); }
        .close:focus-visible { outline: 2px solid #0f766e; outline-offset: 1px; }
        .category { color: #0f766e; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .message { font-weight: 650; overflow-wrap: anywhere; }
        .replacements { display: flex; flex-wrap: wrap; gap: 7px; }
        .replacement { background: #0f766e; border: 0; border-radius: 7px; color: white; cursor: pointer; font: 650 13px/1 system-ui, sans-serif; max-width: 100%; overflow: hidden; padding: 8px 10px; text-overflow: ellipsis; white-space: nowrap; }
        .actions { display: flex; flex-wrap: wrap; gap: 6px; }
        .secondary { background: transparent; border: 1px solid color-mix(in srgb, CanvasText 22%, transparent); border-radius: 7px; color: CanvasText; cursor: pointer; font: 12px/1 system-ui, sans-serif; padding: 7px 8px; }
        .privacy { color: color-mix(in srgb, CanvasText 62%, transparent); font-size: 11px; }
        @media (prefers-reduced-motion: no-preference) { .card { animation: appear 100ms ease-out; } }
        @keyframes appear { from { opacity: 0; transform: translateY(3px); } }
      `;
      this.layer = makeElement("div", "layer");
      this.badge = makeElement("button", "badge", "SS");
      this.badge.type = "button";
      this.badge.title = "SquiggleSage is checking locally";
      this.badge.setAttribute(
        "aria-label",
        "SquiggleSage suggestions. Press Enter to open, Alt plus Left or Right to navigate issues, or use arrow keys to move."
      );
      this.badge.hidden = true;
      this.card = makeElement("section", "card");
      this.card.hidden = true;
      this.card.setAttribute("role", "dialog");
      this.card.setAttribute("aria-label", "Writing suggestion");
      this.shadow.append(style, this.layer, this.badge, this.card);
      document.documentElement.append(this.host);
      this.resetDiagnostics();
      this.badge.addEventListener("pointerdown", (event) => this.startBadgeDrag(event));
      this.badge.addEventListener("pointermove", (event) => this.moveBadge(event));
      this.badge.addEventListener("pointerup", (event) => this.finishBadgeDrag(event));
      this.badge.addEventListener("pointercancel", (event) => this.cancelBadgeDrag(event));
      this.badge.addEventListener("lostpointercapture", (event) => this.cancelBadgeDrag(event));
      this.badge.addEventListener("keydown", (event) => this.handleBadgeKeyDown(event));
      this.badge.addEventListener("click", (event) => {
        if (this.suppressBadgeClick) {
          event.preventDefault();
          event.stopPropagation();
          this.suppressBadgeClick = false;
          return;
        }
        this.openBadgeCard(event.detail === 0);
      });
      this.onDocumentPointerDown = (event) => {
        if (!event.composedPath().includes(this.host)) {
          this.hideCard();
        }
      };
      this.onDocumentKeyDown = (event) => {
        if (!event.composedPath().includes(this.host)) {
          return;
        }
        if (event.key === "Escape" && !this.card.hidden) {
          event.preventDefault();
          this.hideCard();
          (this.returnFocus?.isConnected ? this.returnFocus : this.badge).focus({ preventScroll: true });
          return;
        }
        if (!this.card.hidden && event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          this.navigateIssue(event.key === "ArrowRight" ? 1 : -1, true);
        }
      };
      document.addEventListener("pointerdown", this.onDocumentPointerDown, true);
      document.addEventListener("keydown", this.onDocumentKeyDown, true);
    }

    openBadgeCard(focusCard = false) {
      if (!this.card.hidden) {
        this.hideCard();
        return;
      }
      const firstIssue = this.issues.values().next().value;
      if (firstIssue) {
        this.showIssue(firstIssue, this.badge.getBoundingClientRect(), focusCard, this.badge);
      } else {
        this.showStatus(this.badge.getBoundingClientRect(), focusCard, this.badge);
      }
    }

    startBadgeDrag(event) {
      if (!event.isPrimary || event.button !== 0) {
        return;
      }
      event.preventDefault();
      const rect = this.badge.getBoundingClientRect();
      const element = this.activeElement;
      if (!element) {
        return;
      }
      const existingOffset = element ? this.badgeOffsets.get(element) : null;
      this.badgeDrag = {
        pointerId: event.pointerId,
        element,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        width: rect.width,
        height: rect.height,
        startOffset: existingOffset ? { ...existingOffset } : null,
        moved: false
      };
      try {
        this.badge.setPointerCapture(event.pointerId);
      } catch (_error) {
        this.badgeDrag = null;
      }
    }

    moveBadge(event) {
      const drag = this.badgeDrag;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      drag.moved = true;
      this.badge.dataset.dragging = "true";
      this.hideCard();
      const editorRect = drag.element?.getBoundingClientRect();
      if (!editorRect) {
        return;
      }
      const base = this.defaultBadgePosition(editorRect, drag.width, drag.height);
      const requestedLeft = drag.startLeft + deltaX;
      const requestedTop = drag.startTop + deltaY;
      this.badgeOffsets.set(drag.element, {
        x: requestedLeft - base.left,
        y: requestedTop - base.top
      });
      this.applyBadgePosition(requestedLeft, requestedTop, drag.width, drag.height);
    }

    finishBadgeDrag(event) {
      const drag = this.badgeDrag;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.suppressBadgeClick = true;
      setTimeout(() => {
        this.suppressBadgeClick = false;
      }, 0);
      this.badge.dataset.dragging = "false";
      this.badgeDrag = null;
      try {
        this.badge.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Pointer capture can already be gone when Firefox completes the gesture.
      }
      if (!drag.moved) {
        this.openBadgeCard();
      }
    }

    cancelBadgeDrag(event) {
      const drag = this.badgeDrag;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      if (drag.element) {
        if (drag.startOffset) {
          this.badgeOffsets.set(drag.element, drag.startOffset);
        } else {
          this.badgeOffsets.delete(drag.element);
        }
      }
      this.badge.dataset.dragging = "false";
      this.badgeDrag = null;
      this.suppressBadgeClick = false;
      if (drag.element && this.activeElement === drag.element) {
        this.positionBadge(drag.element, this.issues.size);
      }
    }

    handleBadgeKeyDown(event) {
      if (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        this.navigateIssue(event.key === "ArrowRight" ? 1 : -1, true);
        return;
      }
      const movement = {
        ArrowDown: [0, 8],
        ArrowLeft: [-8, 0],
        ArrowRight: [8, 0],
        ArrowUp: [0, -8]
      }[event.key];
      if (!movement || !this.activeElement) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const multiplier = event.shiftKey ? 3 : 1;
      const rect = this.badge.getBoundingClientRect();
      const editorRect = this.activeElement.getBoundingClientRect();
      const base = this.defaultBadgePosition(editorRect, rect.width, rect.height);
      const requestedLeft = rect.left + movement[0] * multiplier;
      const requestedTop = rect.top + movement[1] * multiplier;
      this.badgeOffsets.set(this.activeElement, {
        x: requestedLeft - base.left,
        y: requestedTop - base.top
      });
      this.applyBadgePosition(requestedLeft, requestedTop, rect.width, rect.height);
    }

    defaultBadgePosition(rect, width, height) {
      return {
        left: rect.right - width - 2,
        top: rect.bottom - height - 2
      };
    }

    applyBadgePosition(requestedLeft, requestedTop, width, height) {
      const left = Math.max(6, Math.min(innerWidth - width - 6, requestedLeft));
      const top = Math.max(6, Math.min(innerHeight - height - 6, requestedTop));
      Object.assign(this.badge.style, { left: `${left}px`, top: `${top}px` });
      this.host.dataset.squiggleSageBadgeX = String(left + width / 2);
      this.host.dataset.squiggleSageBadgeY = String(top + height / 2);
      this.host.dataset.squiggleSageBadgeMoved = String(
        Boolean(this.activeElement && this.badgeOffsets.has(this.activeElement))
      );
    }

    render(element, issues, state = {}) {
      this.activeElement = element;
      this.canUndo = Boolean(state.canUndo);
      this.issues = new Map(issues.map((issue) => [issue.id, issue]));
      if (
        !this.card.hidden &&
        (this.cardIssueId === null ? issues.length > 0 : !this.issues.has(this.cardIssueId))
      ) {
        this.hideCard();
      }
      this.layer.replaceChildren();
      const rectsByIssue = calculateIssueRects(element, issues);
      for (const issue of issues) {
        const rects = rectsByIssue.get(issue.id) || [];
        for (const rect of rects) {
          const marker = makeElement("button", `marker marker--${issue.category || "grammar"}`);
          marker.type = "button";
          marker.tabIndex = -1;
          marker.dataset.issueId = issue.id;
          marker.dataset.issueCategory = issue.category || "grammar";
          marker.dataset.ruleId = issue.ruleId || "";
          marker.setAttribute(
            "aria-label",
            `${issue.message || "Writing suggestion"}. Press Enter to open; use arrow keys to navigate issues.`
          );
          Object.assign(marker.style, {
            left: `${rect.left}px`,
            top: `${Math.max(rect.top, rect.bottom - 8)}px`,
            width: `${Math.max(2, rect.width)}px`
          });
          marker.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showIssue(issue, rect, false, marker);
          });
          marker.addEventListener("keydown", (event) => this.handleMarkerKeyDown(event, issue, marker));
          this.layer.append(marker);
        }
      }
      const markers = this.layer.querySelectorAll(".marker");
      const firstMarkerByIssue = new Map();
      for (const marker of markers) {
        if (!firstMarkerByIssue.has(marker.dataset.issueId)) {
          firstMarkerByIssue.set(marker.dataset.issueId, marker);
        }
      }
      const keyboardMarkers = [...firstMarkerByIssue.values()];
      const selectedMarker = firstMarkerByIssue.get(this.cardIssueId) || keyboardMarkers[0];
      if (selectedMarker) {
        selectedMarker.tabIndex = 0;
      }
      const firstMarker = markers[0];
      const lastMarker = markers[markers.length - 1];
      const firstSpellingMarker = this.layer.querySelector('.marker[data-issue-category="spelling"]');
      const modalMarker = this.layer.querySelector('.marker[data-rule-id="MODAL_OF"]');
      this.host.dataset.squiggleSageIssueCount = String(issues.length);
      this.host.dataset.squiggleSageMarkerCount = String(markers.length);
      if (firstMarker) {
        const markerRect = firstMarker.getBoundingClientRect();
        this.host.dataset.squiggleSageFirstMarkerX = String(markerRect.left + markerRect.width / 2);
        this.host.dataset.squiggleSageFirstMarkerY = String(markerRect.top + markerRect.height / 2);
        this.host.dataset.squiggleSageFirstRuleId = firstMarker.dataset.ruleId || "";
        this.host.dataset.squiggleSageFirstIssueCategory = firstMarker.dataset.issueCategory || "";
      } else {
        delete this.host.dataset.squiggleSageFirstMarkerX;
        delete this.host.dataset.squiggleSageFirstMarkerY;
        delete this.host.dataset.squiggleSageFirstRuleId;
        delete this.host.dataset.squiggleSageFirstIssueCategory;
      }
      if (lastMarker) {
        const markerRect = lastMarker.getBoundingClientRect();
        this.host.dataset.squiggleSageLastMarkerX = String(markerRect.left + markerRect.width / 2);
        this.host.dataset.squiggleSageLastMarkerY = String(markerRect.top + markerRect.height / 2);
      } else {
        delete this.host.dataset.squiggleSageLastMarkerX;
        delete this.host.dataset.squiggleSageLastMarkerY;
      }
      this.recordMarkerCenter("FirstSpelling", firstSpellingMarker);
      this.recordMarkerCenter("Modal", modalMarker);
      this.positionBadge(element, issues.length);
    }

    issueMarkers() {
      const firstByIssue = new Map();
      for (const marker of this.layer.querySelectorAll(".marker")) {
        if (!firstByIssue.has(marker.dataset.issueId)) {
          firstByIssue.set(marker.dataset.issueId, marker);
        }
      }
      return [...firstByIssue.values()];
    }

    focusMarker(marker) {
      if (!marker) {
        return;
      }
      for (const candidate of this.issueMarkers()) {
        candidate.tabIndex = candidate === marker ? 0 : -1;
      }
      marker.focus({ preventScroll: true });
    }

    navigateIssue(delta, openCard = false) {
      const markers = this.issueMarkers();
      if (!markers.length) {
        if (openCard) {
          this.showStatus(this.badge.getBoundingClientRect(), true, this.badge);
        }
        return;
      }
      const focused = this.shadow.activeElement;
      const activeIssueId = this.cardIssueId || focused?.dataset?.issueId;
      let index = markers.findIndex((marker) => marker.dataset.issueId === activeIssueId);
      if (index < 0) {
        index = delta > 0 ? -1 : 0;
      }
      const marker = markers[(index + delta + markers.length) % markers.length];
      const issue = this.issues.get(marker.dataset.issueId);
      if (!issue) {
        return;
      }
      this.focusMarker(marker);
      if (openCard) {
        this.showIssue(issue, marker.getBoundingClientRect(), true, marker);
      }
    }

    handleMarkerKeyDown(event, issue, marker) {
      if (["Enter", " "].includes(event.key)) {
        event.preventDefault();
        this.showIssue(issue, marker.getBoundingClientRect(), true, marker);
        return;
      }
      const navigationKeys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Home", "End"];
      if (navigationKeys.includes(event.key)) {
        event.preventDefault();
        const markers = this.issueMarkers();
        let target;
        if (event.key === "Home") {
          target = markers[0];
        } else if (event.key === "End") {
          target = markers.at(-1);
        } else {
          const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
          const index = markers.indexOf(marker);
          target = markers[(index + direction + markers.length) % markers.length];
        }
        this.focusMarker(target);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.activeElement?.focus({ preventScroll: true });
      }
    }

    recordMarkerCenter(name, marker) {
      const xKey = `squiggleSage${name}MarkerX`;
      const yKey = `squiggleSage${name}MarkerY`;
      if (marker) {
        const rect = marker.getBoundingClientRect();
        this.host.dataset[xKey] = String(rect.left + rect.width / 2);
        this.host.dataset[yKey] = String(rect.top + rect.height / 2);
      } else {
        delete this.host.dataset[xKey];
        delete this.host.dataset[yKey];
      }
    }

    positionBadge(element, count) {
      const rect = element.getBoundingClientRect();
      if (
        rect.width < 36 ||
        rect.height < 22 ||
        rect.right <= 0 ||
        rect.left >= innerWidth ||
        rect.bottom <= 0 ||
        rect.top >= innerHeight
      ) {
        this.badge.hidden = true;
        this.host.dataset.squiggleSageBadgeText = "";
        delete this.host.dataset.squiggleSageBadgeX;
        delete this.host.dataset.squiggleSageBadgeY;
        return;
      }
      this.badge.hidden = false;
      this.badge.textContent = count ? String(count) : "✓";
      this.badge.dataset.state = "local";
      this.host.dataset.squiggleSageBadgeText = this.badge.textContent;
      this.host.dataset.squiggleSageState = "local";
      this.badge.title = `${count} local writing suggestion${count === 1 ? "" : "s"}. Press Enter to open; Alt+Left/Right navigates issues.`;
      const badgeRect = this.badge.getBoundingClientRect();
      const base = this.defaultBadgePosition(rect, badgeRect.width, badgeRect.height);
      const offset = this.badgeOffsets.get(element);
      this.applyBadgePosition(
        base.left + (offset?.x || 0),
        base.top + (offset?.y || 0),
        badgeRect.width,
        badgeRect.height
      );
    }

    showStatus(anchor, focusCard = false, trigger = null) {
      this.cardIssueId = null;
      const children = [
        this.makeCloseButton(),
        makeElement("div", "category", "SquiggleSage"),
        makeElement("div", "message", "No local writing suggestions in this field.")
      ];
      if (this.canUndo) {
        children.push(this.makeUndoButton());
      }
      children.push(makeElement("div", "privacy", "SquiggleSage and Firefox spelling both run locally."));
      this.card.replaceChildren(...children);
      this.returnFocus = trigger;
      this.positionCard(anchor, focusCard);
    }

    showIssue(issue, anchor, focusCard = false, trigger = null) {
      this.cardIssueId = issue.id;
      const category = makeElement("div", "category", issue.category || "Writing");
      const message = makeElement("div", "message", issue.message || "Writing suggestion");
      const replacements = makeElement("div", "replacements");
      for (const replacement of (issue.replacements || []).slice(0, 4)) {
        const label = replacement || "Delete";
        const button = makeElement("button", "replacement", label);
        button.type = "button";
        button.title = label;
        button.addEventListener("click", () => {
          this.hideCard();
          this.onAction({ type: "replace", issue, replacement });
        });
        replacements.append(button);
      }
      const actions = makeElement("div", "actions");
      const ignore = makeElement("button", "secondary", "Ignore once");
      ignore.type = "button";
      ignore.addEventListener("click", () => {
        this.hideCard();
        this.onAction({ type: "ignore", issue });
      });
      const ignoreForSession = makeElement("button", "secondary ignore-for-session", "Ignore for session");
      ignoreForSession.type = "button";
      ignoreForSession.title = "Ignore matching occurrences until this tab is closed or reloaded";
      ignoreForSession.addEventListener("click", () => {
        this.hideCard();
        this.onAction({ type: "ignore-for-session", issue });
      });
      const disable = makeElement("button", "secondary", "Turn off rule");
      disable.type = "button";
      disable.addEventListener("click", () => {
        this.hideCard();
        this.onAction({ type: "disable-rule", issue });
      });
      actions.append(ignore, ignoreForSession);
      if (issue.category === "spelling" && issue.ruleId !== "PERSONAL_REPLACEMENT") {
        const addToDictionary = makeElement("button", "secondary add-to-dictionary", "Add to dictionary");
        addToDictionary.type = "button";
        addToDictionary.addEventListener("click", () => {
          this.hideCard();
          this.onAction({ type: "add-to-dictionary", issue });
        });
        actions.append(addToDictionary);
      } else if (issue.ruleId !== "PERSONAL_REPLACEMENT") {
        actions.append(disable);
      }
      const children = [this.makeCloseButton(), category, message];
      if (replacements.childElementCount) {
        children.push(replacements);
      }
      if (this.canUndo) {
        children.push(this.makeUndoButton());
      }
      children.push(actions, makeElement("div", "privacy", "Checked locally - editor text is not stored."));
      this.card.replaceChildren(...children);
      this.returnFocus = trigger;
      this.positionCard(anchor, focusCard);
    }

    makeUndoButton() {
      const undo = makeElement("button", "secondary undo", "Undo last correction");
      undo.type = "button";
      undo.addEventListener("click", () => {
        this.hideCard();
        this.onAction({ type: "undo" });
      });
      return undo;
    }

    makeCloseButton() {
      const close = makeElement("button", "close", "\u00d7");
      close.type = "button";
      close.setAttribute("aria-label", "Close SquiggleSage message");
      close.title = "Close";
      close.addEventListener("click", () => {
        this.hideCard();
        (this.returnFocus?.isConnected ? this.returnFocus : this.badge).focus({ preventScroll: true });
      });
      return close;
    }

    positionCard(anchor, focusCard = false) {
      this.card.hidden = false;
      const width = Math.min(320, innerWidth - 16);
      this.card.style.width = `${width}px`;
      let left = Math.max(8, Math.min(innerWidth - width - 8, anchor.left));
      let top = anchor.bottom + 9;
      const height = this.card.getBoundingClientRect().height;
      if (top + height > innerHeight - 8) {
        top = Math.max(8, anchor.top - height - 9);
      }
      left = Math.max(8, left);
      Object.assign(this.card.style, { left: `${left}px`, top: `${top}px` });
      const firstReplacement = this.card.querySelector(".replacement");
      const addToDictionary = this.card.querySelector(".add-to-dictionary");
      const undo = this.card.querySelector(".undo");
      const ignoreForSession = this.card.querySelector(".ignore-for-session");
      this.host.dataset.squiggleSageCardVisible = "true";
      this.host.dataset.squiggleSageReplacementCount = String(
        this.card.querySelectorAll(".replacement").length
      );
      if (firstReplacement) {
        const replacementRect = firstReplacement.getBoundingClientRect();
        this.host.dataset.squiggleSageFirstReplacementX = String(
          replacementRect.left + replacementRect.width / 2
        );
        this.host.dataset.squiggleSageFirstReplacementY = String(
          replacementRect.top + replacementRect.height / 2
        );
      } else {
        delete this.host.dataset.squiggleSageFirstReplacementX;
        delete this.host.dataset.squiggleSageFirstReplacementY;
      }
      if (addToDictionary) {
        const addRect = addToDictionary.getBoundingClientRect();
        this.host.dataset.squiggleSageAddToDictionaryX = String(addRect.left + addRect.width / 2);
        this.host.dataset.squiggleSageAddToDictionaryY = String(addRect.top + addRect.height / 2);
      } else {
        delete this.host.dataset.squiggleSageAddToDictionaryX;
        delete this.host.dataset.squiggleSageAddToDictionaryY;
      }
      this.recordActionCenter("Undo", undo);
      this.recordActionCenter("IgnoreForSession", ignoreForSession);
      this.host.dataset.squiggleSageUndoAvailable = String(Boolean(this.card.querySelector(".undo")));
      this.host.dataset.squiggleSageIgnoreForSessionAvailable = String(
        Boolean(this.card.querySelector(".ignore-for-session"))
      );
      if (focusCard) {
        this.card.querySelector(".replacement, .secondary, .close")?.focus({ preventScroll: true });
      }
    }

    recordActionCenter(name, action) {
      const xKey = `squiggleSage${name}X`;
      const yKey = `squiggleSage${name}Y`;
      if (action) {
        const rect = action.getBoundingClientRect();
        this.host.dataset[xKey] = String(rect.left + rect.width / 2);
        this.host.dataset[yKey] = String(rect.top + rect.height / 2);
      } else {
        delete this.host.dataset[xKey];
        delete this.host.dataset[yKey];
      }
    }

    hideCard() {
      this.card.hidden = true;
      this.cardIssueId = undefined;
      this.host.dataset.squiggleSageCardVisible = "false";
      this.host.dataset.squiggleSageReplacementCount = "0";
      this.host.dataset.squiggleSageUndoAvailable = "false";
      this.host.dataset.squiggleSageIgnoreForSessionAvailable = "false";
      delete this.host.dataset.squiggleSageFirstReplacementX;
      delete this.host.dataset.squiggleSageFirstReplacementY;
      delete this.host.dataset.squiggleSageAddToDictionaryX;
      delete this.host.dataset.squiggleSageAddToDictionaryY;
      delete this.host.dataset.squiggleSageUndoX;
      delete this.host.dataset.squiggleSageUndoY;
      delete this.host.dataset.squiggleSageIgnoreForSessionX;
      delete this.host.dataset.squiggleSageIgnoreForSessionY;
    }

    resetDiagnostics() {
      this.host.dataset.squiggleSageIssueCount = "0";
      this.host.dataset.squiggleSageMarkerCount = "0";
      this.host.dataset.squiggleSageBadgeText = "";
      this.host.dataset.squiggleSageState = "idle";
      this.host.dataset.squiggleSageCardVisible = "false";
      this.host.dataset.squiggleSageReplacementCount = "0";
      this.host.dataset.squiggleSageBadgeMoved = "false";
      delete this.host.dataset.squiggleSageBadgeX;
      delete this.host.dataset.squiggleSageBadgeY;
      delete this.host.dataset.squiggleSageFirstMarkerX;
      delete this.host.dataset.squiggleSageFirstMarkerY;
      delete this.host.dataset.squiggleSageFirstRuleId;
      delete this.host.dataset.squiggleSageFirstIssueCategory;
      delete this.host.dataset.squiggleSageLastMarkerX;
      delete this.host.dataset.squiggleSageLastMarkerY;
      delete this.host.dataset.squiggleSageFirstSpellingMarkerX;
      delete this.host.dataset.squiggleSageFirstSpellingMarkerY;
      delete this.host.dataset.squiggleSageModalMarkerX;
      delete this.host.dataset.squiggleSageModalMarkerY;
      delete this.host.dataset.squiggleSageFirstReplacementX;
      delete this.host.dataset.squiggleSageFirstReplacementY;
      delete this.host.dataset.squiggleSageAddToDictionaryX;
      delete this.host.dataset.squiggleSageAddToDictionaryY;
    }

    clear() {
      this.issues.clear();
      this.activeElement = null;
      this.layer.replaceChildren();
      this.badge.hidden = true;
      this.hideCard();
      this.resetDiagnostics();
    }

    destroy() {
      document.removeEventListener("pointerdown", this.onDocumentPointerDown, true);
      document.removeEventListener("keydown", this.onDocumentKeyDown, true);
      this.host.remove();
    }
  }

  const api = {
    OverlayView,
    buildEditableTextModel,
    getEditableText,
    isTextControl,
    resolveTextPosition
  };
  global.SquiggleSageHighlighter = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
