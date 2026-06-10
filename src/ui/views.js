/**
 * views.js — the single render() entry point.
 * All modules that need to trigger a full redraw import render() from here.
 * This file is the only place that imports from both renderer.js and inspector.js,
 * so it acts as the integration layer and prevents circular imports.
 */
import { renderConns, renderComps } from '../components/canvas/renderer.js';
import { renderInspector } from '../components/inspector.js';

export function render() {
  renderConns();
  renderComps();
  renderInspector();
}
