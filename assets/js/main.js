App = Ember.Application.create();

App.ApplicationRoute = Ember.Route.extend({
  actions: {
    error: function(error) {
      alert(error);
      this.transitionTo('index');
    }
  }
});

App.Router.map(function() {
  this.resource('about');
  this.resource('jobs', function() {
    this.resource('job', { path: ':job_id' });
  });
  this.resource('not_found', { path: '/*path' });
});

App.Job = Ember.Object.extend({
  loadedJobs: false,
  loadJobs: function() {
    var self = this;
    return Ember.Deferred.promise(function(promise) {
      if (self.get('loadedJobs')) {
        promise.resolve(self.get('jobs'));
      } else {
        promise.resolve($.getJSON('/jobs').then(function(jobs) {
          self.setProperties({
            jobs: jobs,
            loadedJobs: true
          });
          return jobs;
        }));
      }
    });
  }
});

var jobs = App.Job.create();

App.JobsRoute = Ember.Route.extend({
  model: function() {
    return jobs.loadJobs();
  }
});

App.JobRoute = Ember.Route.extend({
  model: function(params) {
    return jobs.loadJobs().then(function(jobs) {
      var job = jobs.findBy('_id', params.job_id);
      if (job) {
        return job;
      } else {
        throw 'Job does not exist.';
      }
    });
  },
  serialize: function(model, params) {
    return { job_id: model._id };
  }
});

App.NotFoundRoute = Ember.Route.extend({
  redirect: function() {
    this.transitionTo('index');
  }
});
