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
    this.resource('job', { path: ':job_id' }, function() {
      this.resource('job_revisions', { path: 'revisions' }, function() {
        this.resource('job_revision', { path: ':revision_id' });
      });
    });
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
      $editor.on('change', this._CodeMirrorDidChange);
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

App.MergeView = Ember.View.extend({
  _CodeMirrorDidChange: function(editor) {
    Ember.set(editor._view, 'value', editor.getValue());
  },
  _CodeHorrorInitCommon: function() {
    var value = Ember.get(this, 'value') || '',
        orig = Ember.get(this, 'orig') || '',
        $el = this.$(),
        $editor = $el.data('editor');
    // CodeMirror does not allow changing content of orig
    // so it needs to be re-initialized.
    if (!$editor || orig !== $editor.right.orig.getValue()) {
      $el.empty();
      $editor = CodeMirror.MergeView($el.get(0), {
        value: value,
        origLeft: null,
        orig: orig,
        lineNumbers: true,
        highlightDifferences: true
      });
      $editor.edit._view = this;
      $editor.edit.on('change', this._CodeMirrorDidChange);
      $el.data('editor', $editor);
    }
    if ($editor && value !== $editor.edit.getValue()) {
      $editor.edit.setValue(value);
    }
  },
  _CodeHorrorInit: Ember.observer('value', function() {
    this._CodeHorrorInitCommon.call(this);
  }),
  _CodeHorrorInit2: Ember.observer('orig', function() {
    this._CodeHorrorInitCommon.call(this);
  }),
  init: function() {
    this._super();
    this.on("didInsertElement", this, this._CodeHorrorInit);
    this.on("didInsertElement", this, this._CodeHorrorInit2);
  }
});

App.RevisionSelect = Ember.Select.extend({
  _prevent_do_this_on_start: false,
  _change: function() {
    this._super();
    if (this.get('selection')) {
      this.get('controller').send('compare_revision', this.get('selection._id'));
    } else {
      if (this.get('_prevent_do_this_on_start')) {
        this.get('controller').send('close_revisions');
      }
    }
    this.set('_prevent_do_this_on_start', true);
  },
  _selectionDidChangeSingle: function() {
    this._super();
    if (this.get('_prevent_do_this_on_start')) {
      this._change();
    }
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
    if (job._content_to_compare === undefined) {
      job._content_to_compare = job._published.content;
    }
    if (job.untouched === undefined) {
      job.untouched = true;
    }
    if (job.useMergeView === undefined) {
      job.useMergeView = false;
    }
    if (job.showingRevisions === undefined) {
      job.showingRevisions = false;
    }
    controller.set('job', job);
  },
  afterModel: function(job) {
    var controller = this.get('controller');
    if (controller) {
      // resets everything when you go back to job route from other route
      controller.set('job._content_to_compare', controller.get('job._published.content'));
      controller.set('job.showingRevisions', false);
      // keep merge view
      // controller.set('job.useMergeView', false);
    }
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
        self.set('job._content_to_compare', job.published.content);

        // if we are in revisions page, reload the page:
        if (self.get('job.showingRevisions')) {
          self.transitionToRoute('job_revisions', job._id);
        }
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
    },
    close_revisions: function() {
      this.set('job._content_to_compare', this.get('job._published.content'));
      this.transitionToRoute('job', this.get('job._id'));
      this.set('job.showingRevisions', false);
    },
    show_revisions: function() {
      this.transitionToRoute('job_revisions', this.get('job._id'));
      this.set('job.showingRevisions', true);
    },
    toggle_show_revisions: function() {
      if (this.get('job.showingRevisions')) {
        this.send('close_revisions');
      } else {
        this.send('show_revisions');
      }
    },
    toggle_view: function() {
      this.set('job.useMergeView', !this.get('job.useMergeView'));
    }
  }
});

App.JobRevisionsController = Ember.Controller.extend({
  needs: 'job',

  selectionChanged: function() {
    this.set('job.revision_index', this.get('job.revisions').indexOf(this.get('selection')) + 1);
  }.observes('selection'),

  actions: {
    close_revisions: function() {
      this.transitionToRoute('job_revisions', this.get('job._id'));
    },
    compare_revision: function(id) {
      this.transitionToRoute('job_revision', id);
    },
    compare_revision_content: function(revision) {
      this.set('selection', this.get('job.revisions').findBy('_id', revision._id));
      this.set('controllers.job.job._content_to_compare', revision.content);
      this.set('controllers.job.job.useMergeView', true);
    },
    show_next_revision: function() {
      var selection = this.get('selection');
      if (selection) {
        var index = this.get('job.revisions').indexOf(selection);
        this.set('selection', this.get('job.revisions').nextObject(index+1));
      } else {
        this.set('selection', this.get('job.revisions.firstObject'));
      }
    }
  }
});

// http://jsperf.com/js-array-reverse-vs-while-loop/5
function for_swap_half_for_array_reverse(array) {
  var length = array.length;
  var left = null;
  var right = null;
  for (left = 0; left < length / 2; left += 1) {
      right = length - 1 - left;
      var temporary = array[left];
      array[left] = array[right];
      array[right] = temporary;
  }
}

App.JobRevisionsRoute = Ember.Route.extend({
  model: function() {
    var job = this.modelFor('job');
    return Ember.Deferred.promise(function(promise) {
      promise.resolve($.getJSON('/jobs/' + job._id).then(function(job) {
        for_swap_half_for_array_reverse(job.revisions);
        for (var i = 0; i < job.revisions.length; i++) {
          var rev = job.revisions[i];
          rev.display_title = '[' + rev.created_at.replace('T', ' ').replace(/\..*$/, '') + '] ';
          rev.display_title += rev.title;
          if (i === 0) {
            rev.display_title += ' (latest)';
          }
        }
        return job;
      }));
    });
  },
  setupController: function(controller, job) {
    job.revision_index = 0;
    controller.set('job', job);
    var parentController = controller.get('controllers.job');
    parentController.set('job._content_to_compare', parentController.get('job._published.content'));
    parentController.set('job.showingRevisions', true);
  }
});

App.JobRevisionController = Ember.Controller.extend({
  needs: 'job_revisions',
  actions: {
    compare_revision_content: function(revision) {
      this.get('controllers.job_revisions').send('compare_revision_content', revision);
    }
  }
});

App.JobRevisionRoute = Ember.Route.extend({
  model: function(revision) {
    var job = this.modelFor('job_revisions');
    return Ember.Deferred.promise(function(promise) {
      promise.resolve($.getJSON('/jobs/' + job._id + '/' + revision.revision_id).then(function(revision) {
        return revision;
      }));
    });
  },
  setupController: function(controller, revision) {
    controller.send('compare_revision_content', revision);
  }
});

App.NotFoundRoute = Ember.Route.extend({
  redirect: function() {
    this.transitionToRoute('index');
  }
});
