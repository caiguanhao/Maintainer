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

jQuery.ajaxPrefilter(function(options, originalOptions, xhr) {
  if (window.localStorage) {
    xhr.setRequestHeader('X-USER-ID', window.localStorage.user_id || '');
    xhr.setRequestHeader('X-USER-TOKEN', window.localStorage.token || '');
  }
});

function set_title(title) {
  document.title = (title ? title + ' - ' : '') + 'Maintainer';
}

// adding autofocus option to {{input}}
Ember.TextField.reopen({
  attributeBindings: ['autofocus']
});

Ember.Handlebars.helper('default', function(value, default_value) {
  return value || default_value;
});

Ember.Handlebars.helper('ternary', function(variable, check, yes, no) {
  return variable === check ? yes : no;
});

Ember.Handlebars.helper('match', function() {
  var variable = arguments[0];
  var length = arguments.length;
  arguments = Array.prototype.slice.call(arguments, 0, length - 1);
  var last = length - length % 2 - 1;
  var args = arguments.slice(1, last);
  var _else = arguments.slice(last)[0];
  for (var i = 0; i < args.length; i += 2) {
    if (variable == args[i]) {
      return args[i + 1];
    }
  }
  return _else;
});

/* Ember.js */
App = Ember.Application.create();

App._history = [];

// setting title to false in route to skip using title
Ember.Route.reopen({
  activate: function() {
    this._super();
    var title = this.get('title');
    if (title !== false) {
      if (!title) {
        title = this.routeName.replace(/\..*$/, '');
        title = Ember.String.capitalize(title);
      }
      set_title(title);
    }
    App._history.unshift(this.routeName);
    App._history.splice(3);
  }
});

App.ApplicationController = Ember.Controller.extend({
  logged_in: Ember.computed(function() {
    return !!(window.localStorage.user_id && window.localStorage.token);
  }),
  actions: {
    log_out: function() {
      window.localStorage.clear();
      this.set('logged_in', false);
      window.location.reload();
    }
  }
});

function handle_error(error, transition, originRoute) {
  switch (error.status) {
  case 403:
    if (window.localStorage) {
      window.localStorage.clear();
    }
    if (originRoute && originRoute.routeName) {
      App._history.unshift(originRoute.routeName);
    } else if (this.url) {
      App._history.unshift(this.url);
    }

    var trans = this.transitionToRoute || this.transitionTo;
    var to = [ 'login', { queryParams: { needed: true } } ];
    if (trans) {
      trans.apply(this, to);
    } else {
      var app_controller = App.__container__.lookup('controller:application');
      app_controller.transitionToRoute.apply(app_controller, to);
    }
    break;
  case 430:
    alert('You must be a root user before you can proceed.');
    break;
  default:
    if (error.responseJSON) {
      alert(error.responseJSON.error);
    } else {
      if (error.stack) {
        console.error(error.stack);
      } else if (typeof(error) === 'string') {
        alert(error);
      } else {
        alert('Unknown error.');
      }
    }
  }
}

App.ApplicationRoute = Ember.Route.extend({
  actions: {
    error: handle_error
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
      this.route('permissions');
    });
  });
  this.resource('users', function() {
    this.route('new');
    this.resource('user', { path: ':user_id' });
  });
  this.route('login');
  this.resource('not_found', { path: '/*path' });
});

App.IndexRoute = Ember.Route.extend({
  title: 'Home'
});

App.JobsNewRoute = Ember.Route.extend({
  title: 'Create New Job',
  beforeModel: function() {
    // don't create job in trash page.
    if (jobs.currentFilter) {
      throw 'Page Not Found.';
    }
  }
});

App.JobsNewController = Ember.Controller.extend({
  touched: false,

  touch: function() {
    this.set('touched', (this.get('title') && this.get('content')));
  }.observes('title', 'content'),

  set_untouched: function() {
    this.set('untouched', !this.get('touched'));
  }.observes('touched'),

  actions: {
    create_new_job: function() {
      var self = this;
      self.set('touched', false);
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
      }, function(error) {
        self.set('touched', true);
        handle_error.call(self, error);
      });
    }
  }
});

