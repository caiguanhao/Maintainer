var mongoose = require('mongoose'), Schema = mongoose.Schema;
var common_methods = require('./__common__');
var bcrypt = require('bcrypt');

var user_schema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },

  is_root: { type: Boolean, default: false },

  banned: { type: Boolean, default: false },

  token: String,
  token_updated_at: Date,

  created_at: Date,
  updated_at: Date,
  last_logged_in_at: [ Date ],
  password_updated_at: Date
});

(new common_methods)
  .of('schema_methods')
  .including('sanitize')
  .give_to(user_schema);

user_schema.path('username').validate(function(value) {
  return /^[A-Za-z0-9_]{3,20}$/.test(value);
}, 'A username should include letters, numbers or underscores and must be no ' +
'shorter than 3 or longer than 20 characters.');

user_schema.path('password').validate(function(value) {
  if (this.isModified('password')) {
    return value.length >= 3 && value.length <= 20;
  } else {
    return true;
  }
}, 'A password must be no shorter than 3 or longer than 20 characters.');

user_schema.pre('save', function(next) {
  if (this.isModified('password')) {
    this.password = bcrypt.hashSync(this.password, bcrypt.genSaltSync(10));
  }
  next();
});

user_schema.method('compare_password', function(password) {
  if (!this.password) return false;
  return bcrypt.compareSync(password, this.password);
});

module.exports = mongoose.model('User', user_schema);
