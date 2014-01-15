/* extend jQuery's val() method to h1 and p */
var get_set_val = {
  get: function(elem) {
    return $(elem).text();
  },
  set: function(elem, value) {
    return $(elem).text(value);
  }
};

jQuery.extend({
  valHooks: {
    h1: get_set_val,
    p: get_set_val
  }
});

/* Ember.js */
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

App.Jobs = Ember.Object.extend({
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

App.ContentView = Ember.TextArea.extend({
  tagName: 'p',
  contenteditable: 'true',
  attributeBindings: [ 'contenteditable' ]
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

var jobs = App.Jobs.create();

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
  serialize: function(job, params) {
    return { job_id: job._id };
  },
  setupController: function(controller, job) {
    if (job._published === undefined) {
      job._published = $.extend(true, {}, job.published);
    }
    if (job.untouched === undefined) {
      job.untouched = true;
    }
    controller.set('job', job);
  }
});

App.JobController = Ember.Controller.extend({
  touch: function() {
    var self = this;
    var job = self.get('job');
    self.set('job.untouched', true);
    $.each(job._published, function(key, val) {
      if (val !== job.published[key]) {
        self.set('job.untouched', false);
        return false;
      }
    });
  }.observes('job.published.title', 'job.published.content'),
  actions: {
    update_job: function() {
      var self = this;
      var job = self.get('job');
      $.ajax({
        url: '/jobs/' + job._id,
        type: 'PUT',
        data: {
          title: job.published.title,
          content: job.published.content
        }
      }).then(function() {
        self.set('job._published', $.extend(true, {}, job.published));
        self.set('job.untouched', true);
      }, function(response) {
        var error = $.parseJSON(response.responseText);
        alert(error.error);
      });
    },
    reset_job: function() {
      this.set('job.published', $.extend(true, {}, this.get('job._published')));
      this.set('job.untouched', true);
    },
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
