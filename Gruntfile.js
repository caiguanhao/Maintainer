module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    less: {
      options: {
        cleancss: true
      },
      maintainer: {
        files: {
          'public/css/maintainer.css': [ 'assets/css/maintainer.less' ]
        }
      }
      /* make_theme_index task will put some targets here */
    },
    concat: {
      /* analyze task will put some targets here */
    },
    uglify: {
      /* analyze task will put some targets here */
    },
    clean: {
      public_css: [ 'public/js/*.css' ],
      public_js: [ 'public/js/*.js' ],
      bootstrap: [ 'public/css/vendor/bootstrap-*.css' ]
    },
    watch: {
      gruntfile: {
        files: [ 'Gruntfile.js' ]
      },
      js: {
        files: [ 'assets/js/**/*.js', 'public/**' ],
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
      css: {
        files: [ 'assets/css/**/*' ],
        tasks: [ 'less:maintainer' ]
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
          "public/js/maintainer-templates.js": ["public/bs/**/*.hbs"]
        }
      }
    }
  });

  // page is reloaded before express server is restarted
  // the browser may fail to connect, so we delay the reload
  grunt.registerTask('delay', 'livereload is too fast to reload', function() {
    setTimeout(this.async(), 1000);
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-express-server');
  grunt.loadNpmTasks('grunt-ember-templates');

  grunt.registerTask('default', [ 'make_theme_index', 'less', 'copy_index', 'express', 'watch' ]);

  grunt.registerTask('production', [ 'clean', 'make_theme_index', 'less', 'analyze', 'emberTemplates', 'uglify', 'concat' ]);

  grunt.registerTask('copy_index', 'Copy index page', function() {
    grunt.file.copy('index.hbs', 'public/index.html');
  });

  grunt.registerTask('analyze', 'Analyze index.hbs', function() {
    var index = grunt.file.read('index.hbs');
    var void_elements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
      'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

    var hbs = { name: '', content: '' };
    var prod_index = '';
    var prod_tasks = {
      concat: { options: {}, dest: {}, src: {} },
      uglify: { options: {}, dest: {}, src: {} }
    };
    var tasks = Object.keys(prod_tasks);
    var skip_this_tag = false;

    var htmlparser = require('htmlparser2');
    var parser = new htmlparser.Parser({
      onopentag: function(name, attribs) {
        var is_script = (name === 'script');
        if (is_script) {
          hbs.name = '';
          hbs.content = '';

          if (attribs.hasOwnProperty('development')) {
            skip_this_tag = true;
          }
          if (attribs.hasOwnProperty('production')) {
            attribs.src = attribs.production;
            delete attribs.production;
          }
        }
        if (is_script) {
          for (var i = 0; i < tasks.length; i++) {
            var task = tasks[i];
            var target_name = attribs[task];
            if (!target_name) continue;
            prod_tasks[task].dest[target_name] = prod_tasks[task].dest[target_name] || [];
            prod_tasks[task].src[target_name] = prod_tasks[task].src[target_name] || [];
            if (attribs.dest) {
              if (attribs.options) {
                prod_tasks[task].options[target_name] = JSON.parse(attribs.options);
              }
              prod_tasks[task].dest[target_name].push(attribs.dest);
            }
            if (attribs.src || attribs['real-src']) {
              var src = attribs['real-src'] || ('assets' + attribs.src);
              src = src.replace(/[\n\s]{2,}/g, '');
              prod_tasks[task].src[target_name].push(src);
            }
            if (attribs.dest) {
              attribs = { src: attribs.dest };
            } else {
              skip_this_tag = true;
            }
          }
        }
        if (is_script && attribs.type === 'text/x-handlebars') {
          hbs.name = attribs.id;
        } else {
          if (skip_this_tag === false) {
            prod_index += '<' + name;
            for (var attrib in attribs) {
              prod_index += ' ' + attrib + '="' + attribs[attrib] + '"';
            }
            prod_index += '>';
          }
        }
      },
      ontext: function(text) {
        if (hbs.name !== '') {
          hbs.content += text;
        } else {
          if (skip_this_tag === false) {
            prod_index += text;
          }
        }
      },
      onclosetag: function(name) {
        if (name === 'script' && hbs.name !== '') {
          hbs.content = hbs.content.replace(/^\s{2,}/mg, '');
          hbs.content = hbs.content.trim() + '\n';
          grunt.file.write('public/bs/' + hbs.name + '.hbs', hbs.content);
        } else {
          if (void_elements.indexOf(name.toLowerCase()) > -1) return;
          if (skip_this_tag === false) {
            prod_index += '</' + name + '>';
          } else {
            skip_this_tag = false;
          }
        }
      },
      onend: function() {
        prod_index = prod_index.replace(/^\s*$/mg, '');
        prod_index = prod_index.replace(/<\/script>\n{2,}/mg, '</script>\n');
        prod_index = prod_index.trim() + '\n';
        grunt.file.write('public/index.html', prod_index);

        for (var i = 0; i < tasks.length; i++) {
          var task = tasks[i];
          var task_config = grunt.config(task) || {};
          for (var pu in prod_tasks[task].src) {
            var files = {};
            for (var dest in prod_tasks[task].dest[pu]) {
              files['public' + prod_tasks[task].dest[pu][dest]] = prod_tasks[task].src[pu];
            }
            task_config[pu] = {
              options: prod_tasks[task].options[pu],
              files: files
            };
          }
          grunt.config(task, task_config);
          // console.log(JSON.stringify(task_config, null, 2));
        }
      }
    });
    parser.write(index);
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
