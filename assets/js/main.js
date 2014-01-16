/* extend jQuery's val() method to h1 */
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
    h1: get_set_val
  }
});

function set_title(title) {
  document.title = (title ? title + ' - ' : '') + 'Maintainer';
}

/* Ember.js */
App = Ember.Application.create();

Ember.Route.reopen({
  activate: function() {
    this._super();
    var title = this.get('title');
    if (!title) {
      title = this.routeName.replace(/\..*$/, '');
      title = Ember.String.capitalize(title);
    }
    set_title(title);
  }
});

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

App.IndexRoute = Ember.Route.extend({
  title: 'Home'
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

App.NavView = Ember.View.extend({
  tagName: 'li',
  classNameBindings: [ 'active' ],
  active: function() {
    return this.get('childViews.firstObject.active');
  }.property('childViews.firstObject.active')
});

App.TitleView = Ember.TextArea.extend({
  tagName: 'h1',
  contenteditable: 'true',
  attributeBindings: [ 'contenteditable' ]
});

App.CodeView = Ember.TextArea.extend({
  _CodeMirrorDidChange: function(editor) {
    Ember.set(editor._view, 'value', editor.getValue());
  },
  _CodeHorrorInit: Ember.observer('value', function() {
    var value = Ember.get(this, 'value'),
        $el = this.$(),
        $editor = $el.data('editor');
    if (!$editor) {
      $editor = CodeMirror.fromTextArea($el.get(0), {
        lineNumbers: true,
        indentWithTabs: false,
        tabSize: 2,
        lineWrapping: true
      });
      $editor._view = this;
      $editor.on('change', this._CodeMirrorDidChange, this);
      $el.data('editor', $editor);
    }
    if ($editor && value !== $editor.getValue()) {
      $editor.setValue(value || (this.get('placeholder') || ''));
    }
  }),
  init: function() {
    this._super();
    this.on("didInsertElement", this, this._CodeHorrorInit);
  }
});

App.JobsNewRoute = Ember.Route.extend({
  title: 'Create New Job'
});

App.JobsNewController = Ember.Controller.extend({
  untouched: true,
  touch: function() {
    this.set('untouched', !(this.get('title') && this.get('content')));
  }.observes('title', 'content'),
  actions: {
    create_new_job: function() {
      var self = this;
      self.set('untouched', true);
      $.post('/jobs', this.getProperties('title', 'content'))
       .then(function(new_job) {
        self.setProperties({
          title: '',
          content: ''
        });
        jobs.loadJobs().then(function(jobs) {
          jobs.addObject(new_job);
          self.transitionToRoute('job', new_job);
        });
      }, function(response) {
        self.set('untouched', false);
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
    set_title(job.published.title);
  }.observes('job.published.title', 'job.published.content'),
  actions: {
    update_job: function() {
      var self = this;
      var job = self.get('job');
      self.set('job.untouched', true);
      $.ajax({
        url: '/jobs/' + job._id,
        type: 'PUT',
        data: {
          title: job.published.title,
          content: job.published.content
        }
      }).then(function() {
        self.set('job._published', $.extend(true, {}, job.published));
      }, function(response) {
        self.set('job.untouched', false);
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
