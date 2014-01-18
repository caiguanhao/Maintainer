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
  Job.findOne({ _id: bundle.job }, 'published.content', function(error, job) {
    var script = job.published.content.trim() + '\n';
    term.write(script);
  });
}

app.get('/jobs/:job_id?/:revision_id?', function(req, res, next) {
  var job_id = req.params.job_id;
  if (job_id) {
    var revision_id = req.params.revision_id;
    if (revision_id) {
      Job.findOne({ _id: job_id }, 'revisions').exec(function(error, job) {
        if (error) return next(error);
        for (var i = 0; i < job.revisions.length; i++) {
          if (job.revisions[i]._id == revision_id) {
            return res.send(job.revisions[i]);
          }
        }
        return next();
      });
    } else {
      Job.findOne({ _id: job_id }, '-revisions.content').exec(function(error, job) {
        if (error) return next(error);
        res.send(job);
      });
    }
  } else {
    Job.find({}, '_id published revision_count created_at updated_at').sort('created_at')
      .exec(function(error, jobs) {
      if (error) return next(error);
      res.send(jobs);
    });
  }
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
  Job.findOne({ _id: req.params.job_id }).exec(function(error, job) {
    if (error) return next(error);
    var updated_job = {
      title: title,
      content: content,
      created_at: new Date()
    }
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

app.delete('/jobs/:job_id', function(req, res, next) {
  Job.findOneAndRemove({ _id: req.params.job_id }).exec(function(error) {
    if (error) return next(error);
    res.send({ status: 'OK' });
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
