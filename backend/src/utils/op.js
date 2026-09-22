
// Minimal stand-in for sequelize's `Op`, just enough for the one range
// filter still used in the app (admin "recent activity" chart).
module.exports = {
  gte: Symbol('gte'),
  lte: Symbol('lte'),
};


