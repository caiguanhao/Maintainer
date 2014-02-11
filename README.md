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

Screenshot
----------

![maintainer](https://f.cloud.github.com/assets/1284703/2134408/bbbc6da0-92e3-11e3-80fa-7d92491dfce8.png)

Install
-------

Make sure you have installed ``build-essential`` and ``mongodb``
before you run ``npm i`` to install dependencies.

You may need to install ``grunt-cli`` to run grunt tasks and
``pm2`` to run the app:

    npm -g i grunt-cli pm2

To run pm2 in production mode, remember to run with
``NODE_ENV=production``. And add ``export NODE_ENV=production``
to /etc/init.d/pm2-init.sh if you use ``pm2 startup ubuntu``.

Install ``nginx`` and create a config file:

    upstream maintainerApp {
      server 127.0.0.1:21012;
    }

    server {
      server_name <SERVER_NAME>;
      listen 80;
      client_max_body_size 1m;
      keepalive_timeout 5;
      root /srv/Maintainer/public;
      access_log /srv/Maintainer/log/access.log;
      error_log /srv/Maintainer/log/error.log;
      error_page 500 502 503 504 /500.html;
      location = /500.html {
        root /srv/Maintainer/public;
      }
      try_files $uri/index.html $uri.html $uri @app;
      location @app {
        proxy_intercept_errors on;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $http_host;
        proxy_redirect off;
        proxy_pass http://maintainerApp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
      }
    }

Grunt
-----

Use ``grunt production`` to minify all assets for production use.

Use ``grunt addroot:<user>:<pass>`` to add a root user.

Developer
---------

* caiguanhao &lt;caiguanhao@gmail.com&gt;
