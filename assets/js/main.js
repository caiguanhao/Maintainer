App = Ember.Application.create();

App.ApplicationRoute = Ember.Route.extend({
  actions: {
    error: function(error) {
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

App.JobsRoute = Ember.Route.extend({
  model: function() {
    return $.getJSON('/jobs');
  }
});

App.JobRoute = Ember.Route.extend({
  model: function(params) {
    return $.getJSON('/jobs/' + params.job_id);
  }
});

App.NotFoundRoute = Ember.Route.extend({
  redirect: function() {
    this.transitionTo('index');
  }
});
