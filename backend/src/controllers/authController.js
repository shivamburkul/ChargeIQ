
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { deleteAccount } = require('../services/accountDeletionService');

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitize(user) {
  const { password, ...rest } = user.toJSON();
  return rest;
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    const allowedRoles = ['user', 'owner']; // admin accounts are seeded, not self-registered
    const finalRole = allowedRoles.includes(role) ? role : 'user';

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role: finalRole, phone });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
};

// Dedicated admin console login. Kept separate from the regular email/
// password login so the platform admin can sign in with a simple fixed
// username/password (admin / admin) without exposing that account's real
// email publicly. It still resolves to a genuine seeded admin User record
// and issues the same JWT shape, so all existing admin-only middleware and
// routes work unchanged.
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username !== 'admin' || password !== 'admin') {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }
    const admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      return res.status(404).json({ message: 'No admin account exists yet. Run the seed script first.' });
    }
    const token = signToken(admin);
    res.json({ token, user: sanitize(admin) });
  } catch (err) {
    res.status(500).json({ message: 'Admin login failed.', error: err.message });
  }
};

exports.me = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: sanitize(user) });
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const { name, phone, themePref, homeLat, homeLng } = req.body;
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (themePref !== undefined) user.themePref = themePref;
    if (homeLat !== undefined) user.homeLat = homeLat;
    if (homeLng !== undefined) user.homeLng = homeLng;
    await user.save();
    res.json({ user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Profile update failed.', error: err.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const result = await deleteAccount(req.user.id);
    res.json({ message: 'Account deleted.', ...result });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Account deletion failed.' });
  }
};

