var tty = require('tty.js');
var Server = tty.Server;
var Session = tty.Session;
var express = tty.express;

var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/maintainer');

Server.prototype.initMiddleware = function() {};

Server.prototype.initRoutes = function() {};

Session.prototype.handleData = function(id, data) {
  var terms = this.terms;
  if (!terms[id]) return;
  if (!terms[id].allow) return;
  terms[id].write(data);
};

var app = Server({
  shell: 'bash',
  port: 3000,
  limitPerUser: 10,  // some users may have a less limit set in beforeCreate
  runScriptOnStart: runScriptOnStart,
  beforeCreate: beforeCreate
});

app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));
app.configure('development', function() {
  app.use(express.static(__dirname + '/assets'));
});
app.configure('production', function() {
  app.io.disable('browser client');
});

var ERROR = {
  invalid_username_password: function(res) {
    res.status(401);
    res.send({ error: 'Invalid username or password.',
      attempts_left: User.MAX_ATTEMPTS - this.login_attempts - 1 });
  },
  permission_denied: function(res) {
    res.status(403);
    res.send({ error: 'Permission denied.' });
  },
  exceed_max_attempts: function(res) {
    res.writeHead(429, 'Too Many Attempts');
    res.end(JSON.stringify({ error: 'The account is temporarily locked due ' +
      'to too many failed login attempts.', until: new Date(this.lock_until) }));
  },
  should_be_root: function(res) {
    res.writeHead(430, 'Should Be Root');
    res.end(JSON.stringify({ error: 'Permission denied.' }));
  },
  user_is_banned: function(res) {
    res.writeHead(466, 'User Is Banned');
    res.end(JSON.stringify({ error: 'You are banned by administrators.' }));
  },
  not_enough_permissions: function(res) {
    res.writeHead(488, 'Not Enough Permissions');
    res.end(JSON.stringify({ error: 'Not Enough Permissions.' }));
  },
  root_cant_be_changed: function(res) {
    res.writeHead(499, 'Root Can\'t Be Changed');
    res.end(JSON.stringify({ error: 'Changing a root user is not allowed.' }));
  }
};

var Job = require('./models/job');
var User = require('./models/user');

app.post('/login', function(req, res, next) {
  User.authenticate(req.body.username, req.body.password, null, {
    success: function() {
      res.send(this.sanitize());
    },
    invalid: function() {
      ERROR.invalid_username_password.call(this, res);
    },
    banned: function() {
      ERROR.user_is_banned.call(this, res);
    },
    exceed_max_attempts: function() {
      ERROR.exceed_max_attempts.call(this, res);
    }
  });
});

