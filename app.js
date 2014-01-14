var express = require('express');

var app = express();

app.set('port', 3000);

var jobs = JSON.parse(require('fs').readFileSync('models/jobs.json'));

app.get('/jobs/:job_id?', function(req, res) {
  var job_id = req.params.job_id;
  if (job_id) {
    for (var i = 0; i < jobs.length; i++) {
      if (jobs[i].id == job_id) {
        res.send(jobs[i]);
        return;
      }
    }
    res.send(null);
  } else {
    res.send(jobs);
  }
});

app.use(express.static(__dirname + '/assets'));
app.use(express.static(__dirname + '/public'));

app.listen(app.get('port'), function() {
  console.log('Listening on port ' + app.get('port'));
});
