var express = require('express');
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/maintainer');

var app = express();

app.set('port', 3000);
app.use(express.bodyParser());

var Job = require('./models/job');

app.get('/jobs/:job_id?', function(req, res, next) {
  var job_id = req.params.job_id;
  var find = {};
  if (job_id) {
    find._id = job_id;
  }
  Job.find(find).exec(function(error, jobs) {
    if (error) return next(error);
    res.send(jobs);
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
    published: job,
    revisions: [ job ],
    created_at: new Date()
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

app.use(express.static(__dirname + '/assets'));
app.use(express.static(__dirname + '/public'));

app.use(function(req, res) {
  res.status(404);
  res.send({ error: 'Page Not Found.' });
});

app.listen(app.get('port'), function() {
  console.log('Listening on port ' + app.get('port'));
});
