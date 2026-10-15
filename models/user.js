const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Not returned by default; use .select("+passwordHash") when you need it.
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    name: { type: String, trim: true },
    avatar: { type: String },
    role: { type: String, enum: ["recruiter", "candidate"], required: true },
    authProvider: { type: String, enum: ["local", "google"], required: true },
  },
  { timestamps: true }
);

// Only these fields ever leave the server.
userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    avatar: this.avatar,
    role: this.role,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);