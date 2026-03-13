/**
 * userSchema.js – MongoDB Schema (Mongoose) for Users
 * ======================================
 * Stores users authenticated via Google Login.
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String
    },
    password: {
      type: String
    },
    email: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    picture: {
      type: String
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
