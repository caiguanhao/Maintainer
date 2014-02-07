function Introduction() {
/*!
### Maintainer

Maintainer is a single-page web application managing routine scripts
that may run on local or remote server. Jobs that created by a root
user can be set with different permissions to allow other users to
execute the jobs on their own. The job is some shell scripts that can
be executed on Linux server, and for the root user, you can also use
the browser terminal to access the server just like you are using
your system's GUI terminal app.

Maintainer is built with Node.js and Ember.js, meaning the whole
application is written in JavaScript, though some dependencies may
use other languages, too. The app uses Mongoose.js, a MongoDB object
modeling tool, to organize the app data and implements tty.js, a
browser terminal created with Socket.IO and Express, to create a
multi-user terminal interface.

This project is hosted on GitHub. You can get help from the Help
page.
*/
  return get_first_multiline_comments(arguments.callee.toString());
}

function Footer() {
/*!
Copyright (C) 2014 caiguanhao. View Maintainer on
[GitHub](https://github.com/caiguanhao/Maintainer).
*/
  return get_first_multiline_comments(arguments.callee.toString());
}

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
  if (LoggedInUsers && LoggedInUsers.current_user) {
    xhr.setRequestHeader('X-USER-ID', LoggedInUsers.current_user.id || '');
    xhr.setRequestHeader('X-USER-TOKEN', LoggedInUsers.current_user.token || '');
  }
  if (options.prefilter) {
    options.prefilter(options, originalOptions, xhr);
  }
});

function set_title(title) {
  document.title = (title ? title + ' - ' : '') + 'Maintainer';
}

function get_first_multiline_comments(content) {
  var comments = content.match(/\/\*!?([\S\s]*?)\*\//);
  return comments ? comments[1] : '';
}

// adding autofocus option to {{input}}
Ember.TextField.reopen({
  attributeBindings: ['autofocus']
});

Ember.Handlebars.helper('default', function(value, default_value, delimiter) {
  if (value instanceof Array) value = value.join(delimiter);
  return new Handlebars.SafeString(value || default_value);
});

Ember.Handlebars.helper('ternary', function(variable, check, yes, no) {
  return variable === check ? yes : no;
});

Ember.Handlebars.helper('plural', function(amount, singular, plural) {
  return amount + ' ' + (amount >= 2 ? plural : singular);
});

Ember.Handlebars.helper('markdown', function(content) {
  content = content.replace(/^---(.|\n)*---\n/, '');
  return new Handlebars.SafeString(markdown.toHTML(content, 'Maruku'));
});

Ember.Handlebars.helper('markdown_from_function', function(func) {
  var content = func ? window[func]() : '';
  return new Handlebars.SafeString(markdown.toHTML(content, 'Maruku'));
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

Ember.Handlebars.helper('string', function(method, str) {
  return Ember.String[method](str);
});

function fmtdate(date) {
  if (!date) return '(unknown)';
  return moment(date).format("YYYY-MM-DD HH:mm:ss");
}

Ember.Handlebars.helper('fmtdate', fmtdate);

/* Ember.js */
App = Ember.Application.create({
  Visibility: {},
  SetVisibiltyForUser: function(user) {
    var is_root = false;
    var is_user = !!user;
    if (user) {
      is_root = user.is_root;
    }
    this.set('Visibility.JobsNavBarLink', is_user);
    this.set('Visibility.JobsCreate', is_root);
    this.set('Visibility.JobsOpenTerminal', is_root);
    this.set('Visibility.JobsPermissions', is_root);
    this.set('Visibility.UsersNavBarLink', is_root);
  }
});

function find_view_by_viewname(name) {
  var views = Ember.View.views;
  for (var id in views) {
    var view = views[id];
    if (view.viewName === name) {
      return view;
    }
  }
  return null;
}

App.History = Ember.Object.create({
  Add: function(route_name) {
    if (!this.get('history')) this.set('history', []);

    if (route_name.indexOf('login') > -1) return;

    this.get('history').unshiftObject(route_name);
    this.get('history').splice(3);
  },
  GetPrevious: function() {
    return this.get('history')[0];
  }
});

App.Terminals = Ember.Object.create({
  Windows: [],
  Create: function(options) {
    var new_window = new TerminalWindow(null, options);
    this.get('Windows').addObject(new_window);
  },
  DestroyAll: function() {
    this.get('Windows').forEach(function(Window) {
      Window.destroy();
    });
  }
});

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
    App.History.Add(this.router.get('url'));
  }
});

