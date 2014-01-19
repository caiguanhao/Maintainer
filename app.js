var tty = require('tty.js');
var Server = tty.Server;
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

var app = Server({
  shell: 'bash',
  port: 3000,
  runScriptOnStart: runScriptOnStart
});

var Job = require('./models/job');

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

app.get('/jobs/:job_id?/:revision_id?', function(req, res, next) {
  var job_id = req.params.job_id;
  var revision_id = req.params.revision_id;
  var query, find = {};
  if (job_id) {
    find._id = job_id
    if (revision_id) {
      query = Job.findOne(find, 'revisions').exec().then(function(content) {
        return content.revisions.id(revision_id)
      });
    } else {
      query = Job.findOne(find, '-revisions.content').exec();
    }
  } else {
    find.available = req.query.show_unavailable === 'true' ? { $ne: true } : true;
    query = Job.find(find, '-revisions').sort('created_at').exec();
  }
  query.then(function(content) {
    if (content === null) return next();
    res.send(content);
  }, function(error) {
    next(error);
  });
});

app.post('/jobs', function(req, res, next) {
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
  })
});

app.put('/jobs/:job_id', function(req, res, next) {
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
});

// put back
app.post('/jobs/:job_id', function(req, res, next) {
  Job.findOne({ _id: req.params.job_id, available: false }).exec(function(error, job) {
    if (error || !job) return next(error);
    job.available = true;
    job.save(function(error) {
      if (error) return next(error);
      res.send({ status: 'OK' });
    });
  });
});

app.delete('/jobs/:job_id', function(req, res, next) {
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
});

app.use(function(err, req, res, next) {
  res.status(err.status || 400);
  res.send({ error: err.toString() });
});

app.use(function(req, res) {
  res.status(404);
  res.send({ error: 'Page Not Found.' });
});

app.listen();
