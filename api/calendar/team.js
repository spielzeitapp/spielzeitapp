/**
 * Vercel Serverless: CommonJS entry so Node does not try to load this as ESM.
 * GET /api/calendar/team?teamId=… — Rewrite von /api/calendar/team/<slug|uuid>.ics
 * teamId: Team-UUID, stabiler Slug (spg-rohrbach) oder Legacy-Slug (u11-spg-rohrbach).
 */
const { teamIcsHandler } = require('./teamIcsCore.js');

module.exports = teamIcsHandler;