App.ObjectsNeedToReloadDueToCurrentUserChanges = Ember.Object.create({
  Add: function(what) {
    if (this.get('objects') === undefined) this.set('objects', []);
    this.get('objects').addObject(what);
  },
  ReloadAll: function() {
    if (this.get('objects') === undefined) return;
    this.get('objects').forEach(function(object) {
      object.get('reload').call(object);
    });
  }
});

App.ObjectNeedsAuthentication = Ember.Object.extend(Ember.ActionHandler, {
  init: function() {
    App.ObjectsNeedToReloadDueToCurrentUserChanges.Add(this);
  }
});

App.LoggedInUsers = Ember.Object.extend(Ember.ActionHandler, {
  init: function() {
    var users = [];
    if (window.localStorage && window.localStorage.users) {
      try {
        users = JSON.parse(window.localStorage.users);
        if (!(users instanceof Array)) users = [];
      } catch(e) {
        users = [];
      }
    }
    this.set('users', users);

    var current_user = null;
    if (window.localStorage && window.localStorage.current_user) {
      try {
        current_user = JSON.parse(window.localStorage.current_user);
        if (typeof(current_user) !== 'object') current_user = null;
      } catch(e) {
        current_user = null;
      }
    }
    this.set('current_user', current_user);

    try {
      window.UPDATE_THEME(current_user.preferences.theme);
    } catch(e) {}

    App.SetVisibiltyForUser(current_user);
  },
  current_users_did_changed: function() {
    var current_user = this.get('current_user');
    try {
      window.UPDATE_THEME(current_user.preferences.theme);
    } catch(e) {}
    if (window.localStorage) {
      window.localStorage.current_user = JSON.stringify(this.get('current_user'));
    }
    App.SetVisibiltyForUser(this.get('current_user'));
    App.ObjectsNeedToReloadDueToCurrentUserChanges.ReloadAll();
    App.Terminals.DestroyAll();
  }.observes('current_user.token'),
  users_did_changed: function() {
    if (window.localStorage) {
      window.localStorage.users = JSON.stringify(this.get('users'));
    }
  }.observes('users.length'),

  add_user_only: function(user) {
    var id = user._id;
    var users = this.get('users');
    users.removeObject(users.findBy('id', id));
    users.unshiftObject({
      id: id,
      name: user.username,
      token: user.token,
      is_root: user.is_root,
      preferences: user.preferences
    });
  },
  add_user: function(user) {
    var id = user._id;
    this.add_user_only(user);
    this.select_user_by_id(id);
  },
  update_current_user: Ember.aliasMethod('add_user'),

  remove_current_user_when_expired: function(callbacks) {
    var current_user = this.get('current_user');
    if (!current_user || !current_user.id) return;
    var users = this.get('users');
    users.removeObject(users.findBy('id', current_user.id));
    var new_user = users[0];
    this.set('current_user', new_user);
    if (new_user) {
      callbacks.switched_to_new_user(current_user, new_user);
    } else {
      callbacks.if_no_user_left();
    }
    App.Terminals.DestroyAll();
  },
  remove_user_by_id: function(id) {
    var users = this.get('users');
    var user = users.findBy('id', id);
    users.removeObject(user);
    if (this.get('current_user.id') === id) {
      this.set('current_user', users[0]);
    }
    this.reset_user_token(user);
  },
  remove_all_users: function() {
    this.get('users').forEach(this.reset_user_token);
    this.set('users', []);
    this.set('current_user', null);
  },
  select_user_by_id: function(id) {
    var users = this.get('users');
    var user = users.findBy('id', id);
    this.set('current_user', user);
    // move object to front
    users.unshiftObject(Ember.copy(user, true));
    users.removeObject(user);
  },
  reset_user_token: function(user) {
    $.ajax({
      url: '/login',
      type: 'DELETE',
      prefilter: function(options, originalOptions, xhr) {
        xhr.setRequestHeader('X-USER-ID', user.id);
        xhr.setRequestHeader('X-USER-TOKEN', user.token);
      }
    });
  }
});

