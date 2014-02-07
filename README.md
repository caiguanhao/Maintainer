Maintainer
==========

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

Files:

* ``assets/js/main.js``: Ember scripts
* ``app.js``: API
* ``index.hbs``: Handlebars templates
* ``models/``: mongoose scripts
* ``doc/``: Help topics

Grunt
-----

Use ``grunt clean:bootstrap make_theme_index less`` to re-compile
all bootstrap theme LESS files.

Use ``grunt production`` to minify all assets for production use.

Developer
---------

* caiguanhao &lt;caiguanhao@gmail.com&gt;
