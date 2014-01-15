App = Ember.Application.create();

App.ApplicationRoute = Ember.Route.extend({
  actions: {
    error: function(error) {
      alert(error);
      this.transitionToRoute('index');
    }
  }
});

App.Router.map(function() {
  this.resource('about');
  this.resource('jobs', function() {
    this.route('new');
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

App.ContentView = Ember.Component.extend(Ember.TextSupport, {
  tagName: 'p',
  placeholder: '',
  contenteditable: 'true',
  attributeBindings: [ 'contenteditable', 'placeholder' ],
  _elementValueDidChange: function() {
    Ember.set(this, 'value', this.$().text());
  }
});

App.TitleView = App.ContentView.extend({
  tagName: 'h1'
});

App.JobsNewController = Ember.Controller.extend({
  actions: {
    create_new_job: function() {
      $.post('/jobs', this.getProperties('title', 'content'))
       .then(function(new_job) {
        jobs.loadJobs().then(function(jobs) {
          jobs.addObject(new_job);
        });
      }, function(response) {
        var error = $.parseJSON(response.responseText);
        alert(error.error);
      });
    }
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
  },
  setupController: function(controller, model) {
    controller.set('job', model);
  }
});

App.JobController = Ember.Controller.extend({
  actions: {
    remove_job: function() {
      var self = this;
      var job = self.get('job');
      $.ajax({
        url: '/jobs/' + job._id,
        type: 'DELETE'
      }).then(function() {
        jobs.loadJobs().then(function(jobs) {
          jobs.removeObject(job);
          self.transitionToRoute('jobs');
        });
      }, function(response) {
        var error = $.parseJSON(response.responseText);
        alert(error.error);
      });
    }
  }
});

App.NotFoundRoute = Ember.Route.extend({
  redirect: function() {
    this.transitionToRoute('index');
  }
});