var LoggedInUsers = App.LoggedInUsers.create();

App.ApplicationController = Ember.Controller.extend({

  LoggedInUsers: LoggedInUsers,

  actions: {
    switch_user: function(id) {
      LoggedInUsers.select_user_by_id(id);
    },
    log_out: function(id) {
      if (id) {
        LoggedInUsers.remove_user_by_id(id);
      } else {
        LoggedInUsers.remove_all_users();
      }
    }
  }
});

function handle_error(error, transition, originRoute) {
  var self = this;
  function transitionTo() {
    var trans = self.transitionToRoute || self.transitionTo;
    if (trans) {
      trans.apply(self, arguments);
    } else {
      var app_controller = App.__container__.lookup('controller:application');
      app_controller.transitionToRoute.apply(app_controller, arguments);
    }
  }
  var error_obj = {};
  try { error_obj = JSON.parse(error.responseText); } catch(e) {}
  switch (error.status) {
  case 401:
    var err_msg = 'Invalid username or password.';
    if (error_obj.attempts_left > 0) {
      err_msg += ' You have ' + error_obj.attempts_left +
        ' more attempts before your account is locked.';
    } else if (error_obj.attempts_left === 0) {
      err_msg += ' Sorry, the account has been locked temporarily.';
    }
    alert(err_msg);
    break;
  case 403:
    if (originRoute && originRoute.routeName) {
      App.History.Add(originRoute.routeName);
    } else if (this.url) {
      App.History.Add(this.url);
    }
    if (LoggedInUsers.current_user) {
      LoggedInUsers.remove_current_user_when_expired({
        switched_to_new_user: function(old_user, new_user) {
          alert('The session of your previous account "' + old_user.name +
            '" has expired. The current user is now switched to "' +
            new_user.name + '".');
        },
        if_no_user_left: function() {
          transitionTo('login', { queryParams: { 
            needed: 'Your session has expired. Please login again.' } });
        }
      });
    } else {
      transitionTo('login', { queryParams: { needed: true } });
    }
    break;
  case 429:
    alert('The account is temporarily locked due to too many failed login ' +
      'attempts and it will be unlocked ' + moment(error_obj.until).fromNow() +
      '.');
    break;
  case 430:
    transitionTo('login', { queryParams: { 
      needed: 'You must be a root user before you can proceed. Otherwise, ' +
      'go back to previous page.' } });
    break;
  case 488:
    alert('You don\'t have enough permissions to make this request.');
    break;
  case 499:
    alert('You can\'t change a root user.');
    break;
  default:
    if (error.message && error.transitionTo) {
      // alert(error.message);
      transitionTo.apply(this, error.transitionTo);
    } else if (error.responseJSON) {
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
  this.resource('help', function() {
    this.resource('help_topic', { path: ':help_topic' });
  });
  this.route('profile');
  this.route('login');
  this.resource('not_found', { path: '/*path' });
});

function in_route_of(route) {
  var currentPath = App.__container__.lookup('controller:application').currentPath;
  return !!(currentPath && currentPath.replace(/\..*$/, '') === route);
}

App.IndexRoute = Ember.Route.extend({
  title: 'Home'
});

App.JobsNewRoute = Ember.Route.extend({
  title: 'Create New Job'
});

App.JobsNewController = Ember.Controller.extend({
  needs: 'jobs',
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
        Jobs.set('filter', null);
        self.set('controllers.jobs.filter', null);
        Jobs.reload_jobs(self.get('controllers.jobs'), function() {
          self.setProperties({
            title: '',
            content: ''
          });
          self.transitionToRoute('job', new_job);
        });
      }, function(error) {
        self.set('touched', true);
        handle_error.call(self, error);
      });
    }
  }
});

App.JobsIndexController = Ember.Controller.extend({
  needs: 'jobs',
  job_count: function() {
    return this.get('controllers.jobs.content.length');
  }.property('controllers.jobs.content.length')
});

