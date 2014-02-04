var mongoose = require('mongoose'), Schema = mongoose.Schema;
var common_methods = require('./__common__');
var bcrypt = require('bcrypt');

var MAX_ATTEMPTS = 5;
var LOCK_TIME = 2 * 60 * 60 * 1000;

var user_schema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },

  is_root: { type: Boolean, default: false },

  banned: { type: Boolean, default: false },

  token: String,
  token_updated_at: Date,

  login_attempts: { type: Number, default: 0, select: false },
  lock_until: { type: Number, select: false },

  preferences: {
    theme: { type: String }
  },

  created_at: Date,
  updated_at: Date,
  last_logged_in_at: [ Date ],
  password_updated_at: Date
});

user_schema.virtual('locked').get(function() {
  return !!(this.lock_until && this.lock_until > Date.now());
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

user_schema.method('generate_new_token', function(new_date) {
  this.token = this.constructor.generate_new_token();
  this.token_updated_at = new_date || new Date;
});

user_schema.static('generate_new_token', function() {
  return require('crypto').randomBytes(32).toString('hex');
});

user_schema.static('authenticate',
  function(username, password, options, callbacks) {
  options = options || {};
  callbacks = callbacks || {};
  callback_types = [ 'success', 'invalid', 'banned', 'exceed_max_attempts' ];

  for (var i = 1; i < callback_types.length; i++) {
    callbacks[callback_types[i]] = callbacks[callback_types[i]] || new Function;
  }

  var self = this;
  self.findOne({ username: username }, '+password +login_attempts +lock_until',
    function(error, user) {
    if (error || !user) return callbacks.invalid.call(user);

    if (user.locked) {
      return callbacks.exceed_max_attempts.call(user);
    }

    if (user.compare_password(password)) {
      user.lock_until = undefined;
      user.login_attempts = 0;
    } else {
      if (user.lock_until && user.lock_until < Date.now()) {
        // clearing previous expired attempts
        user.update({
          $set: { login_attempts: 1 },
          $unset: { lock_until: 1 }
        }, function(error) {
          callbacks.invalid.call(user);
        });
      } else {
        var update = { $inc: { login_attempts: 1 } };
        if (user.login_attempts + 1 >= MAX_ATTEMPTS && !user.locked) {
          update.$set = {
            lock_until: Date.now() + LOCK_TIME,
            token: self.generate_new_token()
          };
        }
        user.update(update, function(error) {
          callbacks.invalid.call(user);
        });
      }
      return;
    }

    if (user.banned) return callbacks.banned.call(user);

    if (options.dry_authenticate) {
      return callbacks.success.call(user);
    }

    // update user login info:

    var new_date = new Date;
    if (user.last_logged_in_at instanceof Array) {
      user.last_logged_in_at.unshift(new_date);
      user.last_logged_in_at.splice(3);
    } else {
      user.last_logged_in_at = [ new_date ];
    }

    user.generate_new_token(new_date);

    user.save(function(error, user) {
      if (error) return callbacks.invalid.call(user);
      callbacks.success.call(user);
    });
  });
});

module.exports = mongoose.model('User', user_schema);
module.exports.MAX_ATTEMPTS = MAX_ATTEMPTS;
