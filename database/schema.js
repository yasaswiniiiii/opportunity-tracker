/**
 * schema.js – MongoDB Schema (Mongoose)
 * ======================================
 * Defines the "opportunities" collection schema.
 *
 * Collection: opportunities
 * Fields:
 *   company     – Name of the hiring company
 *   role        – Job / internship title
 *   eligibility – Who can apply (year, CGPA, stream)
 *   deadline    – Application close date (ISO YYYY-MM-DD)
 *   description – Full opportunity details / original message
 *   applyLink   – URL to apply
 *   source      – Where the opportunity came from
 *   postedDate  – When we first ingested it
 */

const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema(
  {
    /* ── Core Fields ─────────────────────────────── */
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },

    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true
    },

    eligibility: {
      type: String,
      default: '',
      trim: true
    },

    deadline: {
      type: String,         // stored as 'YYYY-MM-DD' string for easy comparison
      required: [true, 'Deadline is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Deadline must be in YYYY-MM-DD format']
    },

    description: {
      type: String,
      default: '',
      trim: true
    },

    applyLink: {
      type: String,
      default: '',
      trim: true
    },

    /* ── Source Tracking ─────────────────────────── */
    source: {
      type: String,
      enum: ['Telegram', 'Website', 'Manual', 'Email', 'WhatsApp'],
      default: 'Manual'
    },

    postedDate: {
      type: String,         // 'YYYY-MM-DD'
      default: () => new Date().toISOString().split('T')[0]
    }
  },
  {
    timestamps: true,       // adds createdAt, updatedAt automatically
    collection: 'opportunities'
  }
);

/* ── INDEXES ────────────────────────────────────── */

// Helps search by company or role quickly
opportunitySchema.index({ company: 1, role: 1 });

// Helps sort/filter by deadline
opportunitySchema.index({ deadline: 1 });

// Helps filter by source channel
opportunitySchema.index({ source: 1 });

/* ── VIRTUAL: daysUntilDeadline ─────────────────── */
opportunitySchema.virtual('daysUntilDeadline').get(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(this.deadline);
  return Math.ceil((d - today) / 86400000);
});

/* ── EXPORT ─────────────────────────────────────── */
module.exports = mongoose.model('Opportunity', opportunitySchema);