App.Jobs = App.ObjectNeedsAuthentication.extend({

  load_jobs: function() {
    var query = null;
    if (this.get('filter') === 'trashed') {
      query = { show_unavailable: true };
    }
    var self = this;
    return Ember.Deferred.promise(function(promise) {
      if (self.get('jobs')) {
        promise.resolve(self.get('jobs'));
      } else {
        promise.resolve($.getJSON('/jobs', query).then(function(jobs) {
          self.setProperties({
            jobs: jobs
          });
          return jobs;
        }, handle_error));
      }
    });
  },
  reload_jobs: function(controller, callback) {
    this.set('jobs', null);
    this.get('load_jobs').call(this).then(function(jobs) {
      if (controller) controller.set('content', jobs);
      if (callback) callback();
    });
  },
  reload: function() {
    this.set('jobs', null);
    if (in_route_of('jobs')) {
      this.get('load_jobs').call(this).then(function(jobs) {
        App.__container__.lookup('controller:jobs').set('content', jobs);
        App.__container__.lookup('controller:jobs').transitionToRoute('jobs');
      });
    }
  }
});

var Jobs = App.Jobs.create();

App.JobsController = Ember.ArrayController.extend({
  needs: 'application',

  queryParams: [ 'filter' ],
  filter: null,

  // this may be a ember bug, so use a temporary fix
  // when you are in job route viewing a job details page
  // if you change the job filter, it will not trigger the query params change.
  temporary_fix: function() {
    if (this.get('controllers.application.currentPath').indexOf('jobs') !== -1) {
      this.send('queryParamsDidChange', { 'jobs[filter]': this.get('filter') });
    }
  }.observes('controllers.application.currentPath')

});

App.JobsRoute = Ember.Route.extend({
  model: function(params) {
    params = params || {};
    Jobs.set('filter', params.filter);
    return Jobs.load_jobs();
  },
  actions: {
    open_terminal: function() {
      App.Terminals.Create({
        bundle: {
          user_id: LoggedInUsers.current_user.id,
          user_token: LoggedInUsers.current_user.token
        },
        hideBundleOutput: false
      });
    },
    queryParamsDidChange: function(params_changed) {
      var self = this;
      if (params_changed && params_changed.hasOwnProperty('jobs[filter]')) {
        Jobs.set('filter', params_changed['jobs[filter]']);
        Jobs.reload_jobs(null, function() {
          self.refresh();
        });
      }
    }
  }
});

