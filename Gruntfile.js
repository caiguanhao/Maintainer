module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    less: {
      /* make_theme_index task will put some targets here */
    },
    clean: {
      bootstrap: [ 'public/css/vendor/bootstrap-*.css' ]
    },
    watch: {
      gruntfile: {
        files: [ 'Gruntfile.js' ]
      },
      js: {
        files: [ 'assets/js/**/*.js', 'assets/css/**/*.css', 'public/**/*.html' ],
        options: {
          livereload: true
        }
      },
      server: {
        files: [ '<%= pkg.main %>', 'models/**', 'doc/index.json' ],
        tasks: [ 'express', 'delay' ],
        options: {
          spawn: false
        }
      },
      server_again: {
        files: [ '<%= pkg.main %>', 'models/**', 'doc/index.json' ],
        options: {
          livereload: true
        }
      },
      doc: {
        files: [ 'doc/*.md' ],
        tasks: [ 'make_help_index' ],
        options: {
          livereload: true
        }
      },
      index: {
        files: [ 'index.hbs' ],
        tasks: [ 'copy_index' ]
      }
      /* make_theme_index task will put some targets here */
    },
    express: {
      server: {
        options: {
          script: '<%= pkg.main %>'
        }
      }
    },
    emberTemplates: {
      compile: {
        options: {
          templateBasePath: "public/bs"
        },
        files: {
          "public/s.js": ["public/bs/**/*.hbs"]
        }
      }
    },
  });

  // page is reloaded before express server is restarted
  // the browser may fail to connect, so we delay the reload
  grunt.registerTask('delay', 'livereload is too fast to reload', function() {
    setTimeout(this.async(), 1000);
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-express-server');
  grunt.loadNpmTasks('grunt-ember-templates');

  grunt.registerTask('default', [ 'make_theme_index', 'less', 'copy_index', 'express', 'watch' ]);

  grunt.registerTask('copy_index', 'Copy index page', function() {
    grunt.file.copy('index.hbs', 'public/index.html');
  });

  grunt.registerTask('split', 'Split index.hbs', function() {
    var hbs = grunt.file.read('index.hbs');
    var hbs_name = '', hbs_content = '';
    var htmlparser = require("htmlparser2");
    var parser = new htmlparser.Parser({
      onopentag: function(name, attribs) {
        if (name === "script") {
          hbs_name = '';
          hbs_content = '';
        }
        if (attribs.type === "text/x-handlebars") {
          hbs_name = attribs.id;
        }
      },
      ontext: function(text) {
        hbs_content += text;
      },
      onclosetag: function(name) {
        if (name === "script" && hbs_name !== '') {
          hbs_content = hbs_content.replace(/^\s{2,}/mg, '');
          hbs_content = hbs_content.trim() + '\n';
          grunt.file.write('public/bs/' + hbs_name + '.hbs', hbs_content);
        }
      }
    });
    parser.write(hbs);
    parser.end();
  });

  grunt.registerTask('make_help_index', 'Generate help index JSON file', function() {
    var path = require('path');
    var doc_dir = 'doc';
    var help_files = grunt.file.expand({
      cwd: doc_dir
    }, '*.md');
    var index = {};
    help_files.forEach(function(help_file) {
      var file = grunt.file.read(path.join(doc_dir, help_file));
      var yfm = file.match(/^---((.|\n)*)---\n/);
      var title = '';
      if (yfm) {
        yfm = yfm[1].trim();
        title = yfm.match(/^title:\s*(.*)$/mi)
        if (title) title = title[1].trim();
        title = title.replace(/^(["']?)(.*)\1$/, '$2');
      }
      var slug = path.basename(help_file, path.extname(help_file));
      index[slug] = title;
    });
    grunt.file.write(path.join(doc_dir, 'index.json'),
      JSON.stringify(index, null, 2) + '\n');
  });

  grunt.registerTask('make_theme_index', 'Generate theme index JSON file', function() {
    var themes = grunt.file.expand({
      cwd: 'assets/css/vendor/bootstrap',
      filter: 'isDirectory'
    }, '*', '!src');
    var themes_str = JSON.stringify(themes);
    var theme_js_file = 'assets/js/themes.js'
    var theme_js = grunt.file.read(theme_js_file);
    var deli_start = '/*! REPLACE-START */';
    var deli_end = '/*! REPLACE-END */';
    var start = theme_js.indexOf(deli_start);
    var end = theme_js.indexOf(deli_end);
    var new_theme_js;
    if (start >= 0 && end > start + deli_start.length &&
      theme_js.slice(start + deli_start.length, end) !== themes_str) {
      new_theme_js = theme_js.slice(0, start + deli_start.length);
      new_theme_js += themes_str;
      new_theme_js += theme_js.slice(end);
      grunt.file.write(theme_js_file, new_theme_js);
      grunt.log.ok('Updated ' + theme_js_file);
    } else {
      grunt.log.ok('No need to update ' + theme_js_file);
    }

    var user_model_file = 'models/user.js'
    var user_model = grunt.file.read(user_model_file);
    var start = user_model.indexOf(deli_start);
    var end = user_model.indexOf(deli_end);
    var new_user_model;
    if (start >= 0 && end > start + deli_start.length &&
      user_model.slice(start + deli_start.length, end) !== themes_str) {
      new_user_model = user_model.slice(0, start + deli_start.length);
      new_user_model += themes_str;
      new_user_model += user_model.slice(end);
      grunt.file.write(user_model_file, new_user_model);
      grunt.log.ok('Updated ' + user_model_file);
    } else {
      grunt.log.ok('No need to update ' + user_model_file);
    }

    var less = grunt.config('less');
    themes.forEach(function(theme) {
      if (grunt.file.exists('public/css/vendor/bootstrap-' + theme + '.css')) {
        return true;
      }
      var files = {};
      files['public/css/vendor/bootstrap-' + theme + '.css'] =
        'assets/css/vendor/bootstrap/src/bootstrap.less';
      less['bootstrap-' + theme] = {
        options: {
          paths: [ 'assets/css/vendor/bootstrap/' + theme,
            'assets/css' ]
        },
        files: files
      };
    });
    if (Object.keys(less).length === 0) {
      less = { no_need: {} };
    }
    grunt.config('less', less);

    var watch = grunt.config('watch');
    themes.forEach(function(theme) {
      watch['bootstrap-' + theme] = {
        files: [ 'assets/css/vendor/bootstrap/' + theme + '/*.less' ],
        tasks: [ 'make_theme_index', 'less:bootstrap-' + theme ],
        options: {
          livereload: true
        }
      }
    });
    grunt.config('watch', watch);
  });

};
