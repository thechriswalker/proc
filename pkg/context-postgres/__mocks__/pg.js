// The idea here is to mock as little as possible.
const pg = require.requireActual("pg");
pg.Pool = function MockPool({ pool }) {
  return pool;
};
module.exports = pg;