function regex_escape(str) {
  return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function beforeCreate(bundle, callback) {
  if (!bundle || !bundle.user_id || !bundle.user_token) return;

  var number_of_terminals_for_this_user = Object.keys(this.terms).length;

  User.findOne({ _id: bundle.user_id, token: bundle.user_token }, 
    function(error, user) {
    if (error || !user) return;

    if (user.is_root) {
      if (bundle.job) {
        return find_script_to_run(bundle.job, user, callback);
      } else {
        return callback({
          allow: true
        });
      }
    } else {
      if (number_of_terminals_for_this_user >= 1) return;
      if (bundle.job) {
        return find_script_to_run(bundle.job, user, callback);
      } else {
        return;
      }
    }

  });
}

function find_script_to_run(job_id, user, callback) {
  var find = { _id: job_id, available: true };
  if (!user.is_root) {
    find['permissions.user'] = user._id;
  }

  Job.findOne(find, 'published.content permissions', function(error, job) {
    if (error || !job || !job.permissions) return;

    var allow = job.permissions_for_user(user).execute;
    if (allow) {
      script = job.published.content.trim() + '\n';
    } else {
      script = '# There is no script to run. Possible causes:\n' +
               '# * the job has been moved to trash or does not exist;\n' +
               '# * you don\'t have permissions to run the script;\n';
    }
    if (!user.is_root) {
      allow = false;
    }
    return callback({
      write: script,
      allow: allow
    });
  });
}

function runScriptOnStart(term, bundle) {
  var output = bundle.beforeCreate; // output from beforeCreate
  if (output) {
    if (output.write) {
      term.write(output.write);
    }
    if (output.allow) {
      term.allow = output.allow;
    }
  }
}

app.use(function(req, res, next) {
  req._user_id = null;
  req._user_token = null;
  if (req.headers) {
    req._user_id = req.headers['x-user-id'];
    req._user_token = req.headers['x-user-token'];
  }
  next();
});

function unblock(callback) {
  return function(req, res, next) {
    callback(req, res, next);
  };
}

var SHOULD_BE_ROOT = 0x1;

function authorize() {
  var _arguments = arguments;
  return function(req, res, next) {
    var user = User.findOne({
      _id: req.headers['x-user-id'],
      token: req.headers['x-user-token']
    }).exec(function(error, user) {
      if (error || !user) return ERROR.permission_denied(res);

      var callback, options, l = _arguments.length;
      if (l <= 1) {
        callback = _arguments[0];
        options = [];
      } else {
        callback = _arguments[l - 1];
        options = Array.prototype.slice.call(_arguments, 0, l - 1);
      }

      for (var i = 0; i < options.length; i++) {
        switch (options[i]) {
        case SHOULD_BE_ROOT:
          if (user.is_root !== true) return ERROR.should_be_root(res);
          break;
        }
      }

      req.user = user;

      callback(req, res, next);
    });
  };
}

app.delete('/login', authorize(function(req, res, next) {
  req.user.generate_new_token();
  req.user.save(function(error, user) {
    if (error) {
      next(error);
    } else {
      res.send({ status: 'OK' });
    }
  });
}));

app.get('/profile', authorize(function(req, res, next) {
  res.send(req.user.sanitize());
}));

app.put('/profile/password', authorize(function(req, res, next) {
  var password = req.body.password;
  User.authenticate(req.user.username, password, {
    dry_authenticate: true
  }, {
    success: function() {
      var user = this;
      var new_date = new Date;
      user.password = password;
      user.password_updated_at = new_date;
      user.updated_at = new_date;
      user.save(function(error) {
        if (error) return next(error);
        res.send(user.sanitize());
      });
    },
    invalid: function() {
      ERROR.invalid_username_password.call(this, res);
    },
    banned: function() {
      ERROR.user_is_banned.call(this, res);
    },
    exceed_max_attempts: function() {
      ERROR.exceed_max_attempts.call(this, res);
    }
  });
}));

app.put('/preferences/:action(theme)', authorize(function(req, res, next) {
  var user = req.user;
  var new_date = new Date;
  switch (req.params.action) {
  case 'theme':
    var theme = req.body.theme;
    user.preferences.theme = theme;
    break;
  }
  user.updated_at = new_date;
  user.save(function(error) {
    if (error) return next(error);
    res.send(user.sanitize());
  });
}));

function job_permissions_for(user) {
  if (user.is_root) return {};
  return {
    'permissions.user': user._id
  };
}

app.get('/jobs/:job_id?/:revision_id?', authorize(function(req, res, next) {
  var job_id = req.params.job_id;
  var revision_id = req.params.revision_id;
  var query, find = job_permissions_for(req.user);
  if (job_id) {
    find._id = job_id
    if (revision_id) {
      query = Job.findOne(find, 'revisions').exec().then(function(content) {
        return content.revisions.id(revision_id);
      });
    } else {
      query = Job.findOne(find, '-revisions.content -permissions').lean().exec();
    }
  } else {
    find.available = req.query.show_unavailable === 'true' ? { $ne: true } : true;
    query = Job.find(find, '-revisions').sort('created_at').lean().exec();
  }
  query.then(function(content) {
    if (content === null) return next();
    if (content instanceof Array) {
      if (content[0] instanceof mongoose.Document) {
        content = content.map(function(obj) {
          return obj.toObject();
        });
      }
      for (var i = 0; i < content.length; i++) {
        Job.sanitize_permissions_for_job(content[i], req.user);
      }
    }
    res.send(content);
  }, function(error) {
    next(error);
  });
}));

app.post('/jobs', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  var title = req.body.title;
  var content = req.body.content;
  var job = {
    title: title,
    content: content,
    created_at: new Date()
  };
  var new_job = new Job({
    available: true,
    published: job,
    revisions: [ job ],
    revision_count: 1,
    created_at: new Date(),
    updated_at: new Date()
  });
  new_job.save(function(error) {
    if (error) return next(error);
    res.send(new_job.sanitize_permissions(req.user));
  });
}));

app.put('/jobs/:job_id', authorize(function(req, res, next) {
  var title = req.body.title;
  var content = req.body.content;
  var find = job_permissions_for(req.user);
  find._id = req.params.job_id;
  find.available = true;
  Job.findOne(find).exec(function(error, job) {
    if (error || !job) return next(error);
    if (job.permissions_for_user(req.user).write !== true) {
      return ERROR.not_enough_permissions(res);
    }
    var updated_job = {
      title: title,
      content: content,
      created_at: new Date()
    }
    job.available = true;
    job.published = updated_job;
    job.revisions.push(updated_job);
    job.revision_count += 1;
    job.updated_at = new Date();
    job.save(function(error) {
      if (error) return next(error);
      res.send({ status: 'OK' });
    });
  });
}));

// update permissions
app.put('/jobs/:job_id/permissions', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  var user = req.body.user;
  var bits = req.body.bits;
  Job.findOne({ _id: req.params.job_id }).exec(function(error, job) {
    if (error || !job) return next(error);
    User.findOne({ _id: user }).exec(function(error, user) {
      if (error || !user) return next(error);
      var changed = false;
      job.permissions.forEach(function(item) {
        if (item.user.toString() === user._id.toString()) {
          item.bits = bits;
          changed = true;
        }
      });
      if (!changed) {
        job.permissions.push({
          user: user._id,
          bits: bits
        });
      }
      job.permissions = job.permissions.filter(function(item) {
        return item.bits > 0;
      });
      job.save(function(error) {
        if (error) return next(error);
        res.send({ status: 'OK' });
      });
    });
  });
}));

