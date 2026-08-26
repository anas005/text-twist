/**
 * Central in-memory game store.
 * Rooms live here for the lifetime of the server process.
 */

/*
 * Default Configurations
 */
const WORD_LENGTH = 6;
const TIME_LIMIT = 120;

const db = {};

module.exports = {
  db,
  WORD_LENGTH,
  TIME_LIMIT,
};
