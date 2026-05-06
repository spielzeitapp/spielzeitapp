/**
 * Vercel Serverless: CommonJS entry so Node does not try to load this as ESM.
 * GET /api/calendar/team?teamId=… — Rewrite von /api/calendar/team/<slug|uuid>.ics
 * teamId: Team-UUID oder öffentlicher Slug (z. B. u11-spg-rohrbach), gleiche Logik wie calendarFeed.ts.
 */
const { teamIcsHandler } = require('./teamIcsCore.js');

module.exports = teamIcsHandler;