app.delete('/jobs/:job_id/permissions', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  Job.findOne({ _id: req.params.job_id }).exec(function(error, job) {
    if (error || !job) return next(error);
    job.permissions = [];
    job.save(function(error) {
      if (error) return next(error);
      res.send({ status: 'OK' });
    });
  });
}));

// get list of permissions
app.post('/jobs/:job_id/permissions', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  Job.findOne({ _id: req.params.job_id }, 'permissions').populate({
    path: 'permissions.user',
    select: 'username'
  }).exec(function(error, job) {
    if (error || !job) return next(error);
    res.send(job);
  });
}));

// put back
app.post('/jobs/:job_id', authorize(function(req, res, next) {
  Job.findOne({ _id: req.params.job_id, available: false }).exec(function(error, job) {
    if (error || !job) return next(error);
    if (job.permissions_for_user(req.user).write !== true) {
      return ERROR.not_enough_permissions(res);
    }
    job.available = true;
    job.save(function(error) {
      if (error) return next(error);
      res.send({ status: 'OK' });
    });
  });
}));

app.delete('/jobs/:job_id', authorize(function(req, res, next) {
  Job.findOne({ _id: req.params.job_id }).exec().then(function(job) {
    if (job === null) throw null;
    if (job.permissions_for_user(req.user).write !== true) {
      return ERROR.not_enough_permissions(res);
    }
    var promise = new mongoose.Promise;
    if (job.available === true) {
      job.available = false;
      job.save(function(error, job) {
        promise.resolve(error, job);
      });
    } else {
      job.remove(function(error, job) {
        promise.resolve(error, job);
      });
    }
    return promise;
  }).then(function() {
    res.send({ status: 'OK' });
  }, function(error) {
    next(error);
  });
}));

// search username
app.get('/search/users/:query', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  var query = req.params.query;
  User.find({ username: new RegExp(regex_escape(query), 'i'),
    is_root: { $ne: true } }, 'username').limit(10).exec(function(error, users) {
    res.send((error || !users) ? [] : users);
  });
}));

app.get('/users', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  User.find({ is_root: { $ne: true } })
    .sort('created_at').exec(function(error, content) {
    if (error || !content) return next(error);
    res.send(content);
  });
}));

app.post('/users', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  var username = req.body.username;
  var password = req.body.password;
  var now = new Date;
  var new_user = new User({
    username: username,
    password: password,
    is_root: false,
    banned: false,
    token: User.generate_new_token(),
    token_updated_at: now,
    created_at: now,
    updated_at: now,
    last_logged_in_at: [ now ],
    password_updated_at: now
  });
  new_user.save(function(error) {
    if (error) return next(error);
    res.send(new_user);
  });
}));

app.put('/users/:user_id/:action(token|password|username|ban)', authorize(SHOULD_BE_ROOT,
  function(req, res, next) {

  var user_id = req.params.user_id;
  var action = req.params.action;
  User.findOne({ _id: user_id }).exec(function(error, user) {
    if (error || !user) return next(error);
    if (user.is_root) return ERROR.root_cant_be_changed(res);
    var new_date = new Date;
    switch (action) {
    case 'token':
      user.generate_new_token(new_date);
      break;
    case 'password':
      var password = req.body.password;
      user.password = password;
      user.password_updated_at = new_date;
      break;
    case 'username':
      var username = req.body.username;
      user.username = username;
      break;
    case 'ban':
      user.banned = !user.banned;
      break;
    }
    user.updated_at = new_date;
    user.save(function(error) {
      if (error) return next(error);
      res.send(user.sanitize());
    });
  });
}));

app.delete('/users/:user_id', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  var user_id = req.params.user_id;
  User.findOne({ _id: user_id }).exec(function(error, user) {
    if (error || !user) return next(error);
    if (user.is_root) return ERROR.root_cant_be_changed(res);
    user.remove(function(error) {
      if (error) return next(error);
      res.send({ status: 'OK' });
    });
  });
}));

app.get('/help/:help_topic?', unblock(function(req, res, next) {
  var help_index = require('./doc/index');
  var help_topic = req.params.help_topic;
  if (help_topic && help_index.hasOwnProperty(help_topic)) {
    var fs = require('fs');
    var content = 'No content.';
    try {
      content = fs.readFileSync('doc/' + help_topic + '.md').toString();
    } catch(error) {}
    res.send({
      slug: help_topic,
      title: help_index[help_topic],
      content: content
    });
  } else {
    res.send(help_index);
  }
}));

app.use(function(err, req, res, next) {
  res.status(err.status || 400);
  res.send({ error: err.toString() });
});

app.use(function(req, res) {
  res.status(404);
  res.send({ error: 'Page Not Found.' });
});

app.listen();
