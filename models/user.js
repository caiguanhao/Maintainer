var mongoose = require('mongoose'), Schema = mongoose.Schema;

module.exports = mongoose.model('User', new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  is_root: { type: Boolean, default: false },

  banned: { type: Boolean, default: false },

  token: String,
  token_updated_at: Date,

  created_at: Date,
  updated_at: Date,
  last_logged_in_at: [ Date ],
  password_updated_at: Date
}));

var _public_fields = [
  'username',
  'banned',
  'token',
  'token_updated_at',
  'created_at',
  'updated_at',
  'last_logged_in_at',
  'password_updated_at'
];

module.exports._public_fields = _public_fields;
module.exports.public_fields = _public_fields.join(' ');
