/**
 * Vercel Serverless: CommonJS entry so Node does not try to load this as ESM.
 * Route: GET /api/calendar/team?teamId=… (rewrite from …/team/:id.ics)
 */
const { teamIcsHandler } = require('./teamIcsCore.js');

module.exports = teamIcsHandler;
