var tty = require('tty.js');
var Server = tty.Server;
var Session = tty.Session;
var express = tty.express;

var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/maintainer');

Server.prototype.initMiddleware = function() {
  this.use(express.bodyParser());
  this.use(express.static(__dirname + '/assets'));
  this.use(express.static(__dirname + '/public'));
};

Server.prototype.initRoutes = function() {
};

Session.prototype._handleData = Session.prototype.handleData;

var app = Server({
  shell: 'bash',
  port: 3000,
  runScriptOnStart: runScriptOnStart
});

var Job = require('./models/job');
var User = require('./models/user');

app.post('/login', function(req, res, next) {
  var username = req.body.username;
  var password = req.body.password;
  var forbid = function() {
    res.status(401);
    res.send({ error: 'Invalid username or password.' });
  };
  User.findOne({ username: username }, function(error, user) {
    if (error || !user) return forbid();
    var bcrypt = require('bcrypt');
    if (!bcrypt.compareSync(password, user.password)) return forbid();

    if (user.banned) {
      res.writeHead(466, 'User Is Banned');
      res.end(JSON.stringify({ error: 'You are banned by administrators.' }));
      return;
    }

    var new_date = new Date;
    if (user.last_logged_in_at instanceof Array) {
      user.last_logged_in_at.unshift(new_date);
      user.last_logged_in_at.splice(3);
    } else {
      user.last_logged_in_at = [ new_date ];
    }

    var new_token = generate_new_token();
    user.token = new_token;
    user.token_updated_at = new_date;

    user.save(function(error, user) {
      if (error) return forbid();
      user = user.toObject();
      sanitize_document(user, User._public_fields);
      res.send(user);
    });
  });
});

function regex_escape(str) {
  return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function generate_new_token() {
  return require('crypto').randomBytes(32).toString('hex');
}

function runScriptOnStart(term, bundle) {
  if (!bundle || !bundle.job) return;
  Job.findOne({ _id: bundle.job, available: true }, 'published.content', function(error, job) {
    var script;
    if (error || job === null) {
      script = '# There is no script to run. Possible causes:\n' +
               '# * the job has been moved to trash or does not exist;\n' +
               '# * you don\'t have permissions to run the script;\n';
    } else {
      script = job.published.content.trim() + '\n';
    }
    term.write(script);
  });
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

function permission_denied(res) {
  res.status(403);
  res.send({ error: 'Permission denied.' });
}

function should_be_root(res) {
  res.writeHead(430, 'Should Be Root');
  res.end(JSON.stringify({ error: 'Permission denied.' }));
}

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
      if (error || !user) return permission_denied(res);

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
          if (user.is_root !== true) return should_be_root(res);
          break;
        }
      }

      req.user = user;

      callback(req, res, next);
    });
  };
}

app.delete('/login', authorize(function(req, res, next) {
  var new_token = generate_new_token();
  req.user.token = new_token;
  req.user.token_updated_at = new Date;

  req.user.save(function(error, user) {
    if (error) {
      next(error);
    } else {
      res.send({ status: 'OK' });
    }
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
        return content.revisions.id(revision_id)
      });
    } else {
      query = Job.findOne(find, '-revisions.content -permissions').exec();
    }
  } else {
    find.available = req.query.show_unavailable === 'true' ? { $ne: true } : true;
    query = Job.find(find, '-revisions -permissions').sort('created_at').exec();
  }
  query.then(function(content) {
    if (content === null) return next();
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
    res.send(new_job);
  });
}));

app.put('/jobs/:job_id', authorize(function(req, res, next) {
  var title = req.body.title;
  var content = req.body.content;
  Job.findOne({ _id: req.params.job_id, available: true }).exec(function(error, job) {
    if (error || !job) return next(error);
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
app.post('/jobs/:job_id', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  Job.findOne({ _id: req.params.job_id, available: false }).exec(function(error, job) {
    if (error || !job) return next(error);
    job.available = true;
    job.save(function(error) {
      if (error) return next(error);
      res.send({ status: 'OK' });
    });
  });
}));

app.delete('/jobs/:job_id', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  Job.findOne({ _id: req.params.job_id }).exec().then(function(job) {
    if (job === null) throw null;
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
  User.find({ username: new RegExp(regex_escape(query), 'i') }, 'username').limit(10)
    .exec(function(error, users) {
    res.send((error || !users) ? [] : users);
  });
}));

app.get('/users', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  User.find({}, User.public_fields).sort('created_at').exec(function(error, content) {
    if (error || !content) return next(error);
    res.send(content);
  });
}));

app.post('/users', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  var bcrypt = require('bcrypt');
  var username = req.body.username;
  var password = req.body.password;
  password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
  var now = new Date;
  var new_user = new User({
    username: username,
    password: password,
    banned: false,
    force_log_out: false,
    token: '',
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

function sanitize_document(document, fields) {
  Object.keys(document).forEach(function(key) {
    if (key[0] === '_') return;
    if (fields.indexOf(key) === -1) {
      delete document[key];
    }
  });
}

app.put('/users/:user_id/:action(token|password|username|ban)', authorize(SHOULD_BE_ROOT,
  function(req, res, next) {

  var user_id = req.params.user_id;
  var action = req.params.action;
  User.findOne({ _id: user_id }, User.public_fields).exec(function(error, user) {
    if (error || !user) return next(error);
    var new_date = new Date;
    switch (action) {
    case 'token':
      user.token = generate_new_token();
      user.token_updated_at = new_date;
      break;
    case 'password':
      var bcrypt = require('bcrypt');
      var password = req.body.password;
      password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
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
      user = user.toObject();
      sanitize_document(user, User._public_fields);
      res.send(user);
    });
  });
}));

app.delete('/users/:user_id', authorize(SHOULD_BE_ROOT, function(req, res, next) {
  var user_id = req.params.user_id;
  User.findOneAndRemove({ _id: user_id }).exec(function(error) {
    if (error) return next(error);
    res.send({ status: 'OK' });
  });
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