App.Jobs = Ember.Object.extend({

  loadedJobs: false,

  jobs: [],

  currentFilter: null,

  loadJobs: function(params) {
    var query = null;
    var filter = null;
    if (params) {
      filter = params.filter;
    } else {
      filter = this.get('currentFilter');
    }
    if (filter !== this.get('currentFilter')) {
      this.set('loadedJobs', false);
      this.set('currentFilter', filter);
    }
    if (filter === 'trashed') {
      query = { show_unavailable: true };
    }

    var self = this;
    return Ember.Deferred.promise(function(promise) {
      if (self.get('loadedJobs')) {
        promise.resolve(self.get('jobs'));
      } else {
        promise.resolve($.getJSON('/jobs', query).then(function(jobs) {
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

var jobs = App.Jobs.create();

App.JobIndexRoute = Ember.Route.extend({
  title: false
});

App.JobsController = Ember.ArrayController.extend({
  needs: 'application',

  queryParams: [ 'filter' ],
  filter: null,

  // this may be a ember bug, so use a temporary fix
  // when you are in job route viewing a job details page
  // if you change the job filter, it will not trigger the query params change.
  temporary_fix: function() {
    if (this.get('controllers.application.currentPath').indexOf('jobs') !== -1) {
      this.send('queryParamsDidChange');
    }
  }.observes('controllers.application.currentPath')

});

App.JobsRoute = Ember.Route.extend({
  model: function(params) {
    return jobs.loadJobs(params);
  },
  actions: {
    open_terminal: function() {
      new TerminalWindow();
    },
    queryParamsDidChange: function() {
      this.refresh();
    }
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
    if (job.touched === undefined) {
      job.touched = false;
    }
    if (job.useMergeView === undefined) {
      job.useMergeView = false;
    }
    controller.set('job', job);
  },
  afterModel: function(job) {
    var controller = this.get('controller');
    if (controller) {
      // resets content when you go back to job route from other route
      controller.set('job._content_to_compare', controller.get('job._published.content'));
    }
  }
});

App.JobController = Ember.Controller.extend({
  needs: 'application',
  touch: function() {
    var self = this;
    var job = self.get('job');
    if (!job.available) return;
    self.set('job.touched', false);
    $.each(job._published, function(key, val) {
      if (val !== job.published[key]) {
        self.set('job.touched', true);
        return false;
      }
    });
    set_title(job.published.title);
  }.observes('job.published.title', 'job.published.content'),

  set_untouched: function() {
    this.set('job.untouched', !this.get('job.touched'));
  }.observes('job.touched'),

  is_showing_revisions: function() {
    if (!this.get('job')) return;
    var currentPath = this.get('controllers.application.currentPath');
    if (currentPath && currentPath.indexOf('job_revisions') >= 0) {
      this.set('job.showingRevisions', true);
    } else {
      this.set('job.showingRevisions', false);
    }
    if (currentPath && currentPath.indexOf('permissions') >= 0) {
      this.set('job.showingPermissions', true);
    } else {
      this.set('job.showingPermissions', false);
    }
  }.observes('controllers.application.currentPath', 'job'),
  // observe: path changes, same path but different job

  actions: {
    update_job: function() {
      var self = this;
      var job = self.get('job');
      self.set('job.touched', false);
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
        self.incrementProperty('job.revision_count');
        // if we are in revisions page, reload the page:
        if (self.get('job.showingRevisions')) {
          self.transitionToRoute('job_revisions', job._id);
        }
      }, function(response) {
        self.set('job.touched', true);
        var error = $.parseJSON(response.responseText);
        alert(error.error);
      });
    },
    reset_job: function() {
      this.set('job.published', $.extend(true, {}, this.get('job._published')));
      this.set('job.touched', false);
    },
    remove_job: function() {
      var self = this;
      var job = self.get('job');
      if (job.available !== true) {
        if (!confirm('Are you sure you want to permanently remove this job? ' +
          'All data of this job will be deleted and cannot be recovered.')) return;
      }
      $.ajax({
        url: '/jobs/' + job._id,
        type: 'DELETE'
      }).then(function() {
        if (job.available) {
          self.transitionToRoute('job', job._id, { queryParams: { filter: 'trashed' } });
        } else {
          jobs.loadJobs().then(function(jobs) {
            jobs.removeObject(job);
            self.transitionToRoute('jobs');
          });
        }
      }, function(response) {
        var error = $.parseJSON(response.responseText);
        alert(error.error);
      });
    },
    put_back: function() {
      var self = this;
      var job = self.get('job');
      $.ajax({
        url: '/jobs/' + job._id,
        type: 'POST'
      }).then(function() {
        self.transitionToRoute('job', job._id, { queryParams: { filter: null } });
      }, function(response) {
        var error = $.parseJSON(response.responseText);
        alert(error.error);
      });
    },
    close_revisions: function() {
      this.set('job._content_to_compare', this.get('job._published.content'));
      this.transitionToRoute('job', this.get('job._id'));
    },
    show_revisions: function() {
      this.transitionToRoute('job_revisions', this.get('job._id'));
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
    },
    run_script: function() {
      new TerminalWindow(null, {
        bundle: {
          job: this.get('job._id')
        },
        hideBundleOutput: true,
        keepSendingBundleOnStartOfAllTabs: false
      });
    },
    edit_permissions: function() {
      if (this.get('job.showingPermissions')) {
        this.transitionToRoute('job', this.get('job._id'));
      } else {
        this.transitionToRoute('job.permissions', this.get('job._id'));
      }
    }
  }
});

App.JobRevisionsController = Ember.Controller.extend({
  needs: 'job',

  selectionChanged: function() {
    this.set('job.revision_index', this.get('job.revisions').indexOf(this.get('selection')) + 1);
  }.observes('selection'),

  actions: {
    return_to_job: function() {
      this.set('controllers.job.job._content_to_compare',
        this.get('controllers.job.job._published.content'));
      this.transitionToRoute('job', this.get('job._id'));
    },
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

App.JobRevisionsIndexRoute = Ember.Route.extend({
  title: false
});

App.JobRevisionsRoute = Ember.Route.extend({
  title: false,
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
  },
  renderTemplate: function() {
    this.render({ outlet: 'for_revisions' });
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
  title: false,
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

App.JobPerms = Ember.Object.extend(Ember.ActionHandler, {
  job_id: null,
  load: function() {
    var job_id = this.get('job_id');
    return $.post('/jobs/' + job_id + '/permissions');
  },
  reload: function(cb) {
    var self = this;
    this.get('load').call(this).then(function(data) {
      self.set('_controller.permissions', data.permissions);
      if (cb) cb();
    }, handle_error);
  }
});

var job_perms = App.JobPerms.create();

App.JobPermissionsController = Ember.Controller.extend({
  needs: 'job',
  untouched: true,
  touch: function() {
    this.set('untouched', true);
    this.set('user_id', '');
    if (!this.get('username')) {
      this.get('_find_user_input_view').$().typeahead('setQuery', '');
    }
  }.observes('username'),
  actions: {
    grant_permissions: function(bits) {
      var self = this;
      var user_id = this.get('user_id');
      if (!user_id) return;
      $.ajax({
        url: '/jobs/' + this.get('controllers.job.job._id') + '/permissions',
        type: 'PUT',
        data: {
          user: user_id,
          bits: bits
        }
      }).then(function() {
        job_perms.reload(function() {
          self.set('user_id', '');
          self.set('username', '');
        });
      }, handle_error);
    },
    edit_user: function(user) {
      this.set('username', user.username);
      this.set('user_id', user._id);
      this.set('untouched', false);
      this.get('_find_user_input_view').send('trigger_dropdown');
    }
  }
});

App.JobPermissionsRoute = Ember.Route.extend({
  title: false,
  model: function() {
    job_perms.set('job_id', this.modelFor('job')._id);
    return job_perms.load();
  },
  setupController: function(controller, job) {
    controller.set('permissions', job.permissions);
    job_perms.set('_controller', controller);
  },
  renderTemplate: function() {
    this.render({ outlet: 'for_permissions' });
  }
});

App.User = Ember.Object.extend(Ember.ActionHandler, {
  load_users: function() {
    var self = this;
    return Ember.Deferred.promise(function(promise) {
      if (self.get('users')) {
        promise.resolve(self.get('users'));
      } else {
        promise.resolve($.getJSON('/users').then(function(users) {
          self.setProperties({
            users: users
          });
          return users;
        }, handle_error));
      }
    });
  },
  reload: function(controller, callback) {
    this.set('users', null);
    this.get('load_users').call(this).then(function(users) {
      controller.set('content', users);
      if (callback) callback();
    });
  }
});

var users = App.User.create();

App.UsersRoute = Ember.Route.extend({
  model: function() {
    return users.load_users();
  }
});

App.UsersController = Ember.ArrayController.extend({});

App.UserRoute = Ember.Route.extend({
  model: function(params) {
    return users.load_users().then(function(users) {
      var user = users.findBy('_id', params.user_id);
      if (user) {
        return user;
      } else {
        throw 'User does not exist.';
      }
    });
  },
  serialize: function(user, params) {
    return { user_id: user._id };
  }
});

App.UserController = Ember.ObjectController.extend({
  needs: 'users',

  untouched_pwd: true,
  touch_pwd: function() {
    this.set('untouched_pwd', !this.get('password'));
  }.observes('password'),

  // don't do this: _username: null,
  untouched_uname: true,
  touch_uname: function() {
    if (!this.get('_username')) {
      this.set('_username', this.get('username'));
    }
    this.set('untouched_uname', !(this.get('username') && this.get('_username') !== this.get('username')));
  }.observes('username'),

  actions: {
    generate_password: function() {
      var random_password = Math.random().toString(36).slice(-8); // from stackoverflow
      this.set('password', random_password);
    },
    change_password: function() {
      this.send('change_user', 'password', this.getProperties('password'));
    },
    refresh_token: function() {
      this.send('change_user', 'token', null);
    },
    change_username: function() {
      this.send('change_user', 'username', this.getProperties('username'));
    },
    ban_user: function() {
      this.send('change_user', 'ban', null);
    },
    change_user: function(change_what, data) {
      var self = this;
      var user_id = this.get('content._id');
      $.ajax({
        url: '/users/' + user_id + '/' + change_what,
        type: 'PUT',
        data: data
      }).then(function(user) {
        // update parent controller data:
        var users = self.get('controllers.users.content');
        var user_index = users.indexOf(users.findBy('_id', user_id));
        users.replace(user_index, 1, [user]);
        // update self controller data:
        self.set('content', user);
        self.set('_username', user.username);
      }, handle_error);
    },
    remove_user: function() {
      var self = this;
      var user_id = this.get('content._id');
      if (!confirm('Are you sure you want to permanently remove this user? ' +
          'All data of this user will be deleted and cannot be recovered.')) return;
      $.ajax({
        url: '/users/' + user_id,
        type: 'DELETE'
      }).then(function(user) {
        var users = self.get('controllers.users.content');
        users.removeObject(users.findBy('_id', user_id));
        self.transitionToRoute('users');
      }, handle_error);
    }
  }
});

App.UsersNewController = Ember.Controller.extend({
  needs: 'users',
  untouched: true,
  touch: function() {
    this.set('untouched', !(this.get('username') && this.get('password')));
  }.observes('username', 'password'),
  actions: {
    generate_password: function(view) {
      var random_password = Math.random().toString(36).slice(-8); // from stackoverflow
      this.set('password', random_password);
    },
    create_user: function() {
      var self = this;
      $.post('/users', this.getProperties('username', 'password')).then(function(user) {
        users.reload(self.get('controllers.users'), function() {
          self.setProperties({
            username: '',
            password: '',
          });
          self.transitionToRoute('user', user._id);
        });
      }, handle_error);
    }
  }
});

App.LoginRoute = Ember.Route.extend({
  setupController: function(controller, params) {
    if (params && params.needed) {
      controller.set('error_message', 'You need to log in first.');
    } else {
      controller.set('error_message', null);
    }
    controller.setProperties({
      username: '',
      password: ''
    });
  }
});

App.LoginController = Ember.Controller.extend({
  queryParams: [ 'needed' ],
  needed: false,
  needs: 'application',
  untouched: true,
  touch: function() {
    if (this.get('username') && this.get('password')) {
      this.set('untouched', false);
      this.set('error_message', null);
    } else {
      this.set('untouched', true);
    }
  }.observes('username', 'password'),
  login_needed: function() {
    this.set('needed', false);
  }.observes('needed'),
  error_message: null,
  actions: {
    log_in: function() {
      var self = this;
      $.post('/login', this.getProperties('username', 'password'))
       .then(function(token) {
        self.set('controllers.application.logged_in', true);
        $.each(token, function(key, val) {
          if (typeof(val) === 'string') {
            window.localStorage[key] = val;
          }
        });
        try {
          var previous = App._history[0];
          if (previous === 'login') previous = App._history[1];
          self.transitionToRoute(previous);
        } catch(error) {
          self.transitionToRoute('index');
        }
      }, function(error) {
        self.set('error_message', error.responseJSON.error);
        self.set('password', null);
      });
    },
    dismiss: function() {
      this.set('error_message', null);
    }
  }
});

App.NotFoundRoute = Ember.Route.extend({
  setupController: function(controller) {
    controller.transitionToRoute('index');
  }
});

/* Ember Views */

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

App.FindUserInputView = Ember.TextField.extend({
  didInsertElement: function() {
    var self = this;
    this.set('targetObject._find_user_input_view', this);
    this.$().typeahead({
      name: 'user',
      remote: '/search/users/%QUERY',
      valueKey: 'username'
    });
    this.$().on('typeahead:selected typeahead:autocompleted', function(e, user, datum) {
      self.get('targetObject').send('edit_user', user);
      self.$().trigger('blur');
      self.send('trigger_dropdown');
    });
  },
  actions: {
    trigger_dropdown: function() {
      var self = this;
      setTimeout(function() {
        // don't use dropdown('toggle') cause it will break ember's bindings
        self.$().closest('.search-user').find('.input-group-btn').addClass('open');
      }, 100);
    }
  }
});