App.JobRoute = Ember.Route.extend({
  model: function(params) {
    return Jobs.load_jobs().then(function(jobs) {
      var job = jobs.findBy('_id', params.job_id);
      if (job) {
        return job;
      } else {
        Jobs.setProperties({
          jobs: null,
          filter: null
        });
        throw {
          message: 'Job does not exist.',
          transitionTo: [ 'index' ]
        };
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
  needs: [ 'application', 'jobs' ],
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
      }, function(error) {
        self.set('job.touched', true);
        handle_error.call(self, error);
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
          Jobs.reload_jobs(self.get('controllers.jobs'), function() {
            self.transitionToRoute('jobs');
          });
        }
      }, handle_error);
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
      App.Terminals.Create({
        bundle: {
          user_id: LoggedInUsers.current_user.id,
          user_token: LoggedInUsers.current_user.token,
          job: this.get('job._id')
        },
        hideBundleOutput: true,
        removeBundleKeysForOtherTabs: [ 'job' ]
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
          rev.display_title = '[' + fmtdate(rev.created_at) + '] ';
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
    grant_permissions: function(bits, confirm_message) {
      if (confirm_message && !confirm(confirm_message.replace(/\s{2,}/g, ' '))) {
        return;
      }
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
      if (!user) {
        return alert('User is unavailable and may have been removed.');
      }
      this.set('username', user.username);
      this.set('user_id', user._id);
      this.set('untouched', false);
      this.get('_find_user_input_view').send('trigger_dropdown');
    },
    remove_all_permissions: function() {
      var self = this;
      $.ajax({
        url: '/jobs/' + this.get('controllers.job.job._id') + '/permissions',
        type: 'DELETE'
      }).then(function() {
        job_perms.reload(function() {
          self.set('user_id', '');
          self.set('username', '');
        });
      }, handle_error);
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

App.User = App.ObjectNeedsAuthentication.extend({
  init: function() {
    this._super();
  },
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
  reload_users: function(controller, callback) {
    this.set('users', null);
    this.get('load_users').call(this).then(function(users) {
      if (controller) controller.set('content', users);
      if (callback) callback();
    });
  },
  reload: function() {
    this.set('users', null);
    if (in_route_of('users')) {
      this.get('load_users').call(this);
    }
  }
});

var Users = App.User.create();

App.UsersRoute = Ember.Route.extend({
  model: function() {
    return Users.load_users();
  }
});

App.UsersController = Ember.ArrayController.extend({});

App.UsersIndexController = Ember.Controller.extend({
  needs: 'users',
  user_count: function() {
    return this.get('controllers.users.content.length')
  }.property('controllers.users.content.length')
});

App.UserRoute = Ember.Route.extend({
  model: function(params) {
    return Users.load_users().then(function(users) {
      var user = users.findBy('_id', params.user_id);
      if (user) {
        return user;
      } else {
        throw {
          message: 'User does not exist.',
          transitionTo: [ 'index' ]
        };
      }
    });
  },
  serialize: function(user, params) {
    return { user_id: user._id };
  },
  setupController: function(controller, user) {
    this._super.apply(this, arguments);
    set_title(user.username);
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

  user_alterable: function() {
    return this.get('is_root') !== true;
  }.property('is_root'),

  actions: {
    generate_password: function() {
      var random_password = Math.random().toString(36).slice(-8); // from stackoverflow
      this.set('password', random_password);
    },
    change_password: function() {
      this.send('change_user', 'password', this.getProperties('password'));
    },
    log_in_with_user: function() {
      LoggedInUsers.add_user_only(this.get('content'));
      window.scrollTo(0, 0);
      alert('User is logged in and is added the list.');
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

App.UsersNewRoute = Ember.Route.extend({
  title: 'Create New User'
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
        Users.reload_users(self.get('controllers.users'), function() {
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

App.HelpController = Ember.ArrayController.extend({});

App.Help = Ember.Object.extend({
  load_help: function() {
    var self = this;
    return Ember.Deferred.promise(function(promise) {
      if (self.get('help')) {
        promise.resolve(self.get('help'));
      } else {
        promise.resolve($.getJSON('/help').then(function(help) {
          var new_array = [];
          for (var slug in help) {
            new_array.push({
              slug: slug,
              title: help[slug]
            });
          }
          self.set('help', new_array);
          return new_array;
        }, handle_error));
      }
    });
  }
});

var Help = App.Help.create();

App.HelpRoute = Ember.Route.extend({
  model: function() {
    return Help.load_help();
  }
});

App.HelpIndexController = Ember.Controller.extend({
  needs: 'help',
  help_topic_count: function() {
    return this.get('controllers.help.content.length');
  }.property('controllers.help.content.length')
});

App.HelpTopicController = Ember.ObjectController.extend({});

App.HelpTopicRoute = Ember.Route.extend({
  beforeModel: function(transition) {
    var slug = transition.params.help_topic.help_topic;
    Ember.set(this.modelFor('help').findBy('slug', slug), 'loading', true);
  },
  model: function(help) {
    return $.getJSON('/help/' + help.help_topic);
  },
  afterModel: function() {
    this.modelFor('help').forEach(function(help) {
      Ember.set(help, 'loading', false);
    });
  },
  setupController: function(controller, model) {
    this._super.apply(this, arguments);
    set_title(model.title);
  }
});

App.Themes = App.ObjectNeedsAuthentication.extend({
  themes: [],
  init: function() {
    this._super();
    for (var i = 0; i < window.THEMES.length; i++) {
      var theme = Ember.Object.create({
        name: window.THEMES[i]
      });
      if (theme.get('name') === window.CURRENT_THEME) {
        theme.set('active', true);
      }
      this.get('themes').addObject(theme);
    }
  },
  reload: function() {
    var themes = this.get('themes');
    for (var i = 0; i < themes.length; i++) {
      if (themes[i].get('name') === window.CURRENT_THEME) {
        themes[i].set('active', true);
      } else {
        themes[i].set('active', false);
      }
    }
  }
}).create();

App.ProfileController = Ember.ObjectController.extend({
  untouched_pwd: true,
  touch_pwd: function() {
    this.set('untouched_pwd', !(this.get('password') &&
      this.get('new_password') && this.get('new_password_again')));
  }.observes('password', 'new_password', 'new_password_again'),
  themes: App.Themes.themes,
  actions: {
    change_password: function() {
      var self = this;
      function reset_new_password() {
        self.setProperties({
          new_password: '',
          new_password_again: ''
        });
        var view = find_view_by_viewname('new_password');
        if (view) view.$().focus();
      }
      if (this.get('new_password') !== this.get('new_password_again')) {
        reset_new_password();
        return alert('New passwords are not the same. Please retype them.');
      }
      $.ajax({
        url: '/profile/password',
        type: 'PUT',
        data: this.getProperties('password', 'new_password')
      }).then(function() {
        Profile.reload_profile(self, function() {
          self.setProperties({
            password: '',
            new_password: '',
            new_password_again: ''
          });
        });
      }, function(error) {
        reset_new_password();
        handle_error.call(self, error);
      });
    },
    change_theme: function(theme) {
      function update(success) {
        $.ajax({
          url: '/preferences/theme',
          type: 'PUT',
          data: { theme: theme.name }
        }).then(success, handle_error);
      }
      var themes = this.get('themes');
      for (var i = 0; i < themes.length; i++) {
        if (themes[i].name === theme.name) {
          update((function(_theme) {
            return function(user) {
              LoggedInUsers.update_current_user(user);
              window.UPDATE_THEME(theme.name);
              _theme.set('active', true);
            };
          })(themes[i]));
        } else {
          themes[i].set('active', false);
        }
      }
    }
  }
});

App.Profile = App.ObjectNeedsAuthentication.extend({
  load_profile: function() {
    var self = this;
    return Ember.Deferred.promise(function(promise) {
      if (self.get('profile')) {
        promise.resolve(self.get('profile'));
      } else {
        promise.resolve($.getJSON('/profile').then(function(profile) {
          self.set('profile', profile);
          return profile;
        }, handle_error));
      }
    });
  },
  reload_profile: function(controller, callback) {
    this.set('profile', null);
    this.get('load_profile').call(this).then(function(profile) {
      if (controller) controller.set('content', profile);
      if (callback) callback();
    });
  },
  reload: function() {
    this.set('profile', null);
    if (in_route_of('profile')) {
      this.get('load_profile').call(this).then(function(profile) {
        App.__container__.lookup('controller:profile').set('content', profile);
        App.__container__.lookup('controller:profile').transitionToRoute('profile');
      });
    }
  }
});

var Profile = App.Profile.create();

App.ProfileRoute = Ember.Route.extend({
  model: function() {
    return Profile.load_profile();
  }
});

App.LoginRoute = Ember.Route.extend({
  setupController: function(controller, params) {
    if (params && params.needed) {
      if (params.needed === true) {
        controller.set('error_message', 'You need to log in first.');
      } else {
        controller.set('error_message', params.needed);
      }
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
       .then(function(user) {
        LoggedInUsers.add_user(user);
        try {
          var previous = App.History.GetPrevious();
          self.transitionToRoute(previous);
        } catch(error) {
          self.transitionToRoute('index');
        }
      }, function(error) {
        handle_error(error);
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
  contenteditable: function() {
    var is_writable = this.get('is_writable');
    if (is_writable === undefined) is_writable = false;
    return is_writable.toString();
  }.property('is_writable'),
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
    if ($editor) {
      $editor.options.readOnly = !Ember.get(this, 'is_writable');
    }
    if ($editor && value !== $editor.getValue()) {
      $editor.setValue(value || (this.get('placeholder') || ''));
    }
  }),
  placeholder: function() {
    return this.get('PLACEHOLDER') + '\n';
  }.property('PLACEHOLDER'),
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
    if ($editor && $editor.edit) {
      $editor.edit.options.readOnly = !Ember.get(this, 'is_writable');
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
