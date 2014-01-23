var mongoose = require('mongoose'), Schema = mongoose.Schema;

module.exports = mongoose.model('User', new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  is_root: { type: Boolean, default: false },

  banned: { type: Boolean, default: false },
  force_log_out: { type: Boolean, default: false },

  token: String,
  token_updated_at: Date,

  created_at: Date,
  updated_at: Date,
  last_logged_in_at: [ Date ],
  password_updated_at: Date
}));
